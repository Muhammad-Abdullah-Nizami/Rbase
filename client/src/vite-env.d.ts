/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** wss:// URL of the deployed signaling server. Injected at build time. */
  readonly VITE_SIGNALING_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
