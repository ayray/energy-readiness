import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/energy-readiness/",
  plugins: [react()],
  test: { include: ["src/**/*.test.ts"] },
});
