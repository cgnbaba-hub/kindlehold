# deploy/

| Path | Purpose |
|---|---|
| `nginx/game.conf.example` | nginx server block: atomic `current` root, caching, gzip, security headers, CSP, fallback |
| `scripts/build.sh` | tests + production build + `.deploy-local/release-<id>.tar.gz` |
| `scripts/deploy.sh` | upload + unpack into `releases/<id>` + atomic `current` switch + prune (`--local`, `--dry-run`) |
| `scripts/rollback.sh` | switch `current` to the previous (or named) release |
| `scripts/health-check.sh` | post-deploy HTTP checks (index, MIME, caching, no source maps) |
| `scripts/auto-deploy.sh` | VPS: deploy the newest GitHub `main` when it changed (tests, build, atomic switch, health check, rollback) |
| `scripts/install-auto-deploy.sh` | VPS: install or remove the 5-minute systemd timer that runs `auto-deploy.sh` |
| `systemd/` | the auto-deploy service and timer (templates; `install-auto-deploy.sh` fills them in) |

Full instructions: [../DEPLOYMENT.md](../DEPLOYMENT.md). Local end-to-end validation: `npm run test:deploy`.
