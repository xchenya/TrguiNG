## Project Overview

TrguiNG - Transmission remote control GUI (Tauri desktop + standalone web app).

- **Frontend**: React 18 + TypeScript + Mantine UI v6 + Webpack
- **Backend**: Rust (Tauri v1) with hyper, tokio, lava_torrent
- **Dual mode**: Desktop (Tauri) or web-only (no Tauri API)
- **Language**: Chinese UI strings hardcoded (not i18n)

## Development Commands

```bash
npm run webpack-serve     # Dev server localhost:8080 (HMR) - web only
npm run webpack-prod      # Production build (output: dist/)
npm run tauri-dev         # Full Tauri dev mode
npm run build             # Production Tauri build
```

No test suite exists. No lint/typecheck scripts defined - run ESLint directly if needed.

## Architecture

### Entry Points
- `src/index.tsx` — Main entry, detects `window.__TAURI__` to render `TauriApp` or `WebApp`
- `src/createtorrent.tsx` — "Create torrent" webview window (separate entry)

### Key Files
- `src/components/server.tsx` — Main server view, orchestrates all panels
- `src/components/splitlayout.tsx` — Resizable split panels (react-split)
- `src/components/tables/torrenttable.tsx` — Main torrent list (794 lines, @tanstack/react-table + virtual)
- `src/components/tables/common.tsx` — Shared table infrastructure (716 lines)
- `src/components/toolbar.tsx` — Action buttons bar (461 lines)
- `src/components/filters.tsx` — Left sidebar filters (774 lines)
- `src/components/details.tsx` — Bottom details panel (522 lines)
- `src/components/modals/settings.tsx` — Settings modal
- `src/config.ts` — Config management, localStorage (web) or OS config dir (Tauri)

### Dual Mode
`src/taurishim.ts` exports stubs in non-Tauri env. `TAURI` constant controls code paths. Tauri imports use dynamic `import()` with `webpackMode: "lazy-once"`.

## Code Conventions

- **Indent**: 4 spaces (ESLint enforced)
- **Quotes**: Double quotes (ESLint enforced)
- **Semicolons**: Always required
- **Trailing commas**: `always-multiline`
- **Type imports**: Use `import type { X }` (ESLint enforced)
- **TypeScript baseUrl**: `src/` — imports like `import { X } from "components/app"`

## Build Gotchas

- `webpack.common.js` uses top-level `await` — needs `experiments.topLevelAwait: true` and ESM (`"type": "module"`)
- `webpack.common.js` runs `git describe --tags` at build time — fails without `.git` or tags
- Tauri `beforeBuildCommand` is `npm run webpack-prod` — webpack runs before Rust compilation
- `tauri.conf.json` `distDir` points to `../dist` (relative to `src-tauri/`)

## Mobile Adaptation (Current Focus)

### Current Desktop Layout
```
┌─────────────────────────────────────────────┐
│ Toolbar (action buttons + search)           │
├──────────┬──────────────────────┬───────────┤
│ Filters  │ Torrent Table        │ Details   │
│ Panel    │ (virtualized)        │ Panel     │
│          │                      │           │
├──────────┴──────────────────────┴───────────┤
│ Status Bar                                  │
└─────────────────────────────────────────────┘
```

### Key Adaptation Points

1. **SplitLayout** (`src/components/splitlayout.tsx`):
   - Uses `react-split` for resizable panels
   - On mobile: collapse to single column, hide filters by default
   - `showFiltersPanel`, `showDetailsPanel`, `mainSplit` state in `server.tsx`

2. **TorrentTable** (`src/components/tables/torrenttable.tsx`):
   - @tanstack/react-table with @tanstack/react-virtual for virtualization
   - 20+ columns defined in `AllFields` array
   - On mobile: show only name + status, hide most columns

3. **Toolbar** (`src/components/toolbar.tsx`):
   - Many action buttons (add, start, pause, remove, queue, priority, etc.)
   - On mobile: condense into dropdown menu or bottom action bar

4. **Filters** (`src/components/filters.tsx`):
   - Left sidebar with status/directory/label/tracker/error sections
   - On mobile: use Mantine Drawer or collapse completely

5. **Details** (`src/components/details.tsx`):
   - Bottom panel with tabs (general, files, pieces, peers, trackers, etc.)
   - On mobile: full-screen modal or bottom sheet

6. **Modals** (`src/components/modals/`):
   - Settings, add torrent, edit trackers, etc.
   - On mobile: full-screen modals

### Mantine v6 Responsive Tools Available
- `useMediaQuery` hook from `@mantine/hooks`
- `SimpleGrid`, `Grid` with responsive `cols`/`span`
- `AppShell` for mobile layout structure
- `Drawer` for mobile menus/filters
- `Modal` with `fullScreen` prop
- `Burger` for hamburger menu
- Responsive `hidden`/`visible` props on components

### CSS Considerations
- `src/css/custom.css` — Global styles, split panel gutters
- `src/css/torrenttable.css` — Table layout, virtual scrolling
- Current CSS uses fixed sizes, no media queries
- `react-resize-detector` available for component-level resize detection

## Config Structure

`trguing.json` stores:
- `servers[]` — Connection configs
- `interface` — UI state (panel visibility, column sizes, theme, font size)
- `app` — Window state, toast notifications, tray icon

Config loaded at startup in `src/index.tsx`, passed via React Context.

## UI String Language

All UI strings are Chinese (e.g., "隐藏", "退出", "添加种子"). Language is hardcoded, not i18n.

## Recent Features (260803a)

- Ignore errors feature (glob pattern matching in settings)
- Ignore errors toggle (context menu + settings panel)
- Tooltip localization
- webpack-cli v7 upgrade for ESM top-level await
