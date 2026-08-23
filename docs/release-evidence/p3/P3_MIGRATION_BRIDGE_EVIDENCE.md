# P3 Migration and Compatibility Bridge Evidence

## Root Cause

Staging was at migration 187 with
`v_critical_attention_items.risk_level` exposed as the legacy enum. Original
migration 217 expects the canonical text projection. The exact legacy view
definition hash was `df6a444271d323bb97cf12f062486e6f`; the canonical hash is
`a332a995c7c7b46ea23325a2c807c9c6`.

No direct dependent relation or function required a broad `CASCADE`.

## Bridge

- SQL: `release/p3/p3-pre217-critical-attention-compatibility.sql`
- Runner: `release/p3/invoke-p3-pre217-critical-attention-compatibility.ps1`
- SHA-256: `26CF8F06B26132BA8FFD81E60A216B46FFA209FBAA07257963736D30D6D71491`
- Preconditions: exact supported legacy enum shape/hash and preserved owner/ACL
- No-op: exact canonical text shape/hash
- Failure: any unknown shape, hash, owner, ACL, security option, or dependency
- Ledger effect: none
- Historical migration edits: none

The bridge preserves owner `postgres`, `security_invoker=true`, anonymous
denial, and authenticated/service-role SELECT.

## Disposable Upgrade Proof

The isolated proof database executed:

`187 -> 188-216 -> bridge -> original 217 -> 218-222 -> 223`

Result: PASS, 178 ledger entries, ceiling 223, migration 223 exactly once.

## Staging Recovery

Recovery artifacts were created outside Git before the first hosted write:

| Artifact | SHA-256 |
| --- | --- |
| `staging-187-schema.sql` | `F0ED4DFEF3F492DC209519D3B1B30887A4A35C829878DEB0B83EFBEB02E3C720` |
| `staging-187-history-schema.sql` | `18B99FBBB3EC9FBB964BB255A56171329ACD99B6977ECE2ADDD89FDF5AA5105B` |
| `staging-187-history-data.sql` | `36471A4FEC24CBE39B9918CCBC37E2220A1C5A4F77109729E63101A9FA5C263E` |
| `staging-187-roles.sql` | `25873CEC56A2CC6514E204F420231777F85C03DA818CAA7090CDCDFA89776ECD` |
| `staging-187-data.sql` | `7CB4CBC132F8A68941A11C6D5EFD6E51828032CE94F9215607A800A83E959D27` |

## Hosted Sequence

- Starting staging ceiling: 187
- Canonical migrations 188-216: applied normally
- Compatibility bridge: applied with no ledger write
- Original migration 217: applied unchanged and recorded normally
- Migrations 218-222: applied normally
- Ending correction migration 223: applied normally and recorded once
- Ending staging ceiling: 223

Migration 223 corrects division-scoped Patch83U provisioning by preserving the
queued division ID for `division_head:division`. Its SHA-256 is
`E11B6451B638F821CE93AECFE2DBCE3E13C414C54C4D393944B33D56FEC8D9E7`.

## Final Catalog

- Critical-attention `risk_level`: text
- View hash: `a332a995c7c7b46ea23325a2c807c9c6`
- `security_invoker=true`
- Anonymous SELECT: denied
- Authenticated SELECT: granted, with underlying RLS
- Direct dependents: 0
- Recent activity, release-readiness, governance-link views/RPCs: present

