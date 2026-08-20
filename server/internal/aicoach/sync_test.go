package aicoach

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

type fakeStore struct {
	skills   []TrackedSkill
	saved    map[string][3]string // id -> {description, content, revision}
	states   map[string][2]string // id -> {state, message}
	files    map[string][]File
	replaced map[string]int
	failSave bool
}

func newFake(skills ...TrackedSkill) *fakeStore {
	return &fakeStore{
		skills:   skills,
		saved:    map[string][3]string{},
		states:   map[string][2]string{},
		files:    map[string][]File{},
		replaced: map[string]int{},
	}
}

func (f *fakeStore) ListSyncable(context.Context, int32) ([]TrackedSkill, error) {
	return f.skills, nil
}
func (f *fakeStore) SaveSynced(_ context.Context, id, desc, content, rev string) error {
	if f.failSave {
		return errors.New("boom")
	}
	f.saved[id] = [3]string{desc, content, rev}
	return nil
}
func (f *fakeStore) SetState(_ context.Context, id, state, msg string) error {
	f.states[id] = [2]string{state, msg}
	return nil
}
func (f *fakeStore) ReplaceFiles(_ context.Context, id string, files []File) error {
	f.replaced[id]++
	f.files[id] = files
	return nil
}

func tracked(id, ref, rev string) TrackedSkill {
	return TrackedSkill{
		ID:          id,
		WorkspaceID: "ws-1",
		Name:        ref,
		SourceRef:   ref,
		SourceRev:   rev,
		SyncState:   StateOK,
	}
}

// registry serves a manifest whose revision and body the test controls.
func registry(t *testing.T, revision, body string) *httptest.Server {
	t.Helper()
	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/skills/manifest":
			w.Write([]byte(`{"count":1,"skills":[{"ref":"aicoach/demo","publisher":"aicoach","slug":"demo",` +
				`"found":true,"name":"Demo","description":"A demo.","revision":"` + revision + `",` +
				`"contentUrl":"` + srv.URL + `/skills-md/demo.md","contentType":"markdown","requiresAuth":false}]}`))
		case "/skills-md/demo.md":
			w.Write([]byte(body))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	return srv
}

func TestSyncSkipsUnchangedRevision(t *testing.T) {
	srv := registry(t, "rev1", "---\nname: demo\n---\nbody")
	defer srv.Close()

	f := newFake(tracked("id-1", "aicoach/demo", "rev1"))
	s := &Syncer{Store: f, BaseURL: srv.URL}

	res, err := s.SyncOnce(context.Background(), 10)
	if err != nil {
		t.Fatalf("SyncOnce: %v", err)
	}
	if res.Unchanged != 1 || res.Updated != 0 {
		t.Fatalf("got %+v, want 1 unchanged", res)
	}
	if len(f.saved) != 0 {
		t.Error("an unchanged skill should not be rewritten")
	}
}

func TestSyncPullsChangedRevision(t *testing.T) {
	body := "---\nname: demo\ndescription: A demo.\n---\nnew body"
	srv := registry(t, "rev2", body)
	defer srv.Close()

	f := newFake(tracked("id-2", "aicoach/demo", "rev1"))
	s := &Syncer{Store: f, BaseURL: srv.URL}

	res, err := s.SyncOnce(context.Background(), 10)
	if err != nil {
		t.Fatalf("SyncOnce: %v", err)
	}
	if res.Updated != 1 {
		t.Fatalf("got %+v, want 1 updated", res)
	}
	got := f.saved["id-2"]
	if got[2] != "rev2" {
		t.Errorf("revision = %q, want rev2", got[2])
	}
	if got[1] != body {
		t.Errorf("content = %q", got[1])
	}
	if f.replaced["id-2"] != 1 {
		t.Error("supporting files should be replaced on pull")
	}
}

func TestSyncMarksUnpublishedAsGone(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"count":1,"skills":[{"ref":"aicoach/demo","publisher":"aicoach","slug":"demo","found":false}]}`))
	}))
	defer srv.Close()

	f := newFake(tracked("id-3", "aicoach/demo", "rev1"))
	s := &Syncer{Store: f, BaseURL: srv.URL}

	res, _ := s.SyncOnce(context.Background(), 10)
	if res.Gone != 1 {
		t.Fatalf("got %+v, want 1 gone", res)
	}
	if f.states["id-3"][0] != StateGone {
		t.Errorf("state = %q, want %q", f.states["id-3"][0], StateGone)
	}
	if len(f.saved) != 0 {
		t.Error("a skill that vanished upstream must keep its local content")
	}
}

func TestSyncLeavesRowsAloneWhenRegistryIsDown(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
	}))
	defer srv.Close()

	f := newFake(tracked("id-4", "aicoach/demo", "rev1"))
	s := &Syncer{Store: f, BaseURL: srv.URL}

	res, err := s.SyncOnce(context.Background(), 10)
	if err != nil {
		t.Fatalf("SyncOnce should absorb a registry outage: %v", err)
	}
	if res.Failed != 1 {
		t.Fatalf("got %+v, want 1 failed", res)
	}
	if len(f.states) != 0 {
		t.Error("an outage must not flag individual skills as broken")
	}
}

func TestSyncRecordsPerSkillFailure(t *testing.T) {
	srv := registry(t, "rev2", "---\nname: demo\n---\nbody")
	defer srv.Close()

	f := newFake(tracked("id-5", "aicoach/demo", "rev1"))
	f.failSave = true
	s := &Syncer{Store: f, BaseURL: srv.URL}

	res, _ := s.SyncOnce(context.Background(), 10)
	if res.Failed != 1 {
		t.Fatalf("got %+v, want 1 failed", res)
	}
	if f.states["id-5"][0] != StateError {
		t.Errorf("state = %q, want %q", f.states["id-5"][0], StateError)
	}
}

func TestSyncSkipsUntrackedRefs(t *testing.T) {
	srv := registry(t, "rev2", "body")
	defer srv.Close()

	blank := tracked("id-6", "", "rev1")
	f := newFake(blank)
	s := &Syncer{Store: f, BaseURL: srv.URL}

	res, _ := s.SyncOnce(context.Background(), 10)
	if res.Checked != 0 {
		t.Fatalf("got %+v, want nothing checked", res)
	}
}

func TestSyncRetriesAfterAnError(t *testing.T) {
	srv := registry(t, "rev1", "---\nname: demo\n---\nbody")
	defer srv.Close()

	// Same revision as stored, but the last pass errored, so it must retry
	// rather than treat the row as current.
	sk := tracked("id-7", "aicoach/demo", "rev1")
	sk.SyncState = StateError
	f := newFake(sk)
	s := &Syncer{Store: f, BaseURL: srv.URL}

	res, _ := s.SyncOnce(context.Background(), 10)
	if res.Updated != 1 {
		t.Fatalf("got %+v, want the errored skill retried", res)
	}
}
