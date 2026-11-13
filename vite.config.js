import { defineConfig, loadEnv } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ mode }) => {
  const { VITE_API_BASE_URL: apiBaseUrl = "https://api-games.nunbun.sbs" } =
    loadEnv(mode, root, "");

  return {
    server: {
      proxy: {
        "/api": {
          target: apiBaseUrl,
          changeOrigin: true
        }
      }
    },
    build: {
      rollupOptions: {
        input: {
          home: resolve(root, "index.html"),
          breakout: resolve(root, "breakout/index.html"),
          snake: resolve(root, "snake/index.html"),
          tetris: resolve(root, "tetris/index.html")
        }
      }
    }
  };
});
