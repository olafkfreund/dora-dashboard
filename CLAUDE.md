# DORA Dashboard

Self-hosted, Docker-based delivery-intelligence portal for regulated environments.
Ingests GitHub + Jira, computes DORA-4 and Synechron extended metrics, behind Azure
Entra ID SSO + GitHub OAuth. UI reuses the `shadcn-radix-nextjs` design system.

## Agent OS Documentation

### Product Context
- **Mission & Vision:** @.agent-os/product/mission.md
- **Technical Architecture:** @.agent-os/product/tech-stack.md
- **Development Roadmap:** @.agent-os/product/roadmap.md
- **Decision History:** @.agent-os/product/decisions.md

### Development Standards
- **Code Style:** @~/.agent-os/standards/code-style.md
- **Best Practices:** @~/.agent-os/standards/best-practices.md

### Project Management
- **Active Specs:** @.agent-os/specs/
- **Spec Planning:** Use `@~/.agent-os/instructions/create-spec.md`
- **Tasks Execution:** Use `@~/.agent-os/instructions/execute-tasks.md`

## Workflow Instructions

When asked to work on this codebase:

1. **First**, check @.agent-os/product/roadmap.md for current priorities
2. **Then**, follow the appropriate instruction file:
   - For new features: @~/.agent-os/instructions/create-spec.md
   - For tasks execution: @~/.agent-os/instructions/execute-tasks.md
3. **Always**, adhere to the standards in the files listed above

## Important Notes

- Product-specific files in `.agent-os/product/` override any global standards
- User's specific instructions override (or amend) instructions found in `.agent-os/specs/...`
- Always adhere to established patterns, code style, and best practices documented above
- Reference design system to reuse: `/mnt/data/Source-home/Calitti/shadcn-radix-nextjs-main` (Next.js 16, shadcn/ui `radix-mira`, Tailwind v4 OKLCH tokens, next-themes). Note: remove `output: "export"` — this product needs SSR + API routes.
- This portal targets **regulated environments**: no third-party data egress, air-gap-friendly, SSO, audit logging, least-privilege integration credentials.
