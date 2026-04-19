# Pi Web Mobile

Pi Web Mobile adalah antarmuka mobile-first untuk pengalaman chat `pi` di web, dengan fokus pada:

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
