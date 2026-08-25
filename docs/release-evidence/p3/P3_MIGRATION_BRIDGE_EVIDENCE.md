# P3 Migration and Compatibility Bridge Evidence

## Pre-217 Compatibility Bridge

Staging originally exposed `v_critical_attention_items.risk_level` as the
legacy enum. Migration 217 expects the canonical text projection. The bridge
supports only the reviewed legacy shape/hash or the exact canonical no-op
shape and fails closed for unknown owners, ACLs, security options, hashes, or
dependencies.

- SQL: `release/p3/p3-pre217-critical-attention-compatibility.sql`
- Runner: `release/p3/invoke-p3-pre217-critical-attention-compatibility.ps1`
- SHA-256: `26CF8F06B26132BA8FFD81E60A216B46FFA209FBAA07257963736D30D6D71491`
- Legacy view hash: `df6a444271d323bb97cf12f062486e6f`
- Canonical view hash: `a332a995c7c7b46ea23325a2c807c9c6`
- Owner preserved: `postgres`
- Security option preserved: `security_invoker=true`
- Ledger effect: none
- Historical migration edits: none

## Staging Sequence

The original sequence completed through 223, followed by bounded forward
corrections 224-231:

| Migration | Purpose |
| --- | --- |
| 224 | Division role activation after governed password transition |
| 225 | Governed policy authority reconciliation |
| 226 | Hosted Patch27 service-role guard |
| 227 | Hosted Patch27 authority-event guard |
| 228 | Hosted Patch206 staged-mutation guard |
| 229 | Hosted service-role contract reconciliation |
| 230 | CAPA action-item contract reconciliation |
| 231 | Hosted compatibility ACL reassertion |

Migrations 226-231 were recorded by the hosted migration tooling with unique
timestamp ledger versions while retaining their canonical source identities.
The repository migration inventory contains 186 files and has reviewed source
ceiling 231.

## Final Catalog

- Critical-attention `risk_level`: text
- View hash: `a332a995c7c7b46ea23325a2c807c9c6`
- `security_invoker=true`
- Anonymous SELECT: denied
- Authenticated SELECT: granted with underlying RLS
- Direct dependents: 0
- Hosted Policy/SOP, governance-link, approval, CAPA, and compatibility
  contracts: retested PASS

## Production Boundary

Production remains at migration ceiling 211. Before unchanged migration 217,
P4 must take a fresh provider backup/PITR checkpoint plus schema, data, history,
and roles exports, then apply the exact bridge above and canonical migrations
212-231. No Production migration or bridge execution occurred during P3/P3.5.
