import next from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

const config = [
  {
    ignores: [".next/**", "node_modules/**", "db/migrations/**", "public/**", "docs/**"],
  },
  ...(Array.isArray(next) ? next : [next]),
  ...(Array.isArray(nextTs) ? nextTs : [nextTs]),
  {
    rules: {
      // A single intentional deep-link mount-sync opts out inline; keep the rule
      // active so any new accidental setState-in-effect is surfaced.
      "react-hooks/set-state-in-effect": "warn",
      // Honour the `_` prefix for intentionally-unused args (e.g. server-action
      // (`_prev`, `_formData`) signatures required by useActionState).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
]

export default config
