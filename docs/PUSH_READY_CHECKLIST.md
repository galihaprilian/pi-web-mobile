# Push-ready Checklist

Gunakan checklist ini sebelum push ke GitHub `galihaprilian/pi-web-mobile`.

## Repository

- [ ] Remote origin mengarah ke `https://github.com/galihaprilian/pi-web-mobile.git`
- [ ] Branch aktif adalah `main`
- [ ] `.gitignore` sudah benar
- [ ] file temporary/log tidak ikut ter-commit

## Product identity

- [ ] nama produk konsisten: **Pi Web Mobile**
- [ ] `package.json` name sudah benar
- [ ] `index.html` title/meta sudah benar
- [ ] README sudah diperbarui

## Documentation

- [ ] `README.md` up to date
- [ ] `docs/PRODUCT_SPEC.md` tersedia
- [ ] `docs/ROADMAP.md` tersedia
- [ ] `docs/SHORT_TERM_IMPROVEMENTS.md` tersedia
- [ ] `AGENTS.md` tersedia
- [ ] `CLAUDE.md` tersedia
- [ ] `CHANGELOG.md` tersedia

## Quality

- [ ] `npm run check`
- [ ] `npm run build`
- [ ] basic mobile chat flow checked
- [ ] project picker checked
- [ ] model picker checked
- [ ] shared auth checked
- [ ] pi session loading checked

## GitHub hygiene

- [ ] issue templates tersedia
- [ ] release notes template tersedia
- [ ] initial commit message jelas

## Suggested commands

```bash
git status
npm run check
npm run build
git add .
git commit -m "Initialize Pi Web Mobile"
git push -u origin main
```
