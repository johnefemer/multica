package daemon

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
)

// Kensink fork: the CLI ships as `agenthost`, but upstream's agent brief and
// built-in skills tell agents to run `multica <command>`. Give every agent a
// `multica` that resolves to this binary so that text works unchanged on fork
// machines. Kept in its own file so upstream's prompt text stays untouched.

var (
	cliAliasOnce sync.Once
	cliAliasPath string
)

// cliAliasDir returns a per-user directory holding a `multica` symlink to
// selfBin, or "" when the running binary is already called multica, on
// Windows (symlinks need extra privileges there), or when the link cannot be
// made. The directory lives under the user's cache dir rather than a shared
// temp dir, so another account cannot pre-plant the link.
func cliAliasDir(selfBin string) string {
	name := strings.TrimSuffix(filepath.Base(selfBin), filepath.Ext(selfBin))
	if name == "multica" || runtime.GOOS == "windows" {
		return ""
	}
	cliAliasOnce.Do(func() {
		base, err := os.UserCacheDir()
		if err != nil {
			return
		}
		dir := filepath.Join(base, "agenthost", "cli-alias")
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return
		}
		link := filepath.Join(dir, "multica")
		if current, err := os.Readlink(link); err != nil || current != selfBin {
			_ = os.Remove(link)
			if err := os.Symlink(selfBin, link); err != nil {
				return
			}
		}
		cliAliasPath = dir
	})
	return cliAliasPath
}
