import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { localApiPlugin } from "./vite.local-api";

export default defineConfig({
  plugins: [tailwindcss(), localApiPlugin()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: ["work01.tucuxi-dace.ts.net"],
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    allowedHosts: ["work01.tucuxi-dace.ts.net"],
  },
});
