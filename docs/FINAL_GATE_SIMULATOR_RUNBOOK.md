# Final Gate Simulator Runbook

Run `npm run pilot:final-gate-simulator` before and after real approval completion. The before-approval state should remain blocked. The after-approval state should pass only after real approver data is entered.

## Safety boundary

This document does not approve the pilot by itself. Real human approval must still be entered in `release/v674/approvals/pilot-signoff.json` and `release/v674/approvals/ovr-confidentiality-confirmation.json`.
