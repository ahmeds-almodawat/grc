# P2 Nonblocking Deferrals

| Item | Blocking | Owner / next gate | Required action |
| --- | --- | --- | --- |
| Disposable zero-install migration chain | NO for upgrade RC | Release Engineering | Refresh the authoritative new-install baseline; unchanged migration 022 and 216/217 ordering/type drift are documented |
| Staging drift/apply/authenticated UAT | NO in P2 | P3 release operator | Inventory actual ledger/schema, back up, apply 220-222, then run real staging UAT |
| Normalized governance rates | NO | Product/Data governance | Establish a trusted exposure denominator before publishing rates |
| Facility analytics dimension | NO | Data architecture | Add only when a canonical facility input exists |
| Legacy release-factory/V33 seeded surfaces | NO | Release Engineering | Supply persona-verified canonical inputs; controlled-deny-all sources remain fail-closed |
| Local collation metadata refresh | NO | Local infrastructure maintenance | Refresh in a separate controlled maintenance window if required |

There are no remaining P2 production blockers for proceeding to the separately
authorized staging gate. None of these items permits staging or Production work
under P2.

