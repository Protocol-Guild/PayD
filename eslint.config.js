import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/target/**",
      "**/.vite/**",
      "packages/**",
      "contracts/**",
      "frontend/**",
      "backend/**",
    ],
  },
  js.configs.recommended,
  prettier,
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.es2021,
        React: "readonly",
      },
    },
    rules: {
      "no-console": "off",
      "no-undef": "off",
    },
  },
);
