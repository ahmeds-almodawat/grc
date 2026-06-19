# Technical Debt Register

## Current known debt

| Area | Issue | Risk | Current handling | Target phase |
|---|---|---:|---|---|
| Scripts | Many versioned npm scripts | Medium | Catalog and preserve | After pilot signoff |
| Repo hygiene | Possible tracked ZIP/build artifacts | Medium | Audit and normal removal | v7.6+ |
| CI | Basic CI only | Medium | Add repo health workflow | v7.6 |
| Staging proof | Static/local evidence stronger than live staging proof | High | Document limitation | Pre-production |
| Human signoff | Missing real approvals | Blocking | Strict gate rejects placeholders | Before pilot |
| Documentation | Improved but still growing | Medium | v7.4-v7.6 docs | Ongoing |
| Release versioning | Package version vs evidence versions | Low/Medium | Release policy documented | After pilot |

## Debt management rule

Do not fix all debt in one risky patch. Prefer safe, reviewable packs that preserve evidence and gates.
