# Patch 83K: Cleanup Verification

**Status:** **BLOCKED**

| fixture type | created count | removed count | remaining count | verification query | pass_fail |
|--------------|---------------|---------------|-----------------|--------------------|-----------|
| `patch83k_test_` document | 0 | 0 | 0 | `select count(*) from document_center_items where title like 'patch83k_test_%';` | BLOCKED |
| `patch83k_test_` role | 0 | 0 | 0 | `select count(*) from user_roles where id::text like 'patch83k_test_%';` | BLOCKED |
| `patch83k_test_` profile | 0 | 0 | 0 | `select count(*) from profiles where email like 'patch83k_test_%';` | BLOCKED |
