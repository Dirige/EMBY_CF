package main

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

const VERSION = "emby-relay-0.1.0"

// 全部配置持久化在 JSON 文件里，由 Worker 后台在线下发修改，不用任何环境变量。
type Config struct {
	Port                int    `json:"port"`
	Secret              string `json:"secret"`
	CertPEM             string `json:"cert_pem,omitempty"`
	KeyPEM              string `json:"key_pem,omitempty"`
	VerifyUpstreamTLS   bool   `json:"verify_upstream_tls,omitempty"`
	AllowPrivateTargets bool   `json:"allow_private_targets,omitempty"`
}

var (
	cfg     Config
	cfgMu   sync.RWMutex
	cfgPath string
	startAt = time.Now()
)

func loadConfig() error {
	data, err := os.ReadFile(cfgPath)
	if err != nil {
		return err
	}
	var c Config
	if err := json.Unmarshal(data, &c); err != nil {
		return err
	}
	if c.Port == 0 {
		c.Port = 2087
	}
	cfgMu.Lock()
	cfg = c
	cfgMu.Unlock()
	return nil
}

func saveConfig(c Config) error {
	out, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(cfgPath), 0750); err != nil {
		return err
	}
	tmp := cfgPath + ".tmp"
	if err := os.WriteFile(tmp, out, 0600); err != nil {
		return err
	}
	return os.Rename(tmp, cfgPath)
}

func currentConfig() Config { cfgMu.RLock(); defer cfgMu.RUnlock(); return cfg }
func currentSecret() string { cfgMu.RLock(); s := cfg.Secret; cfgMu.RUnlock(); return s }

// ---- Worker -> Relay HMAC 认证 ----
// worker 侧: hex(HMAC-SHA256(secret, `${ms}:`${targetURL}`))
// 窗口 ±300s 防 replay
func relayAuthOK(r *http.Request, target string) bool {
	secret := currentSecret()
	if secret == "" {
		return false
	}
	tsStr := r.Header.Get("X-Relay-Ts")
	auth := r.Header.Get("X-Relay-Auth")
	if tsStr == "" || auth == "" {
		return false
	}
	ts, err := strconv.ParseInt(tsStr, 10, 64)
	if err != nil {
		return false
	}
	now := time.Now()
	t := time.UnixMilli(ts)
	if now.Sub(t) > 300*time.Second || t.Sub(now) > 300*time.Second {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(strconv.FormatInt(ts, 10) + ":" + target))
	expect := hex.EncodeToString(mac.Sum(nil))
	return subtle.ConstantTimeCompare([]byte(expect), []byte(auth)) == 1
}

// ---- 管理接口认证（X-Relay-Key = 当前密钥，恒时比较）----
func adminAuthOK(r *http.Request) bool {
	secret := currentSecret()
	return subtle.ConstantTimeCompare([]byte(r.Header.Get("X-Relay-Key")), []byte(secret)) == 1
}

// ---- 目标校验：禁止打回内网/元数据 ----
func isPrivateIP(ip string) bool {
	p := net.ParseIP(ip)
	if p == nil { // 域名不在此做解析校验
		return false
	}
	if p.IsLoopback() || p.IsPrivate() || p.IsLinkLocalUnicast() ||
		p.IsLinkLocalMulticast() || p.IsUnspecified() {
		return true
	}
	if v4 := p.To4(); v4 != nil { // 100.64.0.0/10 CGNAT
		if v4[0] == 100 && v4[1] >= 64 && v4[1] < 128 {
			return true
		}
	}
	return false
}

