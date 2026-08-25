package aicoach

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestParseRef(t *testing.T) {
	cases := []struct {
		in   string
		want string
		err  bool
	}{
		{"ab-test-setup", "aicoach/ab-test-setup", false},
		{"johnefemer/my-skill", "johnefemer/my-skill", false},
		{"https://aicoach.pw/skills/ab-test-setup", "aicoach/ab-test-setup", false},
		{"https://aicoach.pw/skills/johnefemer/my-skill", "johnefemer/my-skill", false},
		{"aicoach.pw/skills/caveman", "aicoach/caveman", false},
		{"AICoach/Caveman", "aicoach/caveman", false},
		{"", "", true},
		{"a/b/c", "", true},
		{"https://example.com/skills/x", "", true},
	}
	for _, tc := range cases {
		got, err := ParseRef(tc.in)
		if tc.err {
			if err == nil {
				t.Errorf("ParseRef(%q) = %q, want error", tc.in, got)
			}
			continue
		}
		if err != nil {
			t.Errorf("ParseRef(%q) unexpected error: %v", tc.in, err)
			continue
		}
		if got != tc.want {
			t.Errorf("ParseRef(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

func TestParseFrontmatter(t *testing.T) {
	name, desc := ParseFrontmatter("---\nname: my-skill\ndescription: \"Does a thing.\"\n---\n\n# Body\n")
	if name != "my-skill" {
		t.Errorf("name = %q", name)
	}
	if desc != "Does a thing." {
		t.Errorf("description = %q", desc)
	}
	if n, d := ParseFrontmatter("# No frontmatter"); n != "" || d != "" {
		t.Errorf("expected empty, got %q %q", n, d)
	}
}

func makeBundle(t *testing.T, files map[string]string) []byte {
	t.Helper()
	var buf bytes.Buffer
	zw := gzip.NewWriter(&buf)
	tw := tar.NewWriter(zw)
	for name, content := range files {
		if err := tw.WriteHeader(&tar.Header{Name: name, Mode: 0o644, Size: int64(len(content)), Typeflag: tar.TypeReg}); err != nil {
			t.Fatal(err)
		}
		if _, err := tw.Write([]byte(content)); err != nil {
			t.Fatal(err)
		}
	}
	tw.Close()
	zw.Close()
	return buf.Bytes()
}

func TestExtractBundle(t *testing.T) {
	gz := makeBundle(t, map[string]string{
		"SKILL.md":          "---\nname: x\n---\nbody",
		"references/api.md": "ref",
		"./scripts/run.sh":  "echo hi",
	})
	content, files, err := extractBundle(gz)
	if err != nil {
		t.Fatalf("extractBundle: %v", err)
	}
	if content != "---\nname: x\n---\nbody" {
		t.Errorf("content = %q", content)
	}
	if len(files) != 2 {
		t.Fatalf("files = %d, want 2", len(files))
	}
	for _, f := range files {
		if f.Path == "SKILL.md" {
			t.Error("SKILL.md should not be in supporting files")
		}
	}
}

func TestExtractBundleRejectsTraversal(t *testing.T) {
	gz := makeBundle(t, map[string]string{
		"SKILL.md":         "---\nname: x\n---\nbody",
		"../../etc/passwd": "bad",
	})
	_, files, err := extractBundle(gz)
	if err != nil {
		t.Fatalf("extractBundle: %v", err)
	}
	for _, f := range files {
		if f.Path == "../../etc/passwd" || f.Path == "/etc/passwd" {
			t.Errorf("traversal path was kept: %q", f.Path)
		}
	}
}

func TestExtractBundleWithoutSkillMd(t *testing.T) {
	gz := makeBundle(t, map[string]string{"readme.md": "nope"})
	if _, _, err := extractBundle(gz); err == nil {
		t.Error("expected an error when SKILL.md is absent")
	}
}

func TestFetchMarkdownSkill(t *testing.T) {
	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/skills/manifest":
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"count":1,"skills":[{"ref":"aicoach/demo","publisher":"aicoach","slug":"demo","found":true,` +
				`"name":"Demo","description":"A demo.","revision":"r1","contentUrl":"` + srv.URL + `/skills-md/demo.md",` +
				`"contentType":"markdown","requiresAuth":false}]}`))
		case "/skills-md/demo.md":
			w.Write([]byte("---\nname: demo\ndescription: A demo.\n---\n\n# Demo\n"))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer srv.Close()

	c := New(srv.URL, "")
	got, err := c.Fetch(context.Background(), "demo")
	if err != nil {
		t.Fatalf("Fetch: %v", err)
	}
	if got.Name != "Demo" || got.Revision != "r1" {
		t.Errorf("got %+v", got)
	}
	if !bytes.Contains([]byte(got.Content), []byte("# Demo")) {
		t.Errorf("content = %q", got.Content)
	}
}

func TestFetchPaidWithoutPurchase(t *testing.T) {
	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/skills/manifest" {
			w.Write([]byte(`{"count":1,"skills":[{"ref":"pub/paid","publisher":"pub","slug":"paid","found":true,` +
				`"name":"Paid","revision":"r1","isPaid":true,"contentUrl":"` + srv.URL + `/dl","contentType":"bundle","requiresAuth":true}]}`))
			return
		}
		w.WriteHeader(http.StatusPaymentRequired)
	}))
	defer srv.Close()

	c := New(srv.URL, "some-key")
	if _, err := c.Fetch(context.Background(), "pub/paid"); err == nil {
		t.Fatal("expected a payment error")
	}
}

func TestFetchAuthRequiredWithoutKey(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"count":1,"skills":[{"ref":"pub/x","publisher":"pub","slug":"x","found":true,` +
			`"name":"X","revision":"r1","contentUrl":"http://unused","contentType":"bundle","requiresAuth":true}]}`))
	}))
	defer srv.Close()

	c := New(srv.URL, "")
	_, err := c.Fetch(context.Background(), "pub/x")
	if err == nil {
		t.Fatal("expected an error when no API key is configured")
	}
}

