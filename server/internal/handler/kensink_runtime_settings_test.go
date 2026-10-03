package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestUpdateRuntimeSettingsRequiresRuntimeEditor pins who may set a runtime's
// GitHub token: it authenticates every agent on that machine, so a plain
// member must not change it on someone else's runtime, while the owner can.
func TestUpdateRuntimeSettingsRequiresRuntimeEditor(t *testing.T) {
	if testPool == nil {
		t.Skip("database not available")
	}
	runtimeID := createProviderRuntime(t, "claude") // owned by testUserID
	memberID := createPlainMember(t, "kensink-runtime-settings-member@example.test")

	patch := func(userID string) int {
		w := httptest.NewRecorder()
		req := newRequest("PATCH", "/api/runtimes/"+runtimeID+"/settings", map[string]any{"github_token": ""})
		req.Header.Set("X-User-ID", userID)
		req = withURLParam(req, "runtimeId", runtimeID)
		testHandler.UpdateRuntimeSettings(w, req)
		return w.Code
	}

	if code := patch(memberID); code != http.StatusForbidden {
		t.Fatalf("plain member on another member's runtime: got %d, want 403", code)
	}
	if code := patch(testUserID); code != http.StatusOK {
		t.Fatalf("runtime owner: got %d, want 200", code)
	}
}
