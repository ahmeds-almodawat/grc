# P3/P3.5 Final Discrepancy Register

| ID | Classification | Final status | Evidence/fix |
| --- | --- | --- | --- |
| F01 | Product defect | CLOSED - RETESTED PASS | Migration 224, `b6b22f6` |
| F02 | Product defect | CLOSED - RETESTED PASS | Governed lifecycle bridge, `2b7b276` |
| F03 | Product defect | CLOSED - RETESTED PASS | Migration 225, `f3fccc4` |
| F04 | Product defect | CLOSED - RETESTED PASS | Policy/SOP contracts, `ee4c4c1` through `98b5740` |
| F05 | Product/security defect | CLOSED - RETESTED PASS | Migrations 226-229 |
| F06 | Product defect | CLOSED - RETESTED PASS | Approval lookup/state/finalization corrections |
| F07 | Product defect | CLOSED - RETESTED PASS | Accreditation read contract, `871e9b2` |
| F08 | Product/security defect | CLOSED - RETESTED PASS | Governed visibility/linkage corrections |
| F09 | Product defect | CLOSED - RETESTED PASS | Migration 230 and CAPA date correction |
| F10 | Release-proof defect | CLOSED - RETESTED PASS | Migration 231 and reviewed ceiling |
| F11 | Product/security defect | CLOSED - RETESTED PASS | Production demo boundary, `3c87eeb` |
| F12 | Test observation | FALSE POSITIVE | Browser date-entry automation artifact |
| F13 | Intentional governance | INTENTIONAL | SoD self-review and OVR evidence gates |
| F14 | Nonblocking debt | OPEN NONBLOCKING | Existing build chunk-size advisory |
| F15 | Reviewed inventory | REVIEWED NONBLOCKING | 61 medium and five managed-schema observations |
| F16 | Test observation | FALSE POSITIVE | Two synthetic secret-rejection fixtures |
| F17 | Staging legacy | OPEN NONBLOCKING | `admin-create-user`; must not reach Production |
| F18 | P4 prerequisite | READY FOR P4 EXECUTION | Pre-217 bridge, migrations, Edge/environment deltas |
| F19 | Release-evidence defect | CLOSED | Vercel canonical deployment metadata matches Git SHA |
| F20 | Release-evidence defect | CLOSED | P3/P3.5 evidence and PR body synchronized |
| F21 | Release-evidence defect | CLOSED | Canonical PR checks all successful |
| F22 | Human security gate | OPEN | Final real Turnstile authentication certification |
| F23 | Release-coverage defect | CLOSED | Disabled import/notification contracts and focused controls/accessibility |

## Open Counts

| Category | Critical | High | Medium | Low |
| --- | ---: | ---: | ---: | ---: |
| Product defect | 0 | 0 | 0 | 0 |
| Release-evidence defect | 0 | 0 | 0 | 0 |
| Human certification gate | 0 | 1 | 0 | 0 |
| P4 execution prerequisite | 0 | 0 | 0 | 0 |
| Nonblocking debt/legacy | 0 | 0 | 0 | 2 |

F18 is an exact P4 execution prerequisite, not a staging product defect. F14,
F15, and F17 do not block final staging certification. F22 is the only
release-blocking open gate.
