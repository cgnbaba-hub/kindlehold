# Deployment

Kindlehold builds to a static site (`dist/`) that nginx serves. The server keeps
several releases side by side and switches between them atomically:

```
/var/www/kindlehold/
├── releases/
│   ├── 20260924090359-2ad8efc/   (unpacked build)
│   └── 20260924101500-9c1f0e2/
├── current -> releases/20260924101500-9c1f0e2   (swapped with an atomic rename)
└── .previous                                    (used by rollback.sh)
```

Every command below was run against this repository. `npm run test:deploy` runs the
whole flow locally against the real nginx config inside Docker.

## 1. Local installation

```bash
git clone <your-repo-url> kindlehold && cd kindlehold
npm ci                      # Node 20+ (verified with Node 26.7, npm 11.19)
npx playwright install chromium   # only needed for verification/e2e scripts
```

## 2. Development mode

```bash
npm run dev                 # http://127.0.0.1:5180/
```

For remote development on the VPS, use an SSH tunnel: `ssh -L 5180:127.0.0.1:5180 my-vps`.

## 3. Tests

```bash
npm test                    # unit + integration + deterministic simulation (node:test)
npm run verify              # screenshot presets + JSON reports (Playwright, headless Chromium)
npm run test:e2e            # menu flow, tutorial happy path, save/load, error screen
npm run test:perf           # reference-scenario performance report
npm run test:deploy         # local nginx: atomic releases, rollback, headers, routing
```

## 4. Production build and preview

```bash
npm run build                               # -> dist/ (no source maps)
npm run preview                             # http://127.0.0.1:5181/
KINDLEHOLD_BASE=/kindlehold/ npm run build  # when hosting under a subpath
deploy/scripts/build.sh                     # tests + build + .deploy-local/release-<id>.tar.gz
```

## 5. First VPS deployment (Hostinger VPS, Ubuntu)

Prerequisites on the VPS (run once, as a sudo-capable user):

```bash
sudo apt update && sudo apt install -y nginx
sudo mkdir -p /var/www/kindlehold && sudo chown "$USER":"$USER" /var/www/kindlehold
```

From your workstation (SSH key access to the VPS configured as host alias `my-vps`
in `~/.ssh/config`; no credentials are stored in this repository):

```bash
deploy/scripts/build.sh
DEPLOY_HOST=my-vps DEPLOY_ROOT=/var/www/kindlehold deploy/scripts/deploy.sh --dry-run   # inspect
DEPLOY_HOST=my-vps DEPLOY_ROOT=/var/www/kindlehold deploy/scripts/deploy.sh
```

If you build directly on the VPS, deploy without SSH:

```bash
deploy/scripts/build.sh && DEPLOY_ROOT=/var/www/kindlehold deploy/scripts/deploy.sh --local
```

## 6. Nginx activation

```bash
sudo cp deploy/nginx/game.conf.example /etc/nginx/sites-available/kindlehold.conf
sudo nano /etc/nginx/sites-available/kindlehold.conf     # set server_name, check root path
sudo ln -s /etc/nginx/sites-available/kindlehold.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
deploy/scripts/health-check.sh http://your-domain/
```

For a subpath (`https://example.com/kindlehold/`), build with
`KINDLEHOLD_BASE=/kindlehold/` and use `location /kindlehold/ { alias /var/www/kindlehold/current/; try_files $uri $uri/ /kindlehold/index.html; }`
inside your existing server block.

**This VPS specifically:** ports 80/443 are not bound by a host nginx; public traffic
reaches services through the existing Cloudflare Tunnel (`cloudflared` service). To
publish Kindlehold here, run the nginx config in a container bound to
`127.0.0.1:<port>` (exactly as `scripts/deployment/validate-nginx.sh` does) and add a
public hostname for `http://localhost:<port>` in the Cloudflare Zero Trust dashboard.
That dashboard step needs the account owner and is the remaining manual action.

## 7. Subsequent deployments

```bash
git pull && deploy/scripts/build.sh
DEPLOY_HOST=my-vps DEPLOY_ROOT=/var/www/kindlehold HEALTH_URL=https://your-domain/ deploy/scripts/deploy.sh
```

Old releases beyond `KEEP_RELEASES` (default 5) are pruned; the active one never is.

## 8. Rollback

```bash
DEPLOY_HOST=my-vps DEPLOY_ROOT=/var/www/kindlehold deploy/scripts/rollback.sh             # previous
DEPLOY_HOST=my-vps DEPLOY_ROOT=/var/www/kindlehold deploy/scripts/rollback.sh <release-id> # specific
```

The switch is instant (symlink rename); no nginx reload is needed.

## 9. TLS prerequisites

A DNS A/AAAA record pointing to the VPS (or a Cloudflare proxied record / tunnel),
port 80 reachable for the HTTP-01 challenge, then:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain
```

Afterwards enable the commented `return 301` and `Strict-Transport-Security` lines.
With Cloudflare Tunnel, TLS terminates at Cloudflare and no certificate is needed on
the VPS.

## 10. Logs

```bash
sudo tail -f /var/log/nginx/kindlehold.access.log /var/log/nginx/kindlehold.error.log
docker logs -f <container>            # when nginx runs in Docker
sudo journalctl -u cloudflared -f     # when published through Cloudflare Tunnel
```

## 11. Troubleshooting

| Symptom | Check |
|---|---|
| Blank page, 404 for `/assets/*.js` | Built with the wrong base path. Rebuild with the correct `KINDLEHOLD_BASE` |
| "WebGL 2 is not available" screen | Browser hardware acceleration disabled; try another browser |
| Old version after deploy | `index.html` is `no-cache`; hard-reload. Check `curl https://your-domain/RELEASE` |
| JS served as `text/plain` | `include /etc/nginx/mime.types;` missing in the server block |
| 502 via Cloudflare Tunnel | Tunnel points at the wrong local port; `curl -I http://127.0.0.1:<port>/` on the VPS |
| `deploy.sh`: no release archive | Run `deploy/scripts/build.sh` first |
| Rollback says "no release" | Only one release exists; deploy another build first |
