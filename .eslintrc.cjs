module.exports = {
  root: true,
  env: { 
    node: true, 
    browser: true,
    es2023: true 
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  rules: {
    "no-async-promise-executor": "error",
    "no-shadow": "off",
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": ["warn"],
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    "consistent-return": "warn",
    "no-console": "off",
    "no-undef": "warn"
  },
  ignorePatterns: ["dist/", "node_modules/", "*.min.js", "frontend/src/lib/supabase-client.js"]
};
