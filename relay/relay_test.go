package main

import (
	"bufio"
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func testConfig(t *testing.T, c Config) {
	t.Helper()
	old := currentConfig()
	cfgMu.Lock()
	cfg = c
	cfgMu.Unlock()
	t.Cleanup(func() { cfgMu.Lock(); cfg = old; cfgMu.Unlock() })
}
func response(req *http.Request, status int, text string) *http.Response {
	return &http.Response{StatusCode: status, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(text)), Request: req, ContentLength: int64(len(text))}
}

func TestResolvedIPsFailClosed(t *testing.T) {
	for _, ip := range []string{"127.0.0.1", "10.1.2.3", "169.254.169.254", "100.64.0.1", "::1", "::ffff:127.0.0.1", "ff02::1", "0.0.0.0"} {
		if !isPrivateIP(ip) {
			t.Errorf("not blocked: %s", ip)
		}
	}
	lookups := 0
	lookup := func(context.Context, string) ([]net.IPAddr, error) {
		lookups++
		return []net.IPAddr{{IP: net.ParseIP("1.1.1.1")}, {IP: net.ParseIP("127.0.0.1")}}, nil
	}
	if _, err := resolvedDialIPs(context.Background(), "fixture.test", false, lookup); err == nil {
		t.Fatal("mixed DNS answers accepted")
	}
	if lookups != 1 {
		t.Fatal("DNS resolved more than once")
	}
	if _, err := resolvedDialIPs(context.Background(), "fixture.test", true, lookup); err != nil {
		t.Fatal(err)
	}
	if _, err := resolvedDialIPs(context.Background(), "127.0.0.1", false, lookup); err == nil {
		t.Fatal("private literal accepted")
	}
	if _, err := resolvedDialIPs(context.Background(), "1.1.1.1", false, lookup); err != nil {
		t.Fatal(err)
	}
}

func TestDialBlocksLocalhostDNS(t *testing.T) {
	testConfig(t, Config{})
	conn, err := safeDialContext(context.Background(), "tcp", "localhost:1")
	if conn != nil {
		conn.Close()
		t.Fatal("private DNS target connected")
	}
	if err == nil {
		t.Fatal("DNS target not blocked")
	}
	if strings.Contains(err.Error(), "localhost") {
		t.Fatal("hostname leaked into error")
	}
}

func TestUpstreamTLSVerification(t *testing.T) {
	testConfig(t, Config{AllowPrivateTargets: true})
	server := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("fixture")) }))
	server.Config.ErrorLog = log.New(io.Discard, "", 0)
	server.StartTLS()
	defer server.Close()
	strict := makeTransport(true)
	defer strict.CloseIdleConnections()
	client := &http.Client{Transport: strict}
	if r, err := client.Get(server.URL); err == nil {
		r.Body.Close()
		t.Fatal("untrusted TLS certificate accepted")
	}
	compatible := makeTransport(false)
	defer compatible.CloseIdleConnections()
	client.Transport = compatible
	r, err := client.Get(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	r.Body.Close()
}

func TestRedirectNeverRestoresCrossOriginCredentials(t *testing.T) {
	testConfig(t, Config{})
	var calls []*http.Request
	base := roundTripFunc(func(r *http.Request) (*http.Response, error) {
		calls = append(calls, r.Clone(r.Context()))
		if len(calls) < 3 {
			res := response(r, 302, "")
			if len(calls) == 1 {
				res.Header.Set("Location", "https://other.test/next")
			} else {
				res.Header.Set("Location", "https://source.test/final")
			}
			return res, nil
		}
		return response(r, 200, "fixture bytes"), nil
	})
	req, _ := http.NewRequest("GET", "https://source.test/start", nil)
	for _, name := range []string{"Authorization", "Cookie", "X-Emby-Token", "X-MediaBrowser-Token"} {
		req.Header.Set(name, "fixture-secret")
	}
	res, err := (&redirectChase{base: base, max: 5}).RoundTrip(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if len(calls) != 3 {
		t.Fatal(len(calls))
	}
	for _, r := range calls[1:] {
		for _, name := range []string{"Authorization", "Cookie", "X-Emby-Token", "X-MediaBrowser-Token"} {
			if r.Header.Get(name) != "" {
				t.Fatalf("credential restored: %s", name)
			}
		}
	}
}

func TestRedirectRejectsDowngradeAndPrivateLiteral(t *testing.T) {
	testConfig(t, Config{})
	for _, dest := range []string{"http://source.test/clear", "https://127.0.0.1/private", "https://user:pass@other.test/private"} {
		calls := 0
		base := roundTripFunc(func(r *http.Request) (*http.Response, error) {
			calls++
			res := response(r, 302, "")
			res.Header.Set("Location", dest)
			return res, nil
		})
		req, _ := http.NewRequest("GET", "https://source.test/start", nil)
		if res, err := (&redirectChase{base: base, max: 5}).RoundTrip(req); err == nil {
			res.Body.Close()
			t.Fatalf("redirect accepted: %s", dest)
		}
		if calls != 1 {
			t.Fatal("blocked redirect was fetched")
		}
	}
}

func TestSignedRawPathAndRangeSurvive(t *testing.T) {
	testConfig(t, Config{AllowPrivateTargets: true})
	var got string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = r.RequestURI
		if r.Header.Get("Range") != "bytes=0-3" {
			t.Error("Range lost")
		}
		if r.Header.Get("X-Relay-Auth") != "" {
			t.Error("relay credentials leaked")
		}
		w.Header().Set("Content-Range", "bytes 0-3/10")
		w.WriteHeader(206)
		w.Write([]byte("test"))
	}))
	defer upstream.Close()
	target, _ := url.Parse(upstream.URL + "/signed%2Ffile?sign=a%2Bb%2f&x=1&x=2")
	req := httptest.NewRequest("GET", "http://relay.test/wrong%2Fpath", nil)
	req.Header.Set("Range", "bytes=0-3")
	req.Header.Set("X-Relay-Auth", "fixture")
	recorder := httptest.NewRecorder()
	buildProxy(target).ServeHTTP(recorder, req)
	if got != "/signed%2Ffile?sign=a%2Bb%2f&x=1&x=2" {
		t.Fatal(got)
	}
	if recorder.Code != 206 || recorder.Body.String() != "test" {
		t.Fatal(recorder.Code, recorder.Body.String())
	}
}

