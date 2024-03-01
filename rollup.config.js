import { nodeResolve } from "@rollup/plugin-node-resolve";
export default {
  input: "./src/export.mjs",
  output: {
    file: "./docs/js/game.js",
    format: "es",
    sourcemap: false,
  },
  plugins: [nodeResolve()],
};
