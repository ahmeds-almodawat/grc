# GRC Control Center v1.7 — Performance & Responsive UX Patch

## Added

- New Performance & UX Center.
- Browser performance signal capture table.
- Responsive/mobile readiness gates.
- Module pressure scoring view.
- Device snapshot UI for current viewport and load timing.
- Modern mobile/tablet CSS rules for sidebar, navigation, cards and content grids.
- Bilingual Arabic/English labels for the new performance layer.

## Database

New migration:

- `019_performance_responsive_usability.sql`

New objects:

- `ui_performance_events`
- `v_ui_performance_summary`
- `v_module_payload_pressure`
- `v_mobile_readiness_gates`

## Notes

- The performance signal logger records lightweight UI timing and viewport metadata. It does not store medical, clinical, patient, OVR narrative, or attachment content.
- The migration includes permissive insert/read policies suitable for authenticated app usage and executive/governance review.
- The new responsive CSS improves usability on tablets and phones without adding new packages.
