# Patch 83H.7: Local/Remote Migration Matrix

| version | local_filename | local_present | remote_present | remote_name_if_available | content_history_known | expected_behavior_if_016_restored | risk | action |
|---------|----------------|---------------|----------------|--------------------------|-----------------------|-----------------------------------|------|--------|
| 015 | `015_...` | Yes | Yes | N/A | Yes | N/A | Low | None |
| 016 | `016_...` | No | No | N/A | Yes (from `f2271a3`) | Detected as out-of-order | High | Do not restore |
| 022 | `022_...` | Yes | Yes | N/A | Yes | N/A | High (if modified) | Evaluate modification vs repair |
| 055 | `055_...` | Yes | Yes | N/A | Yes | N/A | Low | None |
| 166 | `166_...` | Yes | No | N/A | Yes | N/A | Low (Pending) | None |