func makeTransport(verifyUpstream bool) *http.Transport {
	return &http.Transport{
		DialContext: (&net.Dialer{
			Timeout:   15 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: !verifyUpstream, // 反代目标是自签证书 Emby 时必须关校验
			MinVersion:         tls.VersionTLS12,
		},
		MaxIdleConns:          64,
		MaxIdleConnsPerHost:   32,
		IdleConnTimeout:       60 * time.Second,
		TLSHandshakeTimeout:   15 * time.Second,
		// 只用 HTTP/1.1：与 CF/本地网络环境联动时，h2 共享连接拥抱流式请求后会把控制流饿死，
		// 应用表现就是“请求挂 15s 被掐”。禁 h2 后每个请求独立连接，稳但稍慢。
		ForceAttemptHTTP2:     false,
		ResponseHeaderTimeout: 10 * time.Second,
	}
}

var transport = makeTransport(false)

func singleJoiningSlash(a, b string) string {
	aSlash := strings.HasSuffix(a, "/")
	bSlash := strings.HasPrefix(b, "/")
	switch {
	case aSlash && bSlash:
		return a + b[1:]
	case !aSlash && !bSlash:
		return a + "/" + b
	}
	return a + b
}

// 核心转发：ReverseProxy 流式（FlushInterval=-1），原生支持 WebSocket Upgrade 与 Range
func buildProxy(target *url.URL) *httputil.ReverseProxy {
	director := func(req *http.Request) {
		// 请求路径已经包含完整目标 path+query（Worker 端把 X-Relay-Target 也填了同一个 URL），
		// 这里直接全量替换，绝不能把 target.Path 再拼一次（会翻倍）
		req.URL.Scheme = target.Scheme
		req.URL.Host = target.Host
		if target.Path == "" {
			req.URL.Path = "/"
		} else {
			req.URL.Path = target.Path
		}
		req.URL.RawQuery = target.RawQuery
		req.Host = target.Host
		for _, h := range []string{"X-Relay-Target", "X-Relay-Auth", "X-Relay-Ts", "X-Relay-Key"} {
			req.Header.Del(h)
		}
	}
	return &httputil.ReverseProxy{
		Director:      director,
		FlushInterval: -1,
		Transport:     transport,
		ModifyResponse: func(up *http.Response) error {
			t0, _ := up.Request.Context().Value(tsCtxKey{}).(time.Time)
			dur := int64(-1)
			if !t0.IsZero() {
				dur = time.Since(t0).Milliseconds()
			}
			log.Printf("[resp] %s %s status=%d size=%s dur=%dms", up.Request.Method, up.Request.URL.Path, up.StatusCode, up.Header.Get("Content-Length"), dur)
			return nil
		},
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			t0, _ := r.Context().Value(tsCtxKey{}).(time.Time)
			dur := int64(-1)
			if !t0.IsZero() {
				dur = time.Since(t0).Milliseconds()
			}
			log.Printf("[relay] upstream %s err: %v (dur=%dms)", r.Host, err, dur)
			w.WriteHeader(http.StatusBadGateway)
			w.Write([]byte("relay upstream error"))
		},
	}
}

type tsCtxKey struct{}

