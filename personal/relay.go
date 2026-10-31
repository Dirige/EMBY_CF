package main

import (
	"bufio"
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

const VERSION = "emby-relay-0.3.0"

// 全部配置持久化在 JSON 文件里，由 Worker 后台在线下发修改，不用任何环境变量。
type Config struct {
	Port                int    `json:"port"`
	Secret              string `json:"secret"`
	CertPEM             string `json:"cert_pem,omitempty"`
	KeyPEM              string `json:"key_pem,omitempty"`
	VerifyUpstreamTLS   bool   `json:"verify_upstream_tls,omitempty"`
	AllowPrivateTargets bool   `json:"allow_private_targets,omitempty"`
	// v0.3.0 流量限额（0 = 不限制）
	MonthlyLimitBytes uint64 `json:"monthly_limit_bytes,omitempty"` // 月度出站总上限
	PerIPDailyBytes   uint64 `json:"per_ip_daily_limit_bytes,omitempty"`
	PerIPMaxConns     int    `json:"per_ip_max_conns,omitempty"`
	AllowCFOnly       bool   `json:"allow_cf_ips_only,omitempty"` // 只接受 Cloudflare 回源 IP + 回环
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

// ---- 流量统计：内存计数 + 每分钟落盘（重启不丢），按上海时区日切 ----
// up   = 从源站拉取的字节（VPS 入站）
// down = 发回 Worker/客户端的字节（VPS 出站）
type trafficStat struct {
	Req  uint64 `json:"req"`
	Up   uint64 `json:"up_bytes"`
	Down uint64 `json:"down_bytes"`
}

// ipStat：单 IP 当日用量（跨日自动清零）
type ipStat struct {
	Date  string `json:"date"`
	Req   uint64 `json:"req"`
	Bytes uint64 `json:"bytes"` // 出站字节（计入配额）
}

// deniedStat：被限额/白名单拒绝的计数
type deniedStat struct {
	Quota uint64 `json:"quota"`
	Conns uint64 `json:"conns"`
	IP    uint64 `json:"ip"`
}

type statsFile struct {
	Date       string                 `json:"date"`
	Total      trafficStat            `json:"total"`
	Today      trafficStat            `json:"today"`
	Hosts      map[string]trafficStat `json:"hosts"`
	Month      string                 `json:"month,omitempty"`
	MonthTotal trafficStat            `json:"month_total,omitempty"`
	IPs        map[string]ipStat      `json:"ips,omitempty"`
	Denied     deniedStat             `json:"denied,omitempty"`
}

var (
	statsMu     sync.Mutex
	statsTotal  trafficStat
	statsToday  trafficStat
	statsDate   string
	statsHosts  = map[string]trafficStat{}
	statsMonth  string
	statsMTotal trafficStat
	statsIPs    = map[string]ipStat{}
	statsDenied deniedStat
	statsPath   string
)

func shanghaiToday() string {
	return time.Now().In(time.FixedZone("CST", 8*3600)).Format("2006-01-02")
}

func shanghaiMonth() string {
	return time.Now().In(time.FixedZone("CST", 8*3600)).Format("2006-01")
}

func loadStats() {
	statsPath = filepath.Join(filepath.Dir(cfgPath), "stats.json")
	statsDate = shanghaiToday()
	statsMonth = shanghaiMonth()
	data, err := os.ReadFile(statsPath)
	if err != nil {
		return
	}
	var f statsFile
	if json.Unmarshal(data, &f) != nil {
		return
	}
	statsTotal = f.Total
	statsDenied = f.Denied
	if f.Date == statsDate {
		statsToday = f.Today
		statsHosts = f.Hosts
	}
	if f.Month == statsMonth {
		statsMTotal = f.MonthTotal
	}
	if f.IPs != nil {
		for ip, v := range f.IPs {
			if v.Date == statsDate {
				statsIPs[ip] = v
			}
		}
	}
	if statsHosts == nil {
		statsHosts = map[string]trafficStat{}
	}
	if statsIPs == nil {
		statsIPs = map[string]ipStat{}
	}
}

func saveStats() {
	statsMu.Lock()
	f := statsFile{Date: statsDate, Total: statsTotal, Today: statsToday, Hosts: statsHosts,
		Month: statsMonth, MonthTotal: statsMTotal, IPs: statsIPs, Denied: statsDenied}
	statsMu.Unlock()
	out, err := json.Marshal(f)
	if err != nil {
		return
	}
	tmp := statsPath + ".tmp"
	if os.WriteFile(tmp, out, 0600) == nil {
		os.Rename(tmp, statsPath)
	}
}

func statsRollDay() {
	today := shanghaiToday()
	if statsDate != today {
		statsDate = today
		statsToday = trafficStat{}
		statsHosts = map[string]trafficStat{}
		statsIPs = map[string]ipStat{}
	}
	month := shanghaiMonth()
	if statsMonth != month {
		statsMonth = month
		statsMTotal = trafficStat{}
	}
}

// ipBytes 当日该 IP 已用出站字节（不存在则 0）
func ipBytes(ip string) uint64 {
	statsMu.Lock()
	defer statsMu.Unlock()
	statsRollDay()
	v, ok := statsIPs[ip]
	if !ok || v.Date != statsDate {
		return 0
	}
	return v.Bytes
}

// quotaAddDown：出站字节增量记账（计入月度配额 + 单 IP 日配额），实时累计
func quotaAddDown(ip string, n uint64) {
	statsMu.Lock()
	defer statsMu.Unlock()
	statsRollDay()
	statsMTotal.Down += n
	if ip == "" {
		return
	}
	v := statsIPs[ip]
	if v.Date != statsDate {
		v = ipStat{Date: statsDate}
	}
	v.Bytes += n
	statsIPs[ip] = v
	// 防 map 无限膨胀：超过 5000 个 IP 时清掉非当日的
	if len(statsIPs) > 5000 {
		for k, x := range statsIPs {
			if x.Date != statsDate {
				delete(statsIPs, k)
			}
		}
	}
}

// ipReqInc：单 IP 请求计数（每请求一次）
func ipReqInc(ip string) {
	statsMu.Lock()
	defer statsMu.Unlock()
	statsRollDay()
	v := statsIPs[ip]
	if v.Date != statsDate {
		v = ipStat{Date: statsDate}
	}
	v.Req++
	statsIPs[ip] = v
}

func deniedInc(kind string) {
	statsMu.Lock()
	defer statsMu.Unlock()
	switch kind {
	case "quota":
		statsDenied.Quota++
	case "conns":
		statsDenied.Conns++
	case "ip":
		statsDenied.IP++
	}
}

func statsAdd(host string, req, up, down uint64) {
	statsMu.Lock()
	defer statsMu.Unlock()
	statsRollDay()
	statsTotal.Req += req
	statsTotal.Up += up
	statsTotal.Down += down
	statsToday.Req += req
	statsToday.Up += up
	statsToday.Down += down
	// 月度桶：Req/Up 在此累计；Down 由 quotaAddDown 实时累计（避免重复计数）
	statsMTotal.Req += req
	statsMTotal.Up += up
	if host != "" {
		h := statsHosts[host]
		h.Req += req
		h.Up += up
		h.Down += down
		statsHosts[host] = h
	}
}

func statsSnapshot() (total, today, month trafficStat, hosts map[string]trafficStat, date, monthKey string, denied deniedStat) {
	statsMu.Lock()
	defer statsMu.Unlock()
	statsRollDay()
	m := make(map[string]trafficStat, len(statsHosts))
	for k, v := range statsHosts {
		m[k] = v
	}
	return statsTotal, statsToday, statsMTotal, m, statsDate, statsMonth, statsDenied
}

// ipStatsSnapshot：当日按 IP 用量的带锁拷贝
func ipStatsSnapshot() map[string]ipStat {
	statsMu.Lock()
	defer statsMu.Unlock()
	statsRollDay()
	m := make(map[string]ipStat, len(statsIPs))
	for k, v := range statsIPs {
		m[k] = v
	}
	return m
}

// countBody：包装源站响应体，边读边累计 up 字节
type countBody struct {
	rc   io.ReadCloser
	host string
}

func (c *countBody) Read(p []byte) (int, error) {
	n, err := c.rc.Read(p)
	if n > 0 {
		statsAdd(c.host, 0, uint64(n), 0)
	}
	return n, err
}
func (c *countBody) Close() error { return c.rc.Close() }

// countWriter：包装发往 Worker/客户端的响应，累计 down 字节（兼容 Flush/Hijack）
// v0.3.0：每次 Write 实时计入月度配额 + 单 IP 日配额
type countWriter struct {
	http.ResponseWriter
	n     uint64
	ip    string
	wrote bool
}

func (c *countWriter) WriteHeader(code int) {
	if !c.wrote {
		c.wrote = true
	}
	c.ResponseWriter.WriteHeader(code)
}
func (c *countWriter) Write(p []byte) (int, error) {
	if !c.wrote {
		c.wrote = true
	}
	n, err := c.ResponseWriter.Write(p)
	if n > 0 {
		atomic.AddUint64(&c.n, uint64(n))
		quotaAddDown(c.ip, uint64(n))
	}
	return n, err
}
func (c *countWriter) Flush() {
	if f, ok := c.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}
func (c *countWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	return c.ResponseWriter.(http.Hijacker).Hijack()
}

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

// ---- 单 IP 并发连接计数 ----
var (
	connsMu   sync.Mutex
	connsByIP = map[string]int{}
)

func connsAcquire(ip string, max int) bool {
	if max <= 0 {
		return true
	}
	connsMu.Lock()
	defer connsMu.Unlock()
	if connsByIP[ip] >= max {
		return false
	}
	connsByIP[ip]++
	return true
}

func connsRelease(ip string) {
	connsMu.Lock()
	defer connsMu.Unlock()
	if connsByIP[ip] > 0 {
		connsByIP[ip]--
	}
	if len(connsByIP) > 10000 {
		connsByIP = map[string]int{}
	}
}

// ---- Cloudflare 回源 IP 白名单（v0.3.0）----
// 内置 CF 官方网段兜底，启动后每 24h 从 cloudflare.com 刷新一次
var (
	cfMu      sync.RWMutex
	cfIPNets  []*net.IPNet
	cfUpdated time.Time
)

var CF_DEFAULT_CIDRS = []string{
	"173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22",
	"141.101.64.0/18", "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20",
	"197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13",
	"104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
	"2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32",
	"2405:8100::/32", "2a06:98c0::/29", "2c0f:f248::/32",
}

func loadCFNets() {
	nets := make([]*net.IPNet, 0, 32)
	for _, cidr := range CF_DEFAULT_CIDRS {
		if _, n, err := net.ParseCIDR(cidr); err == nil {
			nets = append(nets, n)
		}
	}
	cfMu.Lock()
	cfIPNets = nets
	cfUpdated = time.Now()
	cfMu.Unlock()
}

func refreshCFNets() {
	fetch := func(u string) []string {
		cli := &http.Client{Timeout: 10 * time.Second}
		resp, err := cli.Get(u)
		if err != nil {
			return nil
		}
		defer resp.Body.Close()
		body, err := io.ReadAll(io.LimitReader(resp.Body, 65536))
		if err != nil {
			return nil
		}
		var out []string
		for _, line := range strings.Split(string(body), "\n") {
			line = strings.TrimSpace(line)
			if line != "" && strings.Contains(line, "/") {
				out = append(out, line)
			}
		}
		return out
	}
	cidrs := append(fetch("https://www.cloudflare.com/ips-v4"), fetch("https://www.cloudflare.com/ips-v6")...)
	if len(cidrs) < 10 { // 拉取失败保留现有列表
		return
	}
	nets := make([]*net.IPNet, 0, len(cidrs))
	for _, cidr := range cidrs {
		if _, n, err := net.ParseCIDR(cidr); err == nil {
			nets = append(nets, n)
		}
	}
	if len(nets) > 0 {
		cfMu.Lock()
		cfIPNets = nets
		cfUpdated = time.Now()
		cfMu.Unlock()
		log.Printf("[cf-ips] refreshed: %d ranges", len(nets))
	}
}

func isCFRemote(r *http.Request) bool {
	host := r.RemoteAddr
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	ip := net.ParseIP(host)
	if ip == nil {
		return false
	}
	if ip.IsLoopback() { // 本机健康检查/测试放行
		return true
	}
	cfMu.RLock()
	nets := cfIPNets
	cfMu.RUnlock()
	for _, n := range nets {
		if n.Contains(ip) {
			return true
		}
	}
	return false
}

func clientIP(r *http.Request) string {
	host := r.RemoteAddr
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	return host
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
		MaxIdleConns:        64,
		MaxIdleConnsPerHost: 32,
		IdleConnTimeout:     60 * time.Second,
		TLSHandshakeTimeout: 15 * time.Second,
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
			// 流量统计：包装源站响应体，边读边计 up 字节
			if up.Body != nil {
				up.Body = &countBody{rc: up.Body, host: up.Request.URL.Host}
			}
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
	c := currentConfig()
	ip := clientIP(r)

	// 闸 1：CF 回源 IP 白名单（回环始终放行）
	if c.AllowCFOnly && !isCFRemote(r) {
		deniedInc("ip")
		http.Error(w, "cf ips only", http.StatusForbidden)
		return
	}
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
	if !c.AllowPrivateTargets && isPrivateIP(u.Hostname()) {
		http.Error(w, "private target not allowed", http.StatusForbidden)
		return
	}
	// 闸 2：月度出站总上限
	if c.MonthlyLimitBytes > 0 {
		_, _, month, _, _, _, _ := statsSnapshot()
		if month.Down >= c.MonthlyLimitBytes {
			deniedInc("quota")
			w.Header().Set("X-Relay-Denied", "quota")
			http.Error(w, "relay monthly quota exhausted", http.StatusServiceUnavailable)
			return
		}
	}
	// 闸 3：单 IP 每日出站上限
	if c.PerIPDailyBytes > 0 && ipBytes(ip) >= c.PerIPDailyBytes {
		deniedInc("quota")
		w.Header().Set("X-Relay-Denied", "quota")
		http.Error(w, "relay per-ip daily quota exhausted", http.StatusServiceUnavailable)
		return
	}
	// 闸 4：单 IP 并发连接数
	if !connsAcquire(ip, c.PerIPMaxConns) {
		deniedInc("conns")
		w.Header().Set("X-Relay-Denied", "concurrency")
		http.Error(w, "too many concurrent connections", http.StatusTooManyRequests)
		return
	}
	defer connsRelease(ip)

	statsAdd(u.Host, 1, 0, 0)
	ipReqInc(ip)
	cw := &countWriter{ResponseWriter: w, ip: ip}
	buildProxy(u).ServeHTTP(cw, r)
	if n := atomic.LoadUint64(&cw.n); n > 0 {
		statsAdd(u.Host, 0, 0, n)
	}
}
func healthHandler(w http.ResponseWriter, r *http.Request) {
	if !adminAuthOK(r) {
		http.Error(w, "unauthorized", http.StatusForbidden)
		return
	}
	c := currentConfig()
	_, _, month, _, _, monthKey, denied := statsSnapshot()
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(map[string]any{
		"ok":       true,
		"version":  VERSION,
		"uptime_s": int(time.Since(startAt).Seconds()),
		"port":     c.Port,
		"tls":      c.CertPEM != "",
		"limits": map[string]any{
			"monthly_limit_bytes": c.MonthlyLimitBytes,
			"per_ip_daily_bytes":  c.PerIPDailyBytes,
			"per_ip_max_conns":    c.PerIPMaxConns,
			"allow_cf_only":       c.AllowCFOnly,
		},
		"usage": map[string]any{
			"month":          monthKey,
			"month_down":     month.Down,
			"month_up":       month.Up,
			"month_requests": month.Req,
			"denied":         denied,
		},
	})
}

func statsHandler(w http.ResponseWriter, r *http.Request) {
	if !adminAuthOK(r) {
		http.Error(w, "unauthorized", http.StatusForbidden)
		return
	}
	total, today, month, hosts, date, monthKey, denied := statsSnapshot()
	type hostRow struct {
		Host      string `json:"host"`
		Req       uint64 `json:"req"`
		UpBytes   uint64 `json:"up_bytes"`
		DownBytes uint64 `json:"down_bytes"`
	}
	rows := make([]hostRow, 0, len(hosts))
	for h, v := range hosts {
		rows = append(rows, hostRow{Host: h, Req: v.Req, UpBytes: v.Up, DownBytes: v.Down})
	}
	sort.Slice(rows, func(i, j int) bool { return rows[i].DownBytes+rows[i].UpBytes > rows[j].DownBytes+rows[j].UpBytes })
	if len(rows) > 20 {
		rows = rows[:20]
	}
	// Top IP（当日用量排序，最多 20 个）
	type ipRow struct {
		IP    string `json:"ip"`
		Req   uint64 `json:"req"`
		Bytes uint64 `json:"bytes"`
	}
	ipRows := make([]ipRow, 0, len(ipStatsSnapshot()))
	for ip, v := range ipStatsSnapshot() {
		ipRows = append(ipRows, ipRow{IP: ip, Req: v.Req, Bytes: v.Bytes})
	}
	sort.Slice(ipRows, func(i, j int) bool { return ipRows[i].Bytes > ipRows[j].Bytes })
	if len(ipRows) > 20 {
		ipRows = ipRows[:20]
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(map[string]any{
		"ok":       true,
		"version":  VERSION,
		"uptime_s": int(time.Since(startAt).Seconds()),
		"date":     date,
		"total":    total,
		"today":    today,
		"hosts":    rows,
		"month": map[string]any{
			"key":  monthKey,
			"up":   month.Up,
			"down": month.Down,
			"req":  month.Req,
		},
		"top_ips": ipRows,
		"denied":  denied,
	})
}

type relayPush struct {
	Secret  string `json:"secret,omitempty"`
	CertPEM string `json:"cert_pem,omitempty"`
	KeyPEM  string `json:"key_pem,omitempty"`
	Port    int    `json:"port,omitempty"`
	Restart bool   `json:"restart,omitempty"`
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
	mux.HandleFunc("/_relay/stats", statsHandler)
	mux.HandleFunc("/_relay/config", configHandler)
	mux.HandleFunc("/", relayHandler)

	loadStats()
	loadCFNets()
	go refreshCFNets() // 拉取失败会保留内置列表；成功后每 24h 再刷
	go func() {        // 每分钟落盘，重启不丢统计；CF 网段每日刷新
		for range time.Tick(60 * time.Second) {
			saveStats()
		}
	}()
	go func() {
		for range time.Tick(24 * time.Hour) {
			refreshCFNets()
		}
	}()

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
		saveStats() // 停机前落盘，统计不丢
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
