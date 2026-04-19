# CLAUDE.md

Gunakan `AGENTS.md` sebagai sumber konteks utama untuk repository ini.

## Ringkasan cepat

Produk ini adalah **Pi Web Mobile**:
- mobile-first web UI untuk `pi` coding agent
- berbagi auth dengan `pi`
- dapat membaca dan melanjutkan session `pi`
- menggunakan server-side transport untuk provider subscription

## Saat memulai sesi baru

1. baca `AGENTS.md`
2. baca `docs/PRODUCT_SPEC.md`
3. cek `docs/ROADMAP.md` bila perubahan menyentuh arah produk
4. cek `docs/SHORT_TERM_IMPROVEMENTS.md` untuk perbaikan jangka pendek

## Prinsip penting

- mobile-first
- continuity dengan `pi`
- jangan patch `node_modules` jika bisa dihindari
- pastikan chat flow tetap jalan
- jalankan `npm run check` setelah perubahan
