import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", port: 3107, strictPort: true },
  resolve: {
    alias: [
      {
        find: /^\.{1,2}\/firebaseConfig$/,
        replacement: path.resolve("tools/phone-preview/firebase.ts"),
      },
    ],
  },
});
