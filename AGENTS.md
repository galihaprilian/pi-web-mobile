# AGENTS.md — Pi Web Mobile Working Context

Dokumen ini menjadi konteks utama saat memulai sesi baru di repository **Pi Web Mobile**.

## Product Identity

- Product name: **Pi Web Mobile**
- Repository target: `galihaprilian/pi-web-mobile`
- Positioning: mobile-first web companion untuk `pi` coding agent

## Product Goals

1. membuat pengalaman `pi` nyaman di browser mobile
2. berbagi auth dengan `pi` coding agent
3. membaca dan melanjutkan session `pi`
4. menjaga UX tetap mobile-first

## Core Constraints

- header harus stay on top
- composer/footer harus stay on bottom
- hanya content yang scroll
- project selection hanya boleh di bawah home directory
- auth utama diambil dari `~/.pi/agent/auth.json`
- session `pi` utama diambil dari `~/.pi/agent/sessions`
- provider subscription sebaiknya lewat server-side transport, bukan browser direct mode

## Current Architecture

### Frontend
- `src/main.ts` berisi shell utama aplikasi
- `src/app.css` berisi styling mobile-first utama
- `src/local-api.ts` berisi helper client-side ke local API
- `src/subscription-tab.ts` berisi settings tab untuk subscription login
- `src/thinking-block-patch.ts` berisi patch runtime untuk thinking block UI

### Local API
- `vite.local-api.ts`
- menangani:
  - OAuth provider status/login/logout
  - project listing
  - pi session listing/loading/appending
  - server-side chat stream

## UX Principles

- mobile-first, desktop-second
- bottom sheet untuk selector utama
- continuity dengan `pi` CLI/TUI
- minimum friction untuk user mobile
- debug info harus bisa disembunyikan

## Engineering Rules

- prioritaskan perubahan di project sendiri daripada patch permanen di `node_modules`
- kalau perlu override perilaku library, lakukan lewat patch runtime / wrapper dari `src/`
- hindari memecah pengalaman mobile dengan komponen desktop-centric
- setiap perubahan UX besar harus diuji terhadap sticky header/footer dan scroll area

## Important Files

- `README.md`
- `docs/PRODUCT_SPEC.md`
- `docs/ROADMAP.md`
- `docs/SHORT_TERM_IMPROVEMENTS.md`

## Current Known Priorities

1. stabilitas session `pi`
2. polish history UX
3. settings custom mobile-first
4. composer & thinking UX polish

## Desired Behavior for New Work

Saat memulai tugas baru:
- baca `docs/PRODUCT_SPEC.md`
- pastikan usulan perubahan tetap mobile-first
- jangan mengorbankan continuity dengan `pi` coding agent
- untuk provider subscription, utamakan server-side transport

## Definition of Done for UI Changes

- layout tetap mobile-first
- header/footer sticky tetap aman
- content tetap bisa scroll
- flow chat tetap berfungsi
- `npm run check` harus lolos
