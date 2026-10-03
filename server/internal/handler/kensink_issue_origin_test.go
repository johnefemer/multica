package handler

import (
	"context"
	"testing"
)

// TestIssueOriginAllowsIntegration pins the fork's origin_type: GitHub-imported
// issues carry origin_type='integration' (migration
// 060_issue_origin_type_integration). Upstream migrations redefine
// issue_origin_type_check wholesale; one that drops 'integration' breaks the
// import and fails to apply on databases that already hold such issues.
func TestIssueOriginAllowsIntegration(t *testing.T) {
	if testPool == nil {
		t.Skip("database not available")
	}
	id := createTestIssue(t, "integration origin", "todo", "none")
	t.Cleanup(func() { deleteTestIssue(t, id) })

	if _, err := testPool.Exec(context.Background(),
		`UPDATE issue SET origin_type = 'integration' WHERE id = $1`, id); err != nil {
		t.Fatalf("origin_type 'integration' rejected: %v", err)
	}
}
