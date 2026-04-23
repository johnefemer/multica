# Multica — project documentation

This folder contains **senior product-engineering** documentation derived from the Multica codebase: architecture, data model, feature map, algorithms, runtime dependencies, and a product requirements document (PRD).

| Document | Purpose |
|----------|---------|
| [architecture.md](./architecture.md) | System layers, services, real-time model, CLI/daemon, deployment boundaries |
| [database-schema.md](./database-schema.md) | Tables, relationships, indexes, extensions, migration themes |
| [features.md](./features.md) | Feature areas, API surface grouping, frontend package layout |
| [algorithms-and-dependencies.md](./algorithms-and-dependencies.md) | Core algorithms, event flow, and Go/Node dependency rationale |
| [PRD.md](./PRD.md) | In-depth PRD: personas, requirements, non-goals, success metrics |

**Source of truth:** the repository (`server/`, `apps/`, `packages/`, `server/migrations/`). These docs intentionally cite file paths and patterns found in code rather than aspirational roadmaps unless labeled as such.
