/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEPARTMENT_IMPORT_EXECUTION_ENABLED?: string;
  readonly VITE_PATCH83T_USER_EXCEL_IMPORT_ENABLED?: string;
  readonly VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
