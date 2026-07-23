# Production Gate 10 validation results

- Captured: 2026-07-22T16:40:52.5362101Z
- Branch / HEAD: `patch83t-controlled-user-excel-import` / `a9989b1e8d95a6bb775316a2d9e709ef84514c42`
- Freeze: all 19 inputs matched; aggregate `f3da08ac6aedcdf5f56e5d4a0c5be307c737b108448fcf85f8b96ba0aaf106cd`.
- Full unit suite: 40 files, 1,174/1,174 tests passed.
- Focused Gate 5/6/9/9R suite: 4 files, 35/35 tests passed.
- SQL governance and adversarial validation: passed in disposable databases; all disposable resources were removed.
- TypeScript, Deno Edge check, and production build: passed. The build emitted only the existing chunk-size warning.
- Playwright: the first serial run encountered one transient 0.34 px subpixel variance; its isolated unchanged rerun passed 1/1, and the final unchanged complete serial run passed 25/25.
- JSON parsing, secret scan, runtime production-reference scan, skipped/only scan, and `git diff --check`: passed. Git reported line-ending warnings only.
- Final repository state: 64 tracked modifications, 364 untracked files, zero staged files, and zero deleted tracked files.
- No source, test, or migration file was changed by Gate 10. No production access occurred.

Overall result: **passed**.
