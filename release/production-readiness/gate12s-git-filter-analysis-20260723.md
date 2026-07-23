# Gate 12S Git-filter analysis

Direct inspection of stage-0 object IDs with `git cat-file blob` found **66** expected line-ending normalizations, **284** byte-identical paths, and **zero** unexpected transformations across the original 350 approved paths.

The prior count of 319 was not a Git-filter count. PowerShell ZIP extraction altered line endings in the diagnostic export, adding 253 false mismatches. The direct object audit supersedes that diagnosis.

Git uses system-level `core.autocrlf=true`; `core.eol` and `core.safecrlf` are unset, and no root attribute overrides apply. The release source of truth is now explicitly the Git index stage-0 blob, never an ordinary working-tree read.
