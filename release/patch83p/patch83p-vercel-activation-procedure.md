# Patch 83P Controlled Vercel Activation Procedure

This is an operator procedure only. Patch 83P does not execute a deployment or modify a production environment.

1. Select the intended Vercel project and confirm the reviewed commit and target environment with the release owner.
2. Reuse the existing public anon key. Never copy a service-role key, JWT, password, or Patch 83O test credential into Vercel.
3. Configure these variables for the explicitly approved Vercel environment:

   ```text
   VITE_SUPABASE_URL=https://zbrjjecpsrzposhuarcn.supabase.co
   VITE_SUPABASE_ANON_KEY=<existing public anon key>
   VITE_DEPARTMENT_IMPORT_EXECUTION_ENABLED=true
   ```

4. Review the variable scope and obtain the required deployment approval.
5. Redeploy the same reviewed commit. Changing a Vite variable requires redeployment because its value is embedded during the frontend build.
6. Run the production smoke checklist without storing credentials or test data.

Do not configure a service-role key, JWT, password, or Patch 83O test credential. This controlled enablement decision is not a production-readiness claim.