func relayHandler(w http.ResponseWriter, r *http.Request) {
	received := time.Now()
	r = r.WithContext(context.WithValue(r.Context(), tsCtxKey{}, received))
	targetStr := r.Header.Get("X-Relay-Target")
	if targetStr == "" {
		http.Error(w, "missing X-Relay-Target", http.StatusBadRequest)
		return
	}
	if !relayAuthOK(r, targetStr) {
		http.Error(w, "relay auth failed", http.StatusForbidden)
		return
	}
	u, err := url.Parse(targetStr)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		http.Error(w, "invalid target", http.StatusBadRequest)
		return
	}
	c := currentConfig()
	if !c.AllowPrivateTargets && isPrivateIP(u.Hostname()) {
		http.Error(w, "private target not allowed", http.StatusForbidden)
		return
	}
	log.Printf("[relay] %s %s -> %s", r.Method, r.URL.Path, u.Host)
	buildProxy(u).ServeHTTP(w, r)
}
func healthHandler(w http.ResponseWriter, r *http.Request) {
	if !adminAuthOK(r) {
		http.Error(w, "unauthorized", http.StatusForbidden)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(map[string]any{
		"ok":       true,
		"version":  VERSION,
		"uptime_s": int(time.Since(startAt).Seconds()),
		"port":     currentConfig().Port,
		"tls":      currentConfig().CertPEM != "",
	})
}

type relayPush struct {
	Secret   string `json:"secret,omitempty"`
	CertPEM  string `json:"cert_pem,omitempty"`
	KeyPEM   string `json:"key_pem,omitempty"`
	Port     int    `json:"port,omitempty"`
	Restart  bool   `json:"restart,omitempty"`
}

func configHandler(w http.ResponseWriter, r *http.Request) {
	if !adminAuthOK(r) {
		http.Error(w, "unauthorized (check X-Relay-Key)", http.StatusForbidden)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "POST only", http.StatusMethodNotAllowed)
		return
	}
	var p relayPush
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	c := currentConfig()
	if p.Port > 0 {
		c.Port = p.Port
	}
	if p.Secret != "" {
		c.Secret = p.Secret
	}
	if p.CertPEM != "" {
		c.CertPEM = p.CertPEM
	}
	if p.KeyPEM != "" {
		c.KeyPEM = p.KeyPEM
	}
	if err := saveConfig(c); err != nil {
		http.Error(w, "save failed: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(map[string]any{"ok": true, "restart": p.Restart, "version": VERSION})
	if p.Restart {
		log.Printf("[config] saved, self-restarting via systemd Restart=always")
		time.AfterFunc(800*time.Millisecond, func() {
			syscall.Kill(os.Getpid(), syscall.SIGTERM)
		})
	}
}

func randSecret() string {
	b := make([]byte, 32)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func main() {
	if len(os.Args) > 1 && os.Args[1] == "genkey" { // 首次生成密钥用
		fmt.Println(randSecret())
		return
	}
	cfgPath = os.Getenv("EMBY_RELAY_CONFIG") // 默认路径，见 systemd
	if cfgPath == "" {
		cfgPath = "/etc/emby-relay/config.json"
	}
	if err := loadConfig(); err != nil {
		// 首次部署：生成随机密钥
		if os.IsNotExist(err) {
			s := randSecret()
			c := Config{Port: 2087, Secret: s}
			if err := saveConfig(c); err != nil {
				log.Fatalf("init config: %v", err)
			}
			log.Printf("[bootstrap] generated config with secret: %s (only shown once here!)", s)
			if err := loadConfig(); err != nil {
				log.Fatalf("reload: %v", err)
			}
		} else {
			log.Fatalf("load config: %v", err)
		}
	}

	c := currentConfig()
	mux := http.NewServeMux()
	mux.HandleFunc("/_relay/health", healthHandler)
	mux.HandleFunc("/_relay/config", configHandler)
	mux.HandleFunc("/", relayHandler)

	srv := &http.Server{
		Handler:           mux,
		ReadHeaderTimeout: 45 * time.Second,
		IdleTimeout:       90 * time.Second,
	}

	addr := ":" + strconv.Itoa(c.Port)
	tlsReady := c.CertPEM != "" && c.KeyPEM != ""
	if tlsReady {
		cert, err := tls.X509KeyPair([]byte(c.CertPEM), []byte(c.KeyPEM))
		if err != nil {
			log.Fatalf("load cert/key failed: %v", err)
		}
		srv.TLSConfig = &tls.Config{
			Certificates: []tls.Certificate{cert},
			MinVersion:   tls.VersionTLS12,
		}
	}
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatalf("listen %s: %v", addr, err)
	}
	log.Printf("%s listening on %s (tls=%v)", VERSION, addr, tlsReady)

	go func() {
		sig := make(chan os.Signal, 1)
		signal.Notify(sig, syscall.SIGTERM, syscall.SIGINT)
		<-sig
		log.Printf("shutting down")
		srv.Shutdown(context.Background())
	}()

	var errServe error
	if tlsReady {
		errServe = srv.ServeTLS(ln, "", "")
	} else {
		errServe = srv.Serve(ln)
	}
	if errServe != nil && errServe != http.ErrServerClosed {
		log.Fatalf("serve: %v", errServe)
	}
}
