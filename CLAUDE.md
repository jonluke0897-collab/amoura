# Claude Code — session primer

Context for future Claude Code sessions in this repo. This file is read automatically on session start.

## What this is

**Amoura** — a trans-first mobile dating app. Full spec in `docs/`:
- [`docs/product-vision.md`](docs/product-vision.md) — strategy, brand, user research
- [`docs/prd.md`](docs/prd.md) — technical spec, schema, API, UI
- [`docs/product-roadmap.md`](docs/product-roadmap.md) — 100 tasks across 8 phases; **checkboxes are the source of truth for what's done**
- [`docs/gtm.md`](docs/gtm.md) — launch plan

Each roadmap phase has a **phase prompt** you can hand to a new session — it names exactly which sections of the PRD / vision / GTM that phase needs. Don't load the whole PRD on every turn; follow the phase prompt's reference list.

## Working directory

Repo lives at `C:\Users\jonlu\code\amoura`.

**Do not** work from `C:\Users\jonlu\OneDrive\Desktop\Amoura` — that path is OneDrive-synced, which locks files during `npm install` and creates sync conflicts with `node_modules`. The OneDrive copies are vestigial backups of `docs/` and brand assets.

Shell is **bash on Windows** (Git Bash-style). Use forward slashes in paths: `/c/Users/jonlu/code/amoura`.

## Stack quirks learned the hard way in Phase 0

Things that will silently break the build if changed. Preserve them.

