# Security

Kindlehold is a static client-side game. There is no server-side code, no
accounts and no network API. The threat model therefore centres on untrusted data
the client parses, the supply chain, and the deployment/tooling scripts.

| Threat | Mitigation | Verified by |
|---|---|---|
| Dependency vulnerabilities | Minimal dependencies (three at runtime; vite + playwright dev only). `npm audit` in release checklist | `npm audit` output in STATUS |
| Unsafe dynamic HTML | UI builds DOM with `textContent` / `createElement`; the only `innerHTML` use is for static, project-authored SVG icon strings (no user/scenario data) | `tests/unit/lint-rules.test.js` flags `innerHTML` outside `src/ui/icons.js`/`dom.js` |
| `eval` / `new Function` | Banned | lint-rules test |
| Malicious / oversized save files | 2 MB byte limit, JSON.parse inside try, per-kind entity schemas (types, enums, coordinate/HP ranges, array caps), required players/mission/AI/combat structures, prototype-pollution key rejection, migrations guarded, then a **load smoke test** (40 ticks on a throw-away copy, `src/app/load-check.js`) before the session is replaced | `tests/integration/save.test.js` (incl. crafted saves that previously loaded and broke modules) |
| Untrusted scenario JSON | Same validator; scenarios are data only (no script hooks, triggers are declarative) | `tests/unit/validate.test.js` |
| Prototype pollution | `core/validate.js` `safeParse` uses a reviver that drops dangerous keys; objects built with known keys only | unit test |
| Path traversal in tooling | Verification scripts resolve output paths under the repo and reject `..` in preset names | `scripts/verification/lib/paths.mjs` |
| Exposed source maps / dotfiles | Production build sets `build.sourcemap: false`; nginx denies `*.map` and dotfiles everywhere including inside `/assets/` | `validate-nginx.sh` plants a `.map` and a dotfile under `/assets/` and requires 404 |
| Secrets in repo | No secrets needed; `.env*` ignored except `.env.example`; release checklist greps for key patterns | `scripts/verification/secret-scan.mjs` |
| Unsafe shell scripts | `set -euo pipefail`; `DEPLOY_ROOT`/`DEPLOY_HOST`/release id validated against allowlists; remote scripts are quoted heredocs receiving values as positional arguments (no interpolation into script text); prune never removes the active or rollback release | `npm run test:deploy` (includes an injection attempt that must be refused) |
| CSP compatibility | No inline scripts in production HTML, no eval, workers none. Verified: the header is present and the built index uses only external module scripts (the game has not been load-tested in a browser *under* the CSP). CSP in nginx example: `default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; media-src 'self' blob: data:; connect-src 'self'` | nginx validation test loads game under CSP |
| Third-party asset provenance | ASSET_REGISTER.md; all current content procedural | `scripts/assets/check-register.mjs` |
| Clickjacking | `X-Frame-Options: SAMEORIGIN`, `frame-ancestors 'self'` | nginx test |

`style-src 'unsafe-inline'` is needed because the UI sets element styles for
positions (health bars, tooltips) via the style attribute/CSSOM.

## Debug surface

`?debug=1` and `?verify=1` expose `window.__GAME__` (used by e2e tests). In a single-player,
server-less game this only lets a player alter their own local session. URL parameters
are looked up with own-property checks (`Object.hasOwn`), so crafted values such as
`?demo=constructor` cannot reach prototype methods.

## Review history

- 2026-09-24 security-critic round 1: 0 critical, 0 high, 3 medium, 5 low, 6 info
  (`docs/critiques/security-round1.md`). M1–M3 and L1–L5 fixed in the following commit;
  I4 (`/RELEASE` file shows build time and commit) accepted as harmless; I6 (secret scan
  covers tracked files only) accepted.
