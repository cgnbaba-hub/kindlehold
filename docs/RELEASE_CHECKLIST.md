# Release checklist (Stage 1 vertical slice)

Run from the repository root. Every item links to evidence produced by the command.

| # | Check | Command | Evidence |
|---|---|---|---|
| 1 | Unit, integration, simulation tests pass | `npm test` | console summary; `docs/STATUS.json → tests` |
| 2 | Scripted full match is won on Normal | included in `npm test` (`tests/simulation/ai-mission.test.js`) | test output |
| 3 | Visual presets pass all gates | `node scripts/verification/verify.mjs --prod --run=<name>` | `docs/reports/<name>/*.json`, `docs/screenshots/<name>/` |
| 4 | Screenshots inspected by a critic | read-only critic agent | `docs/critiques/visual-*.md` |
| 5 | End-to-end UI flows pass | `npm run test:e2e` | `docs/reports/latest-e2e.json` |
| 6 | Performance budgets (GPU-independent) pass | `npm run test:perf` | `docs/reports/latest-perf.json` |
| 7 | Production build has no source maps, loads under CSP | `npm run test:deploy` | console output `DEPLOY-VALIDATE OK` |
| 8 | Atomic deploy + rollback work | `npm run test:deploy` | same |
| 9 | No known vulnerable dependencies | `npm audit` | `found 0 vulnerabilities` |
| 10 | No secrets in the repository | `node scripts/verification/secret-scan.mjs` | `findings: 0` |
| 11 | Every asset registered | `node scripts/assets/check-register.mjs` | `unregistered: 0` |
| 12 | Status file regenerated from evidence | `node scripts/verification/update-status.mjs` | `docs/STATUS.json` |
| 13 | Known issues reviewed | — | `docs/KNOWN_ISSUES.md` |
| 14 | Tag the release | `git tag -a v0.1.0-slice -m "..."` | `git tag` |
