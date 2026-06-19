v7.3 Module Acceptance Pack

Adds a controlled pilot module acceptance layer after v7.2.

Run directly:
- node scripts/v73-module-acceptance.mjs
- node scripts/v73-module-report.mjs

Optional package commands to add locally:
- v73:module-acceptance = node scripts/v73-module-acceptance.mjs
- v73:module-report = node scripts/v73-module-report.mjs
- v73:all = npm run v73:module-acceptance && npm run v73:module-report

Generated files:
- release/v73/module-acceptance-results.json
- release/v73/module-acceptance-summary.md
- release/v73/module-issues.csv
- release/v73/module-signoff-review-pack.md
