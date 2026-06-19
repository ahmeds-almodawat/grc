# Repository Hygiene Policy

## Goals

The repository should be easy to understand, clone, build, and review.

## Do not commit

- `.env` files or local secrets.
- `node_modules/`.
- `dist/` build output unless explicitly required for deployment.
- ad-hoc ZIP backup files.
- temporary screenshots or local exports.
- unreviewed generated proof noise from routine test runs.

## Release evidence exception

The `release/` directory is intentionally tracked for controlled-pilot evidence. However, generated evidence should only be committed when it represents a reviewed milestone.

## ZIP files

Tracked ZIP files are repo hygiene warnings. v7.6 does not rewrite Git history. If ZIP files are found:

1. Confirm whether they are still needed.
2. Remove them in a normal commit if safe.
3. Only consider history rewrite after project owner approval and after all collaborators are informed.

## Generated output discipline

Before committing, run:

```powershell
git status --short
```

If old proof outputs changed unintentionally, restore them:

```powershell
git restore release/v62 release/v64 release/v66 release/v661 release/v662 release/v663 release/v672 release/v673 release/v674 release/v700 release/v72
```

Then stage only the intended files.