func TestHLSCompatibilityAndValidators(t *testing.T) {
	testConfig(t, Config{Secret: strings.Repeat("x", 32)})
	req, _ := http.NewRequest("GET", "https://source.test/list.m3u8", nil)
	base := roundTripFunc(func(r *http.Request) (*http.Response, error) {
		res := response(r, 200, "#EXTM3U\nhttps://cdn.test/seg.ts?sign=a%2Bb\n")
		res.Header.Set("ETag", "old")
		return res, nil
	})
	res, err := (&redirectChase{base: base, max: 5}).RoundTrip(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	text, _ := io.ReadAll(res.Body)
	if bytes.Contains(text, []byte("https://cdn.test")) || !bytes.Contains(text, []byte("./_hls/")) {
		t.Fatal("HLS compatibility lost")
	}
	path := strings.TrimSpace(strings.Split(string(text), "\n")[1])
	extracted, ok := hlsExtract("/demo/" + path)
	if !ok || extracted.String() != "https://cdn.test/seg.ts?sign=a%2Bb" {
		t.Fatal("HLS target not recovered")
	}
	if res.Header.Get("ETag") != "" || res.ContentLength != -1 {
		t.Fatal("stale rewritten validators")
	}
}

func TestOversizeHLSIsNotTruncated(t *testing.T) {
	payload := "#EXTM3U\n" + strings.Repeat("a", (12<<20)+4096)
	base := roundTripFunc(func(r *http.Request) (*http.Response, error) { return response(r, 200, payload), nil })
	req, _ := http.NewRequest("GET", "https://source.test/list.m3u8", nil)
	res, err := (&redirectChase{base: base, max: 5}).RoundTrip(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	out, _ := io.ReadAll(res.Body)
	if !bytes.Equal(out, []byte(payload)) {
		t.Fatal("oversize HLS truncated")
	}
}

func TestStatsSnapshotConcurrentWrites(t *testing.T) {
	old := statsPath
	statsPath = filepath.Join(t.TempDir(), "stats.json")
	defer func() { statsPath = old }()
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < 1000; i++ {
			statsAdd("fixture.test", 1, 1, 1)
			quotaAddDown("fixture", 1)
		}
	}()
	for i := 0; i < 10; i++ {
		saveStats()
	}
	wg.Wait()
	saveStats()
	data, err := os.ReadFile(statsPath)
	if err != nil {
		t.Fatal(err)
	}
	var f statsFile
	if json.Unmarshal(data, &f) != nil {
		t.Fatal("invalid stats JSON")
	}
}

func TestConfigUpdateAppliesImmediatelyAndRejectsBadCertificate(t *testing.T) {
	oldPath := cfgPath
	cfgPath = filepath.Join(t.TempDir(), "config.json")
	defer func() { cfgPath = oldPath }()
	oldSecret := strings.Repeat("a", 32)
	newSecret := strings.Repeat("b", 32)
	testConfig(t, Config{Port: 2087, Secret: oldSecret, VerifyUpstreamTLS: true, AllowCFOnly: true, MonthlyLimitBytes: 12345})
	req := httptest.NewRequest("POST", "http://relay.test/_relay/config", strings.NewReader(fmt.Sprintf(`{"secret":%q}`, newSecret)))
	req.Header.Set("X-Relay-Key", oldSecret)
	w := httptest.NewRecorder()
	configHandler(w, req)
	if w.Code != 200 {
		t.Fatal(w.Code)
	}
	c := currentConfig()
	if c.Secret != newSecret || !c.VerifyUpstreamTLS || !c.AllowCFOnly || c.MonthlyLimitBytes != 12345 {
		t.Fatal("config lost or not applied")
	}
	auth := httptest.NewRequest("GET", "http://relay.test/_relay/health", nil)
	auth.Header.Set("X-Relay-Key", oldSecret)
	if adminAuthOK(auth) {
		t.Fatal("old key accepted")
	}
	auth.Header.Set("X-Relay-Key", newSecret)
	if !adminAuthOK(auth) {
		t.Fatal("new key not applied")
	}
	req = httptest.NewRequest("POST", "http://relay.test/_relay/config", strings.NewReader(`{"cert_pem":"invalid"}`))
	req.Header.Set("X-Relay-Key", newSecret)
	w = httptest.NewRecorder()
	configHandler(w, req)
	if w.Code != 400 {
		t.Fatal("invalid cert saved")
	}
	if currentConfig().CertPEM != "" {
		t.Fatal("invalid certificate affected running config")
	}
}

func TestEmptyAdminSecretRejected(t *testing.T) {
	testConfig(t, Config{})
	if adminAuthOK(httptest.NewRequest("GET", "http://relay.test/_relay/health", nil)) {
		t.Fatal("empty secret authorized")
	}
}

func TestRelayHMACStillCompatible(t *testing.T) {
	secret := strings.Repeat("x", 32)
	testConfig(t, Config{Secret: secret})
	target := "https://source.test/path?sign=a%2Bb"
	stamp := fmt.Sprint(time.Now().UnixMilli())
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(stamp + ":" + target))
	req := httptest.NewRequest("GET", "http://relay.test/path", nil)
	req.Header.Set("X-Relay-Ts", stamp)
	req.Header.Set("X-Relay-Auth", hex.EncodeToString(mac.Sum(nil)))
	if !relayAuthOK(req, target) {
		t.Fatal("Worker relay protocol changed")
	}
	if relayAuthOK(req, target+"tampered") {
		t.Fatal("tampered target accepted")
	}
}

