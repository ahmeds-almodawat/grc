# Script Catalog Policy

## Why this exists

The project has accumulated many versioned npm scripts through iterative readiness work. They are useful as evidence, but they create onboarding and maintenance debt.

v7.6 does not delete old scripts. Instead, it creates a catalog and defines a policy for future cleanup.

## Script categories

### Canonical daily scripts

These should be used by normal developers and CI:

```text
npm run dev
npm run typecheck
npm run build
npm run ci:static
npm run repo:health
npm run pilot:readiness
```

### Evidence scripts

These produce formal release evidence:

```text
npm run proof:all
npm run v73:all
npm run v75:all
npm run v76:all
```

### Historical version scripts

Scripts such as `v62:*`, `v64:*`, `v66:*`, `v67*`, and `v70*` must remain available until the pilot evidence archive is closed.

## Rule for new scripts

Every new script must be either:

1. A canonical daily command.
2. A versioned evidence command.
3. A short wrapper around existing validated commands.

Avoid one-off scripts unless they produce a documented release artifact.

## Future cleanup plan

After controlled pilot signoff:

1. Freeze historical v6/v7 evidence scripts.
2. Move obsolete script explanations to `docs/history/`.
3. Keep aliases for proof-critical commands.
4. Reduce daily commands to a smaller, documented set.

No script should be removed until the evidence trail is protected.
