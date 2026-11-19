import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    // The browser talks to its own origin; the dev server forwards /api to the backend.
    // API_PROXY_TARGET points it at yours (default: the mock server, `npm run mock`).
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET ?? "http://localhost:18100",
        changeOrigin: true,
        // A backend that dies mid-answer leaves the proxy's pipe open and the browser
        // waiting forever. Drop the client's side too, as nginx does in production.
        configure: (proxy) => {
          proxy.on("proxyRes", (upstream, _request, response) => {
            upstream.on("close", () => {
              if (!upstream.complete) response.destroy();
            });
          });
        },
      },
    },
  },
});
