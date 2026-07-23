# Gate 11R baseline deployment contract

Baseline V2 is an immutable bootstrap artifact through migration 185. New empty environments must use migration history `185`, then the shared forward chain beginning at 186. Existing historical environments keep their exact 140-version ledger through 185 and join the same forward chain at 186.

The release tooling fails closed on mixed or unknown histories and binds every decision to the approved manifest hash, baseline SQL hash, and normalized catalog hash. Migration-history initialization, repair, or manual history writes are prohibited.

The legacy disposable proof is a structural simulation only: it demonstrates the supported CLI behavior for an existing exact ledger without replaying the historically non-clean-installable SQL chain. It is not a production bootstrap or history-repair procedure.
