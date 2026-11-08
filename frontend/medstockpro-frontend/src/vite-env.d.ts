/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Optional build-time backend API base URL, e.g. http://192.168.1.50:5218/api
   * Used as a fallback when no in-app server URL is configured. See
   * .env.production.example.
   */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
