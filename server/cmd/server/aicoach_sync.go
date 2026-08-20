package main

import (
	"context"
	"log/slog"
	"os"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/multica-ai/multica/server/internal/aicoach"
)

// defaultAICoachSyncInterval is deliberately unhurried. Skill content changes
// on the order of days, and every pass costs a request per workspace even when
// nothing moved.
const defaultAICoachSyncInterval = time.Hour

// runAICoachSync keeps skills mirrored from AI Coach up to date.
//
// Off unless AICOACH_SYNC=1, so an install that does not mirror anything makes
// no outbound requests. AICOACH_SYNC_INTERVAL accepts any Go duration
// ("30m", "6h"); AICOACH_API_KEY is needed only for skills published by users,
// since curated ones are public.
func runAICoachSync(ctx context.Context, pool *pgxpool.Pool) {
	if os.Getenv("AICOACH_SYNC") != "1" {
		return
	}

	interval := defaultAICoachSyncInterval
	if raw := os.Getenv("AICOACH_SYNC_INTERVAL"); raw != "" {
		if d, err := time.ParseDuration(raw); err == nil && d > 0 {
			interval = d
		} else if secs, err := strconv.Atoi(raw); err == nil && secs > 0 {
			interval = time.Duration(secs) * time.Second
		} else {
			slog.Warn("aicoach sync: bad AICOACH_SYNC_INTERVAL, using default", "value", raw, "default", interval)
		}
	}

	apiKey := os.Getenv("AICOACH_API_KEY")
	syncer := &aicoach.Syncer{
		Store:   aicoach.NewPgStore(pool),
		BaseURL: os.Getenv("AICOACH_BASE_URL"),
		// One key for the whole install today. The hook is per workspace so a
		// per-workspace credential can replace this without touching the syncer.
		APIKeyFor: func(context.Context, string) string { return apiKey },
		Logger:    slog.Default(),
	}

	slog.Info("aicoach sync: enabled", "interval", interval, "authenticated", apiKey != "")
	syncer.Run(ctx, interval)
}
