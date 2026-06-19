# Staging Rollback Drill

## Objective

Prove that the team can revert a staging deployment safely.

## Drill steps

1. Identify current staging version/commit.
2. Deploy candidate staging build.
3. Run smoke tests.
4. Trigger rollback to previous staging deployment.
5. Confirm login and dashboard still work.
6. Document rollback time and issues.

## Pass criteria

- Rollback completes without data loss.
- Staging URL becomes usable again.
- No production systems are affected.
- Evidence is captured.
