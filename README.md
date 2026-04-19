# Pi Web Mobile

[![CI](https://github.com/galihaprilian/pi-web-mobile/actions/workflows/ci.yml/badge.svg)](https://github.com/galihaprilian/pi-web-mobile/actions/workflows/ci.yml)
[![Release Build](https://github.com/galihaprilian/pi-web-mobile/actions/workflows/release.yml/badge.svg)](https://github.com/galihaprilian/pi-web-mobile/actions/workflows/release.yml)


Pi Web Mobile adalah antarmuka mobile-first untuk pengalaman chat `pi` di web, dengan fokus pada:

Repository:
- GitHub: `galihaprilian/pi-web-mobile`
- URL: https://github.com/galihaprilian/pi-web-mobile


- penggunaan dari HP / browser mobile
- auth subscription yang berbagi session dengan `pi` coding agent
- pembacaan session `pi` per project
- composer sticky di bawah dan header sticky di atas
- model picker dan project picker bergaya mobile sheet

## Status saat ini

Sudah tersedia:

- UI chat mobile-first custom
- session browser lokal
- membaca session `pi` dari `~/.pi/agent/sessions`
- melanjutkan session `pi` yang sama dari web
- auth sharing dengan `pi` dari `~/.pi/agent/auth.json`
- login subscription via UI
- transport chat server-side untuk provider subscription seperti GitHub Copilot
- project picker di bawah folder home
- Makefile untuk development lokal / Tailscale

## Menjalankan

```bash
npm install
make start
```

Atau langsung dengan Vite:

```bash
npm run dev
```

## Menjalankan dari folder manapun dengan `piwebmo`

Setelah instalasi lokal, kamu bisa menjalankan:

```bash
cd /path/ke/project
piwebmo
```

Perilaku:
- service Pi Web Mobile akan restart
- folder saat perintah dijalankan menjadi **default project** saat web pertama dibuka
- jika perintah dijalankan dari folder di luar home, app akan meminta pilih project dulu

Alias berikut juga tersedia:

```bash
piwebmon
```

Untuk memasang command + systemd user service:

```bash
./scripts/install-local.sh
```

Command operasional tambahan:

```bash
piwebmo-status              # lihat status service + runtime state
piwebmo-status --json       # output status dalam JSON
piwebmo-status --watch      # refresh status terus (default interval 2 detik)
piwebmo-status --watch --interval 1
piwebmo-stop                # stop service
piwebmo-open                # buka URL Tailscale app
piwebmo-open --local        # buka http://localhost:<port>
piwebmo-doctor              # diagnosa setup (systemd, linger, command, port, health)
```

Catatan runtime service:
- default mode: `preview` (build + vite preview, lebih production-like)
- override ke mode dev bila perlu:

```bash
PIWEBMO_RUNTIME_MODE=dev ./scripts/install-local.sh
```

Health check endpoint tersedia di:

```text
GET /api/health
```

## Akses dari mobile / Tailscale

Untuk penggunaan via Tailscale:

```bash
make mobile
```

Default URL:

```text
http://work01.tucuxi-dace.ts.net:5173
```

## Perintah Makefile penting

```bash
make start          # start dev server untuk network access
make mobile         # print URL mobile + start dev server
make start-bg       # start di background
make restart        # restart dev server background
make logs           # lihat log dev server
make status         # cek status server
make stop           # stop semua background server
```

## Dokumentasi produk

Lihat folder `docs/`:

- `docs/PRODUCT_SPEC.md`
- `docs/ROADMAP.md`
- `docs/SHORT_TERM_IMPROVEMENTS.md`

## Artifact untuk sesi baru

Gunakan file berikut sebagai konteks kerja saat membuka sesi coding baru:

- `AGENTS.md`
- `CLAUDE.md`

## Struktur utama

```text
.
├── AGENTS.md
├── CLAUDE.md
├── Makefile
├── README.md
├── docs
│   ├── PRODUCT_SPEC.md
│   ├── ROADMAP.md
│   └── SHORT_TERM_IMPROVEMENTS.md
├── index.html
├── src
│   ├── app.css
│   ├── custom-messages.ts
│   ├── local-api.ts
│   ├── main.ts
│   ├── subscription-tab.ts
│   └── thinking-block-patch.ts
├── vite.config.ts
└── vite.local-api.ts
```

## Catatan

Repository lokal ini sudah disiapkan untuk menggunakan nama produk **Pi Web Mobile**.
Jika ingin dipush ke GitHub repository:

```text
galihaprilian/pi-web-mobile
```

remote Git juga bisa disiapkan secara lokal sesuai kebutuhan.
