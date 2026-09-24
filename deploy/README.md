# deploy/

| Path | Purpose |
|---|---|
| `nginx/game.conf.example` | nginx server block: atomic `current` root, caching, gzip, security headers, CSP, fallback |
| `scripts/build.sh` | tests + production build + `.deploy-local/release-<id>.tar.gz` |
| `scripts/deploy.sh` | upload + unpack into `releases/<id>` + atomic `current` switch + prune (`--local`, `--dry-run`) |
| `scripts/rollback.sh` | switch `current` to the previous (or named) release |
| `scripts/health-check.sh` | post-deploy HTTP checks (index, MIME, caching, no source maps) |
| `systemd/` | not needed: nginx runs as the distribution service or in Docker |

Full instructions: [../DEPLOYMENT.md](../DEPLOYMENT.md). Local end-to-end validation: `npm run test:deploy`.
