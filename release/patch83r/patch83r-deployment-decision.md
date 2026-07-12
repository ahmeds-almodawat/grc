# Patch 83R deployment decision

All requested local validation and Patch 83R proof gates passed before deployment.

Only `171_patch83r_department_lifecycle.sql` was deployed to linked project `zbrjjecpsrzposhuarcn`. A preceding dry run confirmed no other migration was selected. Post-deployment migration history is aligned through 171.

Because its source changed, only the `privileged-action` Edge Function was deployed. Post-deployment state is version 6, `ACTIVE`, SHA-256 `dcfabfe46afd262bae7125ee4cf84f4e5440799750887e0d2d36fb853383d471`, with `verify_jwt: true`. No other Edge Function was deployed.

Vercel was not deployed or reconfigured. Department Import remains disabled by default. No unrestricted production-readiness claim is made; authenticated persona mutation tests should be run through an approved operator session before lifecycle use is broadened.
