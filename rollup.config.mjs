import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import terser from "@rollup/plugin-terser";

export default {
  input: "app.js",
  output: {
    file: "dist/bundle.min.js",
    format: "cjs",
  },
  plugins: [json(), nodeResolve({ browser: false }), commonjs(), terser()],
};
