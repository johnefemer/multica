package main

import (
	"os"
	"testing"
)

func TestApplyForkEnvAliasesFillsUnsetTwin(t *testing.T) {
	t.Setenv("AGENTHOST_KENSINK_TEST_A", "from-fork")
	os.Unsetenv("MULTICA_KENSINK_TEST_A")
	t.Cleanup(func() { os.Unsetenv("MULTICA_KENSINK_TEST_A") })

	applyForkEnvAliases()

	if got := os.Getenv("MULTICA_KENSINK_TEST_A"); got != "from-fork" {
		t.Fatalf("MULTICA_KENSINK_TEST_A = %q, want from-fork", got)
	}
}

func TestApplyForkEnvAliasesKeepsExplicitUpstreamValue(t *testing.T) {
	t.Setenv("AGENTHOST_KENSINK_TEST_B", "from-fork")
	t.Setenv("MULTICA_KENSINK_TEST_B", "explicit")

	applyForkEnvAliases()

	if got := os.Getenv("MULTICA_KENSINK_TEST_B"); got != "explicit" {
		t.Fatalf("MULTICA_KENSINK_TEST_B = %q, want explicit", got)
	}
}