func TestManifestNotFound(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"count":1,"skills":[{"ref":"a/b","publisher":"a","slug":"b","found":false}]}`))
	}))
	defer srv.Close()
	if _, err := New(srv.URL, "").ManifestOne(context.Background(), "a/b"); err == nil {
		t.Fatal("expected not-found error")
	}
}

// The manifest's digest is the only link between the bytes we unpack and the
// resolution step that sent us for them. Without this check a swapped object
// in registry storage would be mirrored into a workspace and handed to an
// agent as though the publisher had signed it.
func TestFetchBundleRejectsDigestMismatch(t *testing.T) {
	bundle := makeBundle(t, map[string]string{"SKILL.md": "---\nname: x\n---\nbody"})

	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/skills/manifest" {
			w.Write([]byte(`{"count":1,"skills":[{"ref":"pub/x","publisher":"pub","slug":"x","found":true,` +
				`"name":"X","revision":"r1","sha256":"` + strings.Repeat("0", 64) + `",` +
				`"contentUrl":"` + srv.URL + `/dl","contentType":"bundle","requiresAuth":true}]}`))
			return
		}
		w.Write(bundle)
	}))
	defer srv.Close()

	_, err := New(srv.URL, "key").Fetch(context.Background(), "pub/x")
	if err == nil {
		t.Fatal("expected a digest mismatch error")
	}
	if !strings.Contains(err.Error(), "digest mismatch") {
		t.Errorf("expected a digest mismatch, got %v", err)
	}
}

func TestFetchBundleAcceptsMatchingDigest(t *testing.T) {
	bundle := makeBundle(t, map[string]string{"SKILL.md": "---\nname: x\ndescription: d\n---\nbody"})
	sum := sha256.Sum256(bundle)

	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/skills/manifest" {
			w.Write([]byte(`{"count":1,"skills":[{"ref":"pub/x","publisher":"pub","slug":"x","found":true,` +
				`"name":"X","revision":"r1","sha256":"` + hex.EncodeToString(sum[:]) + `",` +
				`"contentUrl":"` + srv.URL + `/dl","contentType":"bundle","requiresAuth":true}]}`))
			return
		}
		w.Write(bundle)
	}))
	defer srv.Close()

	got, err := New(srv.URL, "key").Fetch(context.Background(), "pub/x")
	if err != nil {
		t.Fatalf("Fetch: %v", err)
	}
	if got.Content != "---\nname: x\ndescription: d\n---\nbody" {
		t.Errorf("content = %q", got.Content)
	}
}

// A registry that publishes no digest (system skills carry one for their
// markdown, not a bundle) must not be treated as a failure.
func TestFetchBundleWithoutAdvertisedDigest(t *testing.T) {
	bundle := makeBundle(t, map[string]string{"SKILL.md": "---\nname: x\n---\nbody"})

	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/skills/manifest" {
			w.Write([]byte(`{"count":1,"skills":[{"ref":"pub/x","publisher":"pub","slug":"x","found":true,` +
				`"name":"X","revision":"r1","contentUrl":"` + srv.URL + `/dl","contentType":"bundle","requiresAuth":true}]}`))
			return
		}
		w.Write(bundle)
	}))
	defer srv.Close()

	if _, err := New(srv.URL, "key").Fetch(context.Background(), "pub/x"); err != nil {
		t.Fatalf("Fetch: %v", err)
	}
}
