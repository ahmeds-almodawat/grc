# v9.9 Manual Testing Checklist

This checklist is for a controlled internal pilot using synthetic data only.
It is not production approval and must not contain real patient identifiers or confidential OVR details.

## Access and setup

- [ ] Login as super admin
- [ ] Create user
- [ ] Create department
- [ ] Confirm Scenario Lab is hidden from normal users

## OVR workflow

- [ ] OVR same-department scenario
- [ ] OVR cross-department scenario
- [ ] OVR Quality validation
- [ ] OVR referral response
- [ ] OVR dispute/reopen
- [ ] Confirm cross-department notification occurs only after Quality validation

## GRC and evidence

- [ ] Evidence upload metadata
- [ ] Risk/control/project visibility
- [ ] Audit read-only access
- [ ] Normal user denial
- [ ] Export/backup denial for normal user

## UX

- [ ] Arabic/English layout check
- [ ] Responsive screen check

## Closeout

- [ ] Capture defects without patient identifiers or confidential OVR narratives
- [ ] Run `npm run v99:cleanup-scenarios`
- [ ] Confirm Scenario Lab registered record count is zero
