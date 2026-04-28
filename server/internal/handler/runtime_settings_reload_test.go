package handler

import (
	"sync"
	"testing"
)

func TestSettingsReloadStore_MarkAndPop(t *testing.T) {
	s := NewSettingsReloadStore()

	if s.PopMarked("rt1") {
		t.Fatal("PopMarked on empty store should return false")
	}

	s.Mark("rt1")
	if !s.PopMarked("rt1") {
		t.Fatal("PopMarked should return true after Mark")
	}
	if s.PopMarked("rt1") {
		t.Fatal("PopMarked should return false on the second call (flag consumed)")
	}
}

func TestSettingsReloadStore_RuntimeIsolation(t *testing.T) {
	s := NewSettingsReloadStore()
	s.Mark("rt1")
	if s.PopMarked("rt2") {
		t.Fatal("PopMarked('rt2') must not consume the flag for 'rt1'")
	}
	if !s.PopMarked("rt1") {
		t.Fatal("rt1 flag should still be set after rt2 pop attempt")
	}
}

func TestSettingsReloadStore_RepeatedMarksCollapse(t *testing.T) {
	s := NewSettingsReloadStore()
	s.Mark("rt1")
	s.Mark("rt1")
	s.Mark("rt1")
	if !s.PopMarked("rt1") {
		t.Fatal("first PopMarked should return true")
	}
	if s.PopMarked("rt1") {
		t.Fatal("repeated Marks must collapse into a single pending reload")
	}
}

func TestSettingsReloadStore_ConcurrentSafe(t *testing.T) {
	s := NewSettingsReloadStore()
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(2)
		go func() { defer wg.Done(); s.Mark("rt1") }()
		go func() { defer wg.Done(); s.PopMarked("rt1") }()
	}
	wg.Wait()
	// No assertion on final state — race-detector run is the actual signal.
}
