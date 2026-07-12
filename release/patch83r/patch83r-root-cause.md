# Patch 83R root cause

The canonical `departments` row already had `is_active`, but it had no archive actor, timestamp, reason, or successor metadata and no controlled rename/archive/restore operations. Direct table RLS allowed administrators to write department rows without the lifecycle-specific invariants required for historical integrity.

Department Import matched rows without distinguishing archived identity, so a matching inactive row could be updated and a differently coded row could recreate an archived normalized name. User Import's UI used active lookup rows, but the bulk bridge trusted a caller-provided validation status and had no final database guard against an archived department UUID.

Patch 83R keeps department rows and all historical foreign keys intact. It adds fixed server-bridge operations, archive metadata, append-only lifecycle events in the existing `audit_logs`, and final database guards for immutable department codes and active assignments.
