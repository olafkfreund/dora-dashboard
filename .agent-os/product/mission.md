# Product Mission

> Last Updated: 2026-07-06
> Version: 1.0.0

## Pitch

DORA Dashboard is a Docker-based delivery-intelligence portal that helps engineering
leaders and delivery teams in highly regulated environments understand and improve
software delivery performance by unifying DORA metrics and Synechron's extended
delivery/quality metrics from GitHub and Jira behind enterprise SSO.

## Users

### Primary Customers

- **Regulated enterprises (finance, insurance, healthcare, public sector):** Organizations that must evidence delivery performance under audit and cannot send delivery data to third-party SaaS.
- **Engineering & delivery leadership:** Heads of Engineering, Delivery Managers, and Agile leads who own KPIs/CSFs and need trustworthy, source-of-truth metrics.

### User Personas

**Head of Engineering** (40-55 years old)
- **Role:** Engineering Director / VP Engineering
- **Context:** Accountable for delivery performance across multiple squads in a regulated bank; reports metrics upward to executives and auditors.
- **Pain Points:** Metrics scattered across GitHub and Jira, manually compiled in spreadsheets; no defensible audit trail; SaaS analytics tools blocked by security.
- **Goals:** A single self-hosted source of truth; trend visibility; evidence for continuous-improvement narratives.

**Delivery / Agile Lead** (30-45 years old)
- **Role:** Delivery Manager / Scrum Master / RTE
- **Context:** Runs sprint ceremonies for 3-6 squads; needs to spot bottlenecks (blocked time, ageing work) early.
- **Pain Points:** Velocity and predictability computed by hand; blocked/ageing items only surface in standups; no leading indicators.
- **Goals:** Real-time flow health, predictability tracking, early-warning on ageing/blocked work.

**Platform / DevOps Engineer** (28-45 years old)
- **Role:** Platform Engineer / SRE
- **Context:** Operates the internal developer platform; must deploy the portal into a locked-down Kubernetes/Docker estate.
- **Pain Points:** Tools that assume internet egress, embed secrets, or lack SSO; hard to harden and audit.
- **Goals:** A hardened container image, Helm chart, Entra ID SSO, least-privilege integration tokens.

## The Problem

### Delivery metrics are fragmented and unauditable

DORA and delivery/quality signals live in GitHub (commits, PRs, deployments) and Jira
(work items, story points, transitions), and are typically stitched together by hand.
Teams spend hours per sprint compiling spreadsheets that are error-prone and impossible
to audit, and executives cannot trust the numbers.

**Our Solution:** Automatically ingest from GitHub and Jira, compute DORA-4 and extended
metrics with documented formulas, and present them in a single self-hosted portal.

### SaaS analytics tools are banned in regulated estates

Most delivery-analytics products are multi-tenant SaaS that require sending source and
work-item data outside the organization, which security and compliance teams prohibit.

**Our Solution:** A fully self-hosted, air-gap-friendly Docker/Kubernetes deployment with
no third-party data egress and enterprise SSO (Azure Entra ID) plus GitHub OAuth.

### No leading indicators for flow health

By the time a sprint misses, the causes (ageing work items, blocked time, low test
automation) are already baked in. Teams lack early-warning signals.

**Our Solution:** Track Work Item Age, Blocked Time, Delivery Predictability, and Test
Automation Coverage as leading indicators with trends and thresholds.

## Differentiators

### Self-hosted and audit-ready by design

Unlike SaaS delivery-analytics platforms (LinearB, Sleuth, Haystack), we provide a fully
self-hosted, air-gap-capable deployment with SSO and documented metric formulas. This
results in adoption inside regulated estates where SaaS is a non-starter, with a
defensible audit trail.

### DORA-4 plus Synechron's extended metric set

Unlike generic DORA dashboards that stop at the four keys, we combine DORA-4 with the
Synechron extended metrics (Cycle Time, Work Item Age, Delivery Predictability, Blocked
Time, Defect Escape Rate, Defect Root Cause, Average Velocity, Test Automation Coverage).
This results in both outcome metrics and the leading indicators teams need to act.

### Unified GitHub + Jira correlation

Unlike single-source tools, we correlate GitHub delivery events with Jira work items to
compute end-to-end lead and cycle time. This results in metrics that reflect the whole
value stream rather than just code or just tickets.

## Key Features

### Core Metrics

- **DORA-4 Metrics:** Deployment Frequency, Lead Time for Changes, Change Failure Rate, and Mean Time to Restore, computed from GitHub deployments and incidents.
- **Flow Metrics:** Cycle Time, Lead Time, Work Item Age, and Blocked Time from Jira transitions correlated with GitHub activity.
- **Predictability & Velocity:** Delivery Predictability (committed vs. completed) and Average Velocity over the last 3-5 sprints.
- **Quality Metrics:** Defect Escape Rate, Defect Root Cause analysis, and Test Automation Coverage.

### Platform & Integration

- **GitHub Integration:** OAuth app + fine-grained token ingestion of PRs, deployments, and workflow runs.
- **Jira Integration:** Ingestion of issues, sprints, story points, and status transitions.
- **Azure Entra ID SSO:** OIDC single sign-on for enterprise identity, with role-based access.
- **GitHub OAuth Login:** Alternative OAuth sign-in for GitHub-centric teams.

### Enterprise & Operations

- **Self-Hosted Docker Deployment:** Hardened container image with docker-compose and a Helm chart for Kubernetes.
- **Audit & Governance:** Documented metric formulas, data lineage, and access audit logging suitable for regulated environments.