func TestWebSocketUpgradeAndDuplex(t *testing.T) {
	testConfig(t, Config{AllowPrivateTargets: true})
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, buffer, err := w.(http.Hijacker).Hijack()
		if err != nil {
			t.Error(err)
			return
		}
		defer conn.Close()
		conn.SetDeadline(time.Now().Add(5 * time.Second))
		buffer.WriteString("HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n")
		buffer.Flush()
		frame := make([]byte, 6)
		if _, err := io.ReadFull(buffer, frame); err != nil {
			t.Error(err)
			return
		}
		buffer.Write(frame)
		buffer.Flush()
	}))
	defer upstream.Close()
	target, _ := url.Parse(upstream.URL + "/socket")
	proxy := httptest.NewServer(buildProxy(target))
	defer proxy.Close()
	u, _ := url.Parse(proxy.URL)
	conn, err := net.Dial("tcp", u.Host)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	conn.SetDeadline(time.Now().Add(5 * time.Second))
	req, _ := http.NewRequest("GET", proxy.URL+"/socket", nil)
	req.Header.Set("Connection", "Upgrade")
	req.Header.Set("Upgrade", "websocket")
	if err := req.Write(conn); err != nil {
		t.Fatal(err)
	}
	reader := bufio.NewReader(conn)
	res, err := http.ReadResponse(reader, req)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 101 {
		t.Fatal("upgrade lost", res.StatusCode)
	}
	frame := []byte{0x81, 4, 't', 'e', 's', 't'}
	if _, err := conn.Write(frame); err != nil {
		t.Fatal(err)
	}
	echoed := make([]byte, len(frame))
	if _, err := io.ReadFull(reader, echoed); err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(frame, echoed) {
		t.Fatal("upgraded duplex bytes changed")
	}
}

func TestErrorsNeverLogSourceOrRawFailure(t *testing.T) {
	testConfig(t, Config{AllowPrivateTargets: true})
	var logs bytes.Buffer
	old := log.Writer()
	log.SetOutput(&logs)
	defer log.SetOutput(old)
	target, _ := url.Parse("http://127.0.0.1:1/private-token?key=fixture-secret")
	recorder := httptest.NewRecorder()
	buildProxy(target).ServeHTTP(recorder, httptest.NewRequest("GET", "http://relay.test/private-token", nil))
	if recorder.Code != 502 {
		t.Fatal(recorder.Code)
	}
	output := logs.String() + recorder.Body.String()
	for _, secret := range []string{"127.0.0.1", "private-token", "fixture-secret", "connection refused"} {
		if strings.Contains(output, secret) {
			t.Fatal("source/error disclosed")
		}
	}
}
