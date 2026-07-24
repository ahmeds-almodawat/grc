# Gate 13S-R explicit RC3 staging plan

This plan is prepared but not executed. After the exact future authorization, the PowerShell plan verifies RC2 identity, an empty index, and no tracked deletion; creates `release/grc-platform-1.0.0-rc.3`; stages only paths enumerated in the RC3 manifest; rejects environment/local paths; compares the staged path set to the manifest; runs the staged diff check; and displays the complete staged review.

It never uses `git add .`. It stops before commit. The later approved commit message is `release: GRC Platform 1.0.0-rc.3 (canonical post-187 fingerprint)` and the proposed immutable tag is `v1.0.0-rc.3`. RC2 branch and tag are not moved.
