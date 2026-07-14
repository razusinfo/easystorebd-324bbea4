# EasyStore

## Local development & pushing to GitHub

### 1. Install dependencies
```bash
npm install --legacy-peer-deps
```

### 2. Start the dev server
```bash
npm run dev
```
Open http://localhost:8080

### 3. One-click verify (install + build)
Run this before every push to make sure the app builds cleanly:
```bash
npm run verify
```
This runs `scripts/verify-and-push.sh` which installs deps, builds the project, and confirms `dist/` was produced. If any step fails the script exits non-zero and you'll see the exact error.

### 4. Push to GitHub safely
```bash
git status                       # review changes
git add -A
git commit -m "your message"
git pull --rebase origin main    # sync with remote first
git push origin main
```

Every push and PR to `main` also runs `.github/workflows/build.yml` (npm install + build) and `.github/workflows/ci.yml`. Errors surface in the GitHub **Checks** tab — do not merge red checks.

---


## cPanel Deployment

This repo deploys to cPanel via Git Version Control using `.cpanel.yml`.

### Expected directory

- **cPanel user home**: `/home/easystore/`
- **Web root (DEPLOYPATH)**: `/home/easystore/public_html/`

`DEPLOYPATH` is exported inside `.cpanel.yml` and consumed by the copy task:

```yaml
deployment:
  tasks:
    - export DEPLOYPATH=/home/easystore/public_html/
    - /bin/cp -R dist/. $DEPLOYPATH
```

### Required folder after build

Before cPanel's deploy tasks run, the built assets must exist at the repo root under `dist/` (Vite's output). Run `bun run build` (or `npm run build`) locally / in CI to produce it. Only the contents of `dist/` are copied to `public_html/` — the repo source is not served.

### CI safeguards

`.github/workflows/ci.yml` validates `.cpanel.yml` syntax and runs the full build before any deploy step, so a broken build never reaches cPanel.
