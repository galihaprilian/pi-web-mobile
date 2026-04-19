# Short-term Improvements

Dokumen ini berisi improvement jangka pendek yang realistis dan bernilai tinggi untuk iterasi berikutnya.

## 1. Stabilitas Session Pi

### Prioritas
Tinggi

### Item
- sinkronisasi rename title ke session `pi`
- validasi append message ke session `pi` pada edge case tertentu
- tampilkan source session lebih jelas di history
- tambah fallback handling saat session file berubah dari luar app

## 2. UX History

### Prioritas
Tinggi

### Item
- filter history: `all`, `pi`, `browser`
- search session berdasarkan title/preview
- tampilkan timestamp lebih friendly
- tampilkan project aktif lebih menonjol di history sheet

## 3. UX Composer

### Prioritas
Tinggi

### Item
- perbaiki reset input di semua kondisi kirim
- validasi state tombol send/stop lebih eksplisit
- optional send feedback state kecil saat request dimulai
- keyboard/paste flow untuk mobile browser

## 4. Thinking UX

### Prioritas
Sedang

### Item
- auto-scroll behavior yang lebih halus saat streaming thinking
- simpan state expand/collapse thinking per message
- style working/thinking lebih konsisten dengan CLI feel
- optional toggle show/hide thinking globally

## 5. Settings UX

### Prioritas
Sedang

### Item
- ubah settings menjadi mobile-first custom UI penuh
- satukan auth/model/provider di satu flow yang lebih sederhana
- tampilkan status auth provider lebih informatif

## 6. Debug & Diagnostics

### Prioritas
Sedang

### Item
- persistent debug toggle via localStorage
- tombol copy diagnostics
- last error panel yang lebih readable
- network/provider troubleshooting hints

## 7. Product/Repo Hygiene

### Prioritas
Sedang

### Item
- initialize git repo lokal
- set remote ke `galihaprilian/pi-web-mobile`
- tambah issue template internal sederhana
- rapikan naming package dan app metadata secara menyeluruh

## 8. Integrasi Lanjutan

### Prioritas
Rendah untuk jangka pendek

### Item
- riset format session Claude
- riset format session Copilot non-`pi`
- siapkan abstraction importer lintas agent

## Rekomendasi Urutan Eksekusi

1. stabilitas session `pi`
2. UX history
3. UX composer
4. settings mobile custom
5. debug persistence
6. riset agent lain
