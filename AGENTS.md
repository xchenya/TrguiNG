# AGENTS.md

## Project Overview

TrguiNG is a Tauri-based remote GUI for the Transmission torrent daemon. This is a Chinese-localized fork of [openscopeproject/TrguiNG](https://github.com/openscopeproject/TrguiNG) with additional features.

- **Frontend**: React 18 + TypeScript + Mantine UI v6 + Webpack
- **Backend**: Rust (Tauri v1) with hyper, tokio, lava_torrent
- **Dual mode**: Runs as desktop app (Tauri) or standalone web app (no Tauri APIs)

## Developer Commands

### Frontend only (no Tauri)
```bash
npm run webpack-serve     # Dev server at localhost:8080 (HMR)
npm run webpack-dev       # One-shot dev build
npm run webpack-prod      # Production build (output: dist/)
```

### Full Tauri app
```bash
npm run tauri-dev         # Dev mode: starts webpack dev server + Tauri
npm run build             # Production build: webpack-prod + Tauri bundle
npm run build-bin         # Build without bundling (no .deb/.msi/etc)
```

### Lint / Typecheck / Test
No scripts defined in package.json. ESLint config exists (`.eslintrc.json`) but no `npm run lint` script. Run manually:
```bash
npx eslint src/
npx tsc --noEmit          # Typecheck (uses tsconfig.json)
```

## Architecture

### Entry Points
- `src/index.tsx` — Main app entry. Renders either `TauriApp` or `WebApp` based on `window.__TAURI__` detection.
- `src/createtorrent.tsx` — Separate entry for the "Create Torrent" webview window.

### Key Directories
- `src/components/` — React components (app.tsx = Tauri UI, webapp.tsx = web UI)
- `src/rpc/` — Transmission RPC client (client.ts, torrent.ts, transmission.ts)
- `src-tauri/src/` — Rust backend (commands, IPC, poller, tray, torrent cache, GeoIP)
- `src/types/` — TypeScript type definitions
- `src/css/` — Stylesheets

### Dual-Mode Pattern
`src/taurishim.ts` exports stubs when running outside Tauri. The `TAURI` constant (`window.__TAURI__`) controls which code path is used. Tauri-specific imports are lazy-loaded via dynamic `import()` with `webpackMode: "lazy-once"`.

### Build Artifacts
- `src/build/version.json` — Generated at webpack build time by `webpack.common.js` (contains git version, backend version, build date). Listed in `.gitignore`.

## Code Conventions

### TypeScript / Frontend
- **Indentation**: 4 spaces (enforced by ESLint)
- **Quotes**: Double quotes (enforced)
- **Semicolons**: Always required
- **Trailing commas**: `always-multiline`
- **Type imports**: Use `import type { X }` (enforced via `consistent-type-imports` rule)
- **Member delimiters**: Commas (not semicolons) in interfaces/type literals
- **TypeScript baseUrl**: `src/` — imports like `import { X } from "components/app"` resolve from `src/`

### Rust Backend
- Edition 2021, MSRV 1.60
- Release profile: `panic = "abort"`, LTO enabled, optimize for size (`opt-level = "s"`)
- Uses `lava_torrent` from a git dependency: `https://github.com/openscopeproject/lava_torrent` branch `patches`

## Gotchas

- Webpack config (`webpack.common.js`) uses top-level `await` — requires `experiments.topLevelAwait: true` and ESM (`"type": "module"` in package.json).
- The `webpack.common.js` runs `git describe --tags` at build time — fails if `.git` is missing or no tags exist.
- Tauri `beforeBuildCommand` is `npm run webpack-prod` — webpack runs before Rust compilation.
- `tauri.conf.json` `distDir` points to `../dist` (relative to `src-tauri/`).
- Config file `trguing.json` is stored in OS config dir (Tauri) or localStorage (web).
- UI strings are in Chinese (e.g., "隐藏" = hide, "退出" = exit). Locale is hardcoded, not i18n-based.
