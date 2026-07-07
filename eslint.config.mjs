import next from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

export default [
  {
    ignores: [".next/**", "node_modules/**", "db/migrations/**", "public/**", "docs/**"],
  },
  ...(Array.isArray(next) ? next : [next]),
  ...(Array.isArray(nextTs) ? nextTs : [nextTs]),
  {
    rules: {
      // Intentional `mounted`/hydration guards use setState in a mount effect.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]
