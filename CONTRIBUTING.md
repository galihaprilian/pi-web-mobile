# Contributing to Pi Web Mobile

Terima kasih sudah berkontribusi ke **Pi Web Mobile**.

## Prinsip umum

- utamakan **mobile-first UX**
- jaga continuity dengan **pi coding agent**
- hindari patch permanen di `node_modules`
- perubahan harus menjaga:
  - header tetap sticky
  - composer tetap di bawah
  - content tetap scrollable

## Sebelum mulai

Baca dokumen berikut:

- `AGENTS.md`
- `docs/PRODUCT_SPEC.md`
- `docs/ROADMAP.md`
- `docs/SHORT_TERM_IMPROVEMENTS.md`

## Setup lokal

```bash
npm install
make start
```

Atau:

```bash
npm run dev
```

## Quality checks

Sebelum commit / PR:

```bash
npm run check
npm run build
```

## Scope perubahan yang disarankan

Cocok untuk kontribusi:
- mobile UI polish
- history/session UX
- auth/provider UX
- docs
- diagnostics/debugging
- session continuity improvements

Perubahan besar sebaiknya diawali dengan diskusi issue jika menyentuh:
- arsitektur transport
- integrasi agent eksternal
- format session lintas provider

## Style kontribusi

- buat perubahan sekecil mungkin tapi lengkap
- jelaskan alasan perubahan di commit/PR
- bila ada perubahan UX, sertakan screenshot / deskripsi before-after
- bila ada edge case, dokumentasikan di PR

## Struktur penting

- `src/main.ts` → shell utama app
- `src/app.css` → styling utama mobile-first
- `src/local-api.ts` → client helper ke local API
- `vite.local-api.ts` → Node/local API server bridge
- `AGENTS.md` → context kerja repo

## Issue & PR

Untuk issue gunakan template di `.github/ISSUE_TEMPLATE/`.

Untuk PR, idealnya sertakan:
- ringkasan perubahan
- alasan perubahan
- area terdampak
- hasil `npm run check`
- hasil `npm run build`
