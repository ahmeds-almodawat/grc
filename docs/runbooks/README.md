# Runbooks

This directory contains operational runbooks for emergency response, deployment strategies, and routine maintenance tasks.

- Deployments require all schema, workflow, and frontend proof tests to pass locally before merging.
- Rollbacks are performed via reverse migrations if necessary, but we prefer additive patches instead.
- Production frontend releases follow the [Staged Production Release Runbook](STAGED_PRODUCTION_RELEASE.md): create and validate an immutable artifact first, then promote it only under separate authorization.
