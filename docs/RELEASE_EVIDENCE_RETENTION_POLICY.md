# Release Evidence Retention Policy

## Purpose

Release evidence must remain clear, traceable, and reviewable.

## Keep

- Final milestone proof summaries.
- Controlled-pilot dashboards.
- Human approval checklists.
- Restore dry-run evidence.
- Runtime bridge evidence.
- Persona proof outputs.

## Avoid committing

- Repeated identical generated outputs from routine local runs.
- Partial proof runs unless they explain a blocker.
- Local-only temporary files.

## Evidence folders

Use `release/vXX/` folders for versioned milestone evidence.

## Approval artifacts

Approval artifacts must only contain real human decisions. Placeholders are allowed only as draft templates, and strict proof must reject them.

## Retention principle

Evidence must explain what was true at the time of the release milestone. Do not rewrite evidence to make history look cleaner.
