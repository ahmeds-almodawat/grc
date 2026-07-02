# Patch 23 Evidence UI Test Plan

## Smoke Tests
1. Open the existing Evidence route.
2. Confirm the Evidence Governance Center loads without route changes.
3. Confirm the legacy evidence queue still appears.
4. Confirm empty-state messages render when Patch 23 migration is not applied locally.

## Governance Areas
1. Review queue: submitted, overdue, rejected, revision and expiring evidence should appear.
2. Gap dashboard: missing required evidence should appear with requirement, gate and accepted count.
3. Closure gate status: `Can close` and `Blocked` statuses should reflect accepted evidence or approved waiver.
4. Sensitive register: sensitive evidence should show classification reason, owner, reviewer, expiry and lock state.
5. Pack index: linked evidence should show item, evidence, review status, reviewer and linked timestamp.
6. Detail modal: metadata, linked items, gate status, action controls and chain of custody should render.

## Actions
1. Submit for review writes a custody event.
2. Accept writes accepted status and event.
3. Reject sets revision required and writes event.
4. Request revision keeps evidence visible in the queue.
5. Supersede marks the previous evidence as not current.
6. Lock prevents governed modification through the bridge.
7. Request waiver creates an auditable waiver request.
8. Approve or reject waiver requires waiver id and audit note.
9. Generate pack index returns the current pack candidate set.

Manual tests should use non-production evidence and avoid confidential content.
