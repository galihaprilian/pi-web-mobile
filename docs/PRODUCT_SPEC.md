# Product Specification — Pi Web Mobile

## 1. Ringkasan

Pi Web Mobile adalah aplikasi web mobile-first untuk mengakses pengalaman chat `pi` dari browser, terutama di perangkat mobile. Produk ini menjembatani pengalaman `pi` coding agent (TUI/CLI) ke UI web yang nyaman dipakai dari HP tanpa kehilangan konteks auth, project, dan session.

## 2. Tujuan Produk

### Tujuan utama
- Memberikan pengalaman `pi` yang nyaman di mobile browser.
- Memakai auth yang sama dengan `pi` coding agent.
- Membuka dan melanjutkan session `pi` yang sama dari UI web.
- Menjadikan mobile sebagai prioritas layout dan interaksi.

### Tujuan sekunder
- Menjadi lapisan UI untuk provider subscription yang sulit dipakai langsung dari browser.
- Menjadi dasar untuk pengalaman multi-device yang ringan melalui local server + Tailscale.

## 3. Persona Pengguna

### 3.1 Solo developer mobile-heavy
- Sering memonitor atau melanjutkan session dari HP.
- Ingin akses cepat ke model, project, dan session history.

### 3.2 Developer yang memakai `pi` sebagai daily driver
- Sudah login subscription di CLI.
- Ingin web UI tanpa harus login ulang.

### 3.3 Developer remote via Tailscale
- Menjalankan server di laptop/dev machine.
- Mengakses lewat HP menggunakan alamat Tailscale.

## 4. Masalah yang Diselesaikan

- UI TUI/CLI `pi` tidak ideal di browser mobile.
- Provider subscription tertentu tidak cocok dengan browser direct mode.
- Session dan auth tersebar antara CLI dan web.
- UX model/project/session switching di mobile membutuhkan bottom-sheet yang natural.

## 5. Solusi Produk

Pi Web Mobile menyediakan:

- chat panel mobile-first custom
- sticky top header dan bottom composer
- scroll hanya di area content
- model picker mobile sheet
- project picker mobile sheet
- session history sheet gabungan:
  - browser sessions
  - `pi` sessions
- auth sharing dari `~/.pi/agent/auth.json`
- server-side chat transport untuk provider subscription

## 6. Fitur Saat Ini

### 6.1 Chat UI
- header sticky
- composer sticky
- message area scrollable
- custom message rendering
- thinking block dengan expand/collapse
- debug panel toggle

### 6.2 Auth
- membaca auth dari `~/.pi/agent/auth.json`
- login subscription via UI
- provider login muncul di picker model

### 6.3 Session
- browser-local session storage
- membaca session `pi` dari `~/.pi/agent/sessions`
- membuka session `pi`
- melanjutkan dan append ke session `pi` yang sama

### 6.4 Project
- browse folder hanya di bawah home directory
- memilih project aktif untuk filtering session

### 6.5 Transport
- browser → local API → provider
- cocok untuk provider subscription yang gagal di browser direct mode

## 7. Batasan Saat Ini

- Belum membaca session dari Claude / Claude Code / Copilot non-`pi`.
- Sinkronisasi session `pi` belum 100% setara TUI untuk semua edge case tree/branching.
- Settings dan history masih bisa dipoles lebih jauh untuk konsistensi mobile.
- Belum ada persistent preference lengkap untuk semua toggle UI.

## 8. Prinsip UX

### Mobile-first
- Semua keputusan layout dimulai dari mobile.
- Desktop hanyalah adaptasi dari mobile layout.

### Bottom-sheet first
- Pilihan model, project, dan history memakai pola bottom sheet.

### Continuity dengan CLI
- Auth, session, dan istilah harus konsisten dengan pengalaman `pi` coding agent.

### Low-friction
- Pengguna tidak perlu login ulang jika sudah login di `pi`.
- Switching project dan session harus singkat.

## 9. Arsitektur Tingkat Tinggi

### Frontend
- Lit + komponen `pi-web-ui` yang dipilih seperlunya
- custom mobile chat shell
- custom sheets untuk interaksi mobile

### Local API
- berjalan melalui Vite plugin di Node environment
- menangani:
  - auth access
  - OAuth flow
  - project listing
  - session listing/loading/appending
  - server-side model streaming

### Shared runtime data
- auth: `~/.pi/agent/auth.json`
- pi sessions: `~/.pi/agent/sessions/...`
- browser sessions: IndexedDB

## 10. Definisi Sukses

### UX success
- Pengguna bisa membuka web UI dari HP dan mulai chat dalam < 10 detik.
- Pengguna bisa melanjutkan session `pi` yang sama tanpa login ulang.

### Technical success
- Provider subscription seperti GitHub Copilot bisa berjalan lewat server-side transport.
- Session `pi` bisa dibaca dan dilanjutkan dengan aman.

### Product success
- Pi Web Mobile terasa seperti companion mobile resmi untuk `pi`.

## 11. Non-Goals Saat Ini

- Bukan pengganti penuh semua fitur TUI `pi`.
- Bukan sinkronisasi multi-user atau cloud-native product.
- Bukan editor file penuh di browser.

## 12. Nama Produk

Nama produk resmi untuk aplikasi ini adalah:

**Pi Web Mobile**
