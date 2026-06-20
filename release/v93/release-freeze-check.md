# v9.3 Release Freeze Check

| Area | Action | State |
| --- | --- | --- |
| Working tree | Run git status before and after approval | Manual check required |
| Proof baseline | Latest proof summary available | failed_review_required |
| Approval freeze | Do not alter unrelated release artifacts after signoff | Required |
| Post-approval proof | Run v674 signoff check, sync, v66 strict proof, proof all | Required |
| Production boundary | Do not mark production ready after controlled pilot approval | Required |

## Freeze rule

After approvals are completed, avoid new non-approval changes until final proof is captured.

