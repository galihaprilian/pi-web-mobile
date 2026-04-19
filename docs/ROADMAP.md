# Roadmap — Pi Web Mobile

## Prinsip roadmap

- Prioritas 1: stabilitas mobile UX
- Prioritas 2: continuity dengan `pi` coding agent
- Prioritas 3: perluasan integrasi agent lain

---

## Phase 0 — Foundation Stabilization

### Status
Sedang berjalan / sebagian besar sudah ada.

### Deliverables
- [x] custom mobile chat shell
- [x] sticky header
- [x] sticky composer/footer
- [x] custom model sheet
- [x] custom project sheet
- [x] debug bar toggle
- [x] auth sharing dari `~/.pi/agent/auth.json`
- [x] session history `pi` + browser
- [x] server-side transport untuk subscription provider

### Fokus
- menghilangkan bug UX dasar
- memastikan chat flow stabil
- menjaga mobile-first behavior

---

## Phase 1 — Pi Continuity Experience

### Tujuan
Membuat Pi Web Mobile terasa benar-benar menyatu dengan `pi` coding agent.

### Deliverables
- [ ] sinkronisasi rename title ke session `pi`
- [ ] filter history: all / browser / pi
- [ ] badge session source yang lebih jelas
- [ ] restore posisi/history context lebih baik
- [ ] project-aware session behavior yang lebih konsisten
- [ ] metadata sync tambahan untuk session `pi`

### Outcome
User dapat berpindah CLI ↔ mobile dengan friction minimum.

---

## Phase 2 — Better Mobile UX

### Tujuan
Meningkatkan kualitas interaksi mobile sampai terasa polished.

### Deliverables
- [ ] gesture-friendly sheets
- [ ] transisi/animasi bottom sheet lebih halus
- [ ] composer behavior lebih matang
- [ ] better keyboard handling di mobile browser
- [ ] improved thinking presentation
- [ ] setting screens full mobile-native style
- [ ] unified history/project switcher sheet

### Outcome
Pengalaman mobile terasa seperti produk yang memang didesain untuk HP, bukan port dari desktop.

---

## Phase 3 — Settings & Session Productization

### Tujuan
Menjadikan produk lebih siap dipakai harian.

### Deliverables
- [ ] full custom settings UI
- [ ] persistent debug preferences
- [ ] preference management per device
- [ ] empty/loading/error states yang lebih baik
- [ ] session search
- [ ] session actions: duplicate, archive, remove from browser

---

## Phase 4 — Additional Agent Integrations

### Tujuan
Membuka kemungkinan membaca session dari agent lain.

### Deliverables
- [ ] research adapter Claude / Claude Code
- [ ] research adapter Copilot session formats
- [ ] importer architecture untuk agent eksternal
- [ ] source normalization layer lintas agent

### Catatan
Phase ini baru masuk setelah format file/session agent lain benar-benar tersedia dan tervalidasi.

---

## Phase 5 — Packaging & Distribution

### Tujuan
Merapikan proyek agar siap menjadi repo yang mudah di-clone dan dijalankan.

### Deliverables
- [ ] git repository initialization lengkap
- [ ] GitHub Actions basic CI
- [ ] setup docs yang lebih lengkap
- [ ] release notes template
- [ ] environment/setup checklist
- [ ] optional Docker/devcontainer support

---

## Long-term Vision

Pi Web Mobile menjadi:
- companion mobile resmi/tidak resmi untuk `pi`
- jembatan antara CLI dan mobile browser
- shell mobile untuk auth + session continuity + lightweight chat operations
