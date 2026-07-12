/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEPARTMENT_IMPORT_EXECUTION_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
