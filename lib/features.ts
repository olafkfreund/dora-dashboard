// Feature flags (server-side, env-driven). Off by default.
// Enable GitHub (data-source integration + GitHub OAuth sign-in) with FEATURE_GITHUB=true.
export const features = {
  github: process.env.FEATURE_GITHUB === "true",
}
