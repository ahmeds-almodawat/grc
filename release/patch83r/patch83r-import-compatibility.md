# Patch 83R import compatibility

Department Import remains disabled by default. Its preview reference data now separates active departments from archived identities. Archived code, normalized English name, or normalized Arabic name produces the blocking `archived_department_match` message. The Edge bridge repeats the archived match preflight and migration 171 prevents archived identity recreation or mutation outside an explicit lifecycle operation. Import never restores a department.

User Import continues to load active departments for selection and assignment. Validation separately loads archived departments so archived code or name produces the clear error `Archived department cannot be assigned`. Database triggers are the final guard for bulk bridge or direct administrative writes that attempt to assign an active profile or role to an archived department.

Active import paths and the existing fixed `apply_department_import_batch` and `patch19_user_management_bridge` mappings remain in place.
