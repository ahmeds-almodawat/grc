/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEPARTMENT_IMPORT_EXECUTION_ENABLED?: string;
  readonly VITE_AUTH_CAPTCHA_REQUIRED?: string;
  readonly VITE_AUTH_CAPTCHA_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
