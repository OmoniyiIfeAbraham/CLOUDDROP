import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const apiProxyTarget = loadEnv(mode, ".", "CLOUDDROP_").CLOUDDROP_API_PROXY_TARGET ?? "http://localhost:5000";
  return {
    plugins: [react()],
    server: {
      warmup: { clientFiles: ["./src/main.tsx"] },
      proxy: {
        "/api": { target: apiProxyTarget, changeOrigin: true },
        "/health": { target: apiProxyTarget, changeOrigin: true },
      },
    },
    test: {
      environment: "jsdom",
      maxWorkers: 1,
      // Styled page tests spend several seconds in jsdom's role/style queries
      // on busy hosts. Keep a separate budget from async assertion timeouts.
      testTimeout: 10_000,
      setupFiles: ["./src/test/setup.ts"],
      css: true,
      exclude: ["e2e/**", "node_modules/**", "dist/**"],
    },
  };
});
