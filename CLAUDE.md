# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

OpenPost is a Bun/Turbo monorepo: a Go server (Echo + Huma + Bun ORM) that embeds a static SvelteKit app, plus a CLI, native mobile app, marketing site, and docs site. [`AGENTS.md`](AGENTS.md) is the authoritative rulebook. It holds the detailed domain invariants (Publication/Rendition model, composer, workflows, editors, themes, mobile) and a table routing each task type to the right skill or doc. Read the relevant part before changing an unfamiliar area. [`docs/agents/repository-map.md`](docs/agents/repository-map.md) maps each area to its entry file, the seam to follow, and its verification command. `PRODUCT.md` and `DESIGN.md` cover product terms and UI direction.

## Commands

Tooling (Go, Bun, Node) is pinned by Devenv: `direnv allow && devenv shell -- setup` once, then run everything from the repo root. `devenv shell -- doctor` checks the environment. Root tasks go through `scripts/tasks.mjs`.

```bash
bun run dev                    # frontend (vite) + backend (go run -tags dev) together
bun run dev -- backend         # one surface: frontend | backend | marketing | docs
bun run check | lint | test | build | format   # whole repo; append `-- <scope>` to narrow
bun run check -- frontend      # scopes: frontend backend cli marketing docs
bun run check -- contracts     # named policy checks also take `-- <name>` (ui-consistency, agents, workflows, release-version, ...)
bun run verify                 # format+check+lint+test+build; only for high-risk changes
bun run release -- check       # pre-release gate (no prod builds, browser suites, or Docker)
```

The backend panics at startup without a built frontend in `apps/server/cmd/openpost/public`, even under `-tags dev`, so run `bun run build -- frontend` once before `bun run dev`.

Single tests:

```bash
cd apps/server && go test -tags dev ./internal/services/lifecycle -run TestName   # backend needs -tags dev
cd apps/cli && go test ./... -run TestName
cd apps/web && bun run sync && bunx vitest run --project server path/to/file.test.ts   # not plain `bun test`: it skips the Svelte/Vitest setup
bun test scripts/<name>.test.mjs                                                       # repo tooling tests
bunx playwright test --config tests/app/playwright.config.ts tests/app/<spec>.ts       # run one browser suite at a time; `bun run browser:install` first
cd apps/mobile && bun run check                                                        # mobile has its own lockfile and commands
```

Set `VITEST_MAX_WORKERS=2` if test workers run out of memory. Docs reader tests run against the static export: `bun run build -- docs`, then `bunx playwright test --config tests/docs/playwright.config.ts`.

## Architecture

**One binary.** `apps/web` is a client-only SvelteKit app (SSR off, `adapter-static`). `scripts/package-frontend.mjs` validates the build and its `app-routes.json` manifest, then installs it in `apps/server/cmd/openpost/public`, which Go embeds with `//go:embed`. `-tags dev` builds read assets from disk (`OPENPOST_WEB_PATH`) instead, so backend tests, lint, and `go run` all use that tag. The SPA fallback in `cmd/openpost/web.go` uses the route manifest to tell real app routes from 404s.

**Backend layering** (`apps/server/internal/`): `api/handlers` authenticate and validate, `services/*` own product rules and orchestration, `models` plus Bun ORM own persistence. SQLite is the self-host default and PostgreSQL backs Hosted. Binary roles are `all`, `web`, `worker`, and `migrate`.

- Provider-specific API behavior stays in `platform/`, behind the `Adapter` interface and optional capability interfaces in `adapter.go`. `capabilities/` is the central catalog; `providerlimits/` holds limits shared with validators.
- Persistent work runs as rows in the database `jobs` table (`queue/`, `jobregistry/`), never in-memory goroutines. A job sweep or scheduled action goes through a registered job type.
- Media crosses the `BlobStorage` interface (`services/mediastore`): local disk by default, S3-compatible for Hosted.
- The core domain is the **Publication** (user-visible post) and its per-destination **Rendition**s, in `models/models.go` and `services/{lifecycle,publications,renditions,publisher}`. The UI says "post" and "variant".
- HTTP operations are Huma routes, which generate `apps/web/openapi.json`. Echo handles only non-JSON routes: uploads, media serving, OAuth/MCP, and the SPA.

**Contract flow.** The Huma routes generate `apps/web/openapi.json`, which feeds the TypeScript types in `packages/api-contract`, the generated API docs, the CLI reference (`docs/reference/cli.md`), and the selected automation contract. MCP tools are cataloged separately in `api/handlers/mcp.go` (`mcpOperationCatalog`). For any contract change, edit the source and regenerate consumers; `bun run check -- contracts` fails on drift. Never hand-edit generated output (OpenAPI types, Paraglide messages, generated docs MDX, route manifests).

**Frontend** (`apps/web/src`): Svelte 5 runes, Tailwind 4, Paraglide i18n, a typed API client, and shared controls from `packages/ui` (the package owns reusable components, theme manifests, icons, and CSS). Server reads go through `@openpost/query-catalog` (cache keys and invalidation, shared with mobile). The image, video, and quick-cut editors are large self-contained modules under `src/lib/{image-editor,video-editor,quick-cut}/` backed by `packages/{editor-shared,video-project}`.

**Other surfaces.** `apps/mobile` is Expo/React Native with its own dependencies. `apps/marketing` and `apps/docs` (Fumadocs) are composed into one Cloudflare site by `bun run build -- public-site`; docs API pages are generated from the OpenAPI spec on every build. Public entity facts, plan limits, and platform text limits come from `config/public-brand.json`, `packages/plan-catalog`, and `packages/platform-text`, so don't hardcode them elsewhere.

## Workflow notes

- Commit directly to `main` with Conventional Commits, one concern per commit, and put the issue number in fix titles, e.g. `(#342)`. Stage only your own files. Push only when asked.
- User-visible changes get a fragment in `changes/<name>.md` (`### Added` / `### Changed` / `### Fixed`) rather than a direct `CHANGELOG.md` edit. See `changes/README.md`.
- Private specs and priorities live in Vikunja, durable decisions in Hindsight (bank `rodrigo`, tag `project:openpost`), and public reports in GitHub Issues. Don't keep project state in repo files.
- Run UI and copy changes through the `ux-consistency` skill and `bun run check -- ui-consistency`.
- The Docker image for local use is `ghcr.io/getopenpost/openpost:latest` via the root `docker-compose.yml` (needs a `.env` with real `OPENPOST_JWT_SECRET` and `OPENPOST_ENCRYPTION_KEY` values; `change-this-*` placeholders are rejected at boot). Build from source with `devenv shell -- docker-build`.
