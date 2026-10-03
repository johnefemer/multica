package daemon

import (
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"testing"
)

func TestCLIAliasDirLinksMulticaToSelf(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("alias is not created on Windows")
	}
	t.Setenv("HOME", t.TempDir())
	t.Setenv("XDG_CACHE_HOME", t.TempDir())
	cliAliasOnce = sync.Once{}
	cliAliasPath = ""

	self := filepath.Join(t.TempDir(), "agenthost")
	if err := os.WriteFile(self, []byte("#!/bin/sh\n"), 0o755); err != nil {
		t.Fatal(err)
	}

	dir := cliAliasDir(self)
	if dir == "" {
		t.Fatal("expected an alias dir for a binary not named multica")
	}
	target, err := os.Readlink(filepath.Join(dir, "multica"))
	if err != nil {
		t.Fatalf("readlink: %v", err)
	}
	if target != self {
		t.Fatalf("alias points at %q, want %q", target, self)
	}
}

func TestCLIAliasDirSkipsBinaryNamedMultica(t *testing.T) {
	if got := cliAliasDir(filepath.Join(t.TempDir(), "multica")); got != "" {
		t.Fatalf("expected no alias for a binary already named multica, got %q", got)
	}
}
