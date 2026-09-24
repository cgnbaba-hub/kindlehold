# Security

Kindlehold is a static client-side game. There is no server-side code, no
accounts and no network API. The threat model therefore centres on untrusted data
the client parses, the supply chain, and the deployment/tooling scripts.

| Threat | Mitigation | Verified by |
|---|---|---|
| Dependency vulnerabilities | Minimal dependencies (three at runtime; vite + playwright dev only). `npm audit` in release checklist | `npm audit` output in STATUS |
| Unsafe dynamic HTML | UI builds DOM with `textContent` / `createElement`; the only `innerHTML` use is for static, project-authored SVG icon strings (no user/scenario data) | `tests/unit/lint-rules.test.js` flags `innerHTML` outside `src/ui/icons.js`/`dom.js` |
| `eval` / `new Function` | Banned | lint-rules test |
| Malicious / oversized save files | 2 MB limit, JSON.parse inside try, schema validation, prototype-pollution key rejection (`__proto__`, `constructor`, `prototype`), numeric range clamps, entity cap | `tests/integration/save.test.js` |
| Untrusted scenario JSON | Same validator; scenarios are data only (no script hooks, triggers are declarative) | `tests/unit/validate.test.js` |
| Prototype pollution | `core/validate.js` `safeParse` uses a reviver that drops dangerous keys; objects built with known keys only | unit test |
| Path traversal in tooling | Verification scripts resolve output paths under the repo and reject `..` in preset names | `scripts/verification/lib/paths.mjs` |
| Exposed source maps | Production build sets `build.sourcemap: false` | build check in `validate-nginx.sh` (no `.map` in dist) |
| Secrets in repo | No secrets needed; `.env*` ignored except `.env.example`; release checklist greps for key patterns | `scripts/verification/secret-scan.mjs` |
| Unsafe shell scripts | `set -euo pipefail`, quoted variables, no `eval`, explicit paths, dry-run flag for deploy, refuses to run with empty target vars | review + `bash -n` in test:deploy |
| CSP compatibility | No inline scripts in production HTML, no eval, workers none; CSP in nginx example: `default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; media-src 'self' blob: data:; connect-src 'self'` | nginx validation test loads game under CSP |
| Third-party asset provenance | ASSET_REGISTER.md; all current content procedural | `scripts/assets/check-register.mjs` |
| Clickjacking | `X-Frame-Options: SAMEORIGIN`, `frame-ancestors 'self'` | nginx test |

`style-src 'unsafe-inline'` is needed because the UI sets element styles for
positions (health bars, tooltips) via the style attribute/CSSOM.