- **`.npmrc` sets `legacy-peer-deps=true`.** Required for Expo's loose peer-dep graph under npm 7+. Removing it makes `npm install` fail with ERESOLVE errors.
- **`babel-preset-expo` must be an explicit `devDependency`.** Otherwise npm nests it inside `node_modules/expo/node_modules/` and Babel cannot resolve it. Symptom: Expo Router's `EXPO_ROUTER_APP_ROOT` isn't replaced in `_ctx.android.js`, Metro fails with `Invalid call at require.context`.
- **Reanimated v4 needs a companion package.** `react-native-worklets` is installed and `react-native-worklets/plugin` is registered in `babel.config.js` as the **last** plugin. Do NOT add `react-native-reanimated/plugin` — that was v2/v3, v4 uses the worklets plugin only.
- **Clerk pulls `expo-auth-session` + `expo-crypto`.** Even if SSO isn't actively called; they're imported at module load. Both are native modules, so adding/removing them requires a new EAS build.
- **Clerk has dead-code `react-dom` imports.** `@clerk/clerk-react` ships a `useCustomElementPortal` hook that imports `react-dom`; Metro still has to resolve it. `react-dom@19.1.0` is installed as a devDependency to satisfy this (it's never executed at runtime).
- **PostHog is on the EU region.** `src/providers/AnalyticsProvider.tsx` points at `https://eu.i.posthog.com`. Do not change to `us.i.posthog.com` — events will be silently dropped.
- **Convex `_generated/` is gitignored** and regenerated on `npx convex dev`. Do not commit it.
- **Convex must be run from the project root**, not from `C:\Users\jonlu\`. Running `npx convex dev` in the wrong directory scaffolds stray files in the home dir and refuses to push.

## Patterns to preserve

- **Bootstrap-friendly providers.** `src/providers/{ClerkProvider,ConvexProvider,AnalyticsProvider}.tsx` each check for their env key and gracefully no-op if missing (rendering children directly). This lets the app boot for UI QA while keys are being provisioned. Don't "fix" this — it's intentional.
- **Typed env reader.** `src/lib/env.ts` has a `required()` helper for truly-required values (Convex URL) and optional getters for the rest. Follow the same pattern for new env vars.
- **Design-token class names are frozen.** `tailwind.config.js` uses `plum-*`, `cream-*`, `rose-*`, `peach-*` as class names. The hex values behind them are logo-derived (cool violet + coral-pink, see below). Do not rename the classes; just update the hex if the palette shifts again.

## Brand / design decisions that diverge from the docs

- **Palette is logo-derived, not vision-doc-derived.** `docs/product-vision.md § 5` specifies a warm plum/cream palette. Jon-Luke chose to override with the logo's cool violet/magenta/coral gradient. `tailwind.config.js` has a comment at the top documenting this. Logo source: `assets/IconOnly_Transparent_NoBuffer.png` (icon) and `assets/FullLogo_Transparent_NoBuffer.png` (wordmark). Splash + adaptive-icon `backgroundColor` is `#FAFAFF` (pale lavender).
- **Icons are Lucide, not Phosphor.** `docs/product-vision.md § 5` says Phosphor; the roadmap and implementation use `lucide-react-native`. Close enough vibe-wise. Flag for polish if a Phase 7 brand review wants it swapped.
- **Sign-in buttons are placeholders.** `app/(auth)/sign-in.tsx` routes directly to `/(tabs)/browse` without invoking Clerk OAuth. Real OAuth lands in Phase 1 TASK-017.

## Services & identifiers

| Service | Identifier | Notes |
|---|---|---|
| Convex deployment | `adjoining-axolotl-190` | EU region (`eu-west-1`). HTTP URL ends `.convex.site`, queries end `.convex.cloud`. |
| Clerk instance | `unified-raptor-26.clerk.accounts.dev` | JWT template named `convex`. Webhook endpoint registered for `user.created/updated/deleted`. |
| PostHog project | `163434` | EU region. |
| EAS project | `e7a7022d-86df-4588-ad13-e8cce39aebbe` | In `app.config.ts > extra.eas.projectId`. |
| GitHub | `jonluke0897-collab/amoura` | Phase 0 merged via PR #1. |

Secrets (Clerk webhook secret, Clerk JWT issuer domain) live in **Convex env**, not the repo — set with `npx convex env set NAME VALUE`.

`EXPO_PUBLIC_*` values live in `.env` (gitignored). `.env.example` lists required keys. EAS reads `.env` at build time (`.easignore` excludes `docs/`, `vision.json`, `convex/_generated/` — NOT `.env`).

## Advisor gate (non-negotiable)

Per [product-roadmap.md TASK-025](docs/product-roadmap.md) and the product principle in `docs/product-vision.md § 1`:

> **No phase that touches user-facing copy ships without written sign-off from at least one paid trans advisor.**

This applies to: onboarding copy, identity field options, respect pledge (both versions), prompt library, error/empty states, paywall copy, moderation messages, and all marketing. Placeholder prompts in `convex/seed.ts` are tagged `createdBy: "amoura-placeholder"` for easy identification and swap-out.

## Git + identity

Jon-Luke's git identity (`Jon-Luke Bloomfield` / `jonluke0897@gmail.com`) is passed via `GIT_AUTHOR_*` / `GIT_COMMITTER_*` env vars per commit. Global git config is intentionally not modified. Commits use:

```bash
GIT_AUTHOR_NAME="Jon-Luke Bloomfield" GIT_AUTHOR_EMAIL="jonluke0897@gmail.com" \
GIT_COMMITTER_NAME="Jon-Luke Bloomfield" GIT_COMMITTER_EMAIL="jonluke0897@gmail.com" \
git commit -m "..."
```

Branch per phase: `phase-N/<slug>`, PR to `main`. CodeRabbit review expected before merge on Phases 1, 5, 7 per the roadmap.

## Native-rebuild cadence

JS/style/component changes → Metro hot reload (no rebuild). Native changes → `eas build --profile development --platform android` (~10-15 min cloud queue).

| Upcoming phase | Native modules added | Rebuild needed? |
|---|---|---|
| Phase 1 — onboarding | none | ❌ Metro only |
| Phase 2 — photos + audio | `expo-image-picker`, `expo-image-manipulator`, `expo-av` | ✅ |
| Phase 3 — browse | `expo-location` | ✅ |
| Phase 4 — messaging | `react-native-onesignal` | ✅ |
| Phase 5 — verification | `@persona/embedded-sdk-react-native` | ✅ |
| Phase 6 — subscription | `react-native-purchases` | ✅ |
| Phase 7 — polish | `@sentry/react-native` | ✅ |

## What a typical session should do

1. Read this file (already happening).
2. Read `docs/product-roadmap.md` and find the first unchecked task.
3. Read ONLY the reference sections that task's phase prompt names — not the whole PRD.
4. Execute tasks, marking `[ ]` → `[x]` as they're verified end-to-end (not just written).
5. When the phase is done, create `phase-N/<slug>` branch, push, open PR.

Do not start new phases without finishing the current one. Do not re-plan scope that's already in the roadmap unless the user explicitly asks.
