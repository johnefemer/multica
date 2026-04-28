package handler

import "sync"

// SettingsReloadStore tracks runtimes whose user-controlled settings (e.g.
// GitHub PAT) have changed and need to be re-delivered to the daemon on its
// next heartbeat. The signal is a presence-only flag — the heartbeat handler
// reads the current settings from the DB at delivery time, so multiple
// rapid updates collapse into a single reload.
type SettingsReloadStore struct {
	mu     sync.Mutex
	dirty  map[string]struct{}
}

func NewSettingsReloadStore() *SettingsReloadStore {
	return &SettingsReloadStore{dirty: make(map[string]struct{})}
}

// Mark flags the given runtime as needing a settings reload.
func (s *SettingsReloadStore) Mark(runtimeID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.dirty[runtimeID] = struct{}{}
}

// PopMarked atomically returns true and clears the flag if the runtime was
// marked dirty; otherwise returns false.
func (s *SettingsReloadStore) PopMarked(runtimeID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.dirty[runtimeID]; !ok {
		return false
	}
	delete(s.dirty, runtimeID)
	return true
}
