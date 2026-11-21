import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import path from "node:path";
const dataDir = mkdtempSync(path.join(tmpdir(), "ranrao-browser-"));
export default defineConfig({
  testDir: "./browser",
  workers: 1,
  retries: 0,
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:4367",
    channel: process.env.PW_CHANNEL || undefined,
    viewport: { width: 1440, height: 950 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm start",
    url: "http://127.0.0.1:4367/healthz",
    reuseExistingServer: false,
    timeout: 45000,
    env: {
      DATA_DIR: dataDir,
      PORT: "4367",
      HOST: "127.0.0.1",
      PUBLIC_DEMO_ENABLED: "true",
      PUBLIC_ORIGIN: "http://127.0.0.1:4367",
      OPENAI_API_KEY: "",
      DEMO_AI_ENABLED: "false",
    },
  },
});
