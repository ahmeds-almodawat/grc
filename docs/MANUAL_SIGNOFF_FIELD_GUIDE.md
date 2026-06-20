# Manual Signoff Field Guide

## pilot-signoff.json

Each approver section must contain a real name, role, date, decision, and controlled-pilot scope.

Required approvers:

- Management/Admin
- IT
- Quality

Allowed decisions:

- `approved`
- `approve`
- `go`
- `accepted`

The date must be a real `YYYY-MM-DD` date and not in the future.

`maximum_pilot_users` must be an integer from 1 to 15.

The reviewed evidence booleans must be explicitly true after the evidence is reviewed.
