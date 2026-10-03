package main

import (
	"os"
	"strings"
)

// Kensink fork: AGENTHOST_* is the fork's documented name for every MULTICA_*
// setting the CLI and daemon read (AGENTHOST_SERVER_URL, AGENTHOST_CLAUDE_PATH,
// ...). Copy each one onto its MULTICA_* twin before anything reads the
// environment, so upstream code needs no per-variable changes and existing
// fork machines keep working. An explicitly set MULTICA_* value wins.
func init() { applyForkEnvAliases() }

func applyForkEnvAliases() {
	const fork, upstream = "AGENTHOST_", "MULTICA_"
	for _, kv := range os.Environ() {
		key, value, ok := strings.Cut(kv, "=")
		if !ok || !strings.HasPrefix(key, fork) {
			continue
		}
		twin := upstream + strings.TrimPrefix(key, fork)
		if _, set := os.LookupEnv(twin); !set {
			os.Setenv(twin, value)
		}
	}
}
