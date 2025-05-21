/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ROBOT_SECRET: string;
  readonly VITE_AXBOT_API_URL: string;
  readonly VITE_AXBOT_API_KEY: string;
  readonly VITE_ROBOT_PROXY_URL: string;
  readonly VITE_ROBOT_CAMERA_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 