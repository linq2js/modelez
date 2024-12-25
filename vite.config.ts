import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import dts from "vite-plugin-dts";

// https://vite.dev/config/
export default defineConfig(() => ({
  test: {
    environment: "jsdom",
  },
  build: {
    lib: {
      entry: ["src/lib/index.ts", "src/lib/react.ts"],
      fileName: (format, entryName) => `${entryName}.${format}.js`,
    },
    rollupOptions: {
      external: ["react", "react-dom", "@wry/equality"],
      output: {
        globals: {
          react: "React",
        },
      },
    },
  },
  plugins: [
    react(),
    dts({
      tsconfigPath: "./tsconfig.app.json",
    }),
  ],
}));
