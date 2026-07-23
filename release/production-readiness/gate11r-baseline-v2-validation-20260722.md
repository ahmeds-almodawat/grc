# Gate 11R baseline V2 validation

The immutable baseline V2 applied to a clean disposable Supabase-compatible PostgreSQL 17.6 environment in 21.913 seconds. The migration ledger contained only version 185. Reapplication stopped as designed with `GATE11_BASELINE_ALREADY_PRESENT`.

The regenerated schema fingerprint contained 12,488 canonical statements and exactly matched the normalized hosted post-185 catalog hash `edac07deb655aba711cd2bc7e834010449be42f36f27863326ce0a41d22a3485`.

Migration 185 policy, Gate 5 governance, Gate 7 catalog/runtime adversarial, Gate 9R security-advisor, and immutable-baseline SQL contracts passed in their intended disposable fixtures. The database linter exited successfully but reported four inherited staging-derived legacy static findings; none was introduced by Gate 11R. They remain explicitly visible for Gate 12 review.
