import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri 用に固定ポート + ファイルウォッチ無視
// https://v2.tauri.app/start/frontend/vite/
export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: "127.0.0.1",
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
