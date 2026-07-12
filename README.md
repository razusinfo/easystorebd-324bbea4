# EasyStore

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
