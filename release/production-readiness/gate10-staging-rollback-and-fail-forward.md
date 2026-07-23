# Gate 10 rollback and fail-forward

Do not retry or restore automatically. On failure, preserve stdout/stderr and query migration history/catalog read-only. Classify: none committed, 183 only, 183-184 committed with postflight failure, history/catalog disagreement, or ambiguous state. Use the verified recovery point only under new authorization, or create a separately reviewed forward-only correction above 184.
