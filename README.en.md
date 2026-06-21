<div align="center">

<img src="public/logo-mark.png" alt="ACRA Logo" width="120" />

# ACRA — Augmented Cyber Risk Analysis

**The open-source platform that makes EBIOS RM risk analysis accessible to everyone**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![EBIOS RM](https://img.shields.io/badge/Method-EBIOS%20RM-red)](https://cyber.gouv.fr/la-methode-ebios-risk-manager)
[![ANSSI](https://img.shields.io/badge/Compatible-ISO%2027005-green)](https://www.iso.org/standard/75281.html)

**🌐 Langue / Language:** [🇫🇷 Français](README.md) · 🇬🇧 English · [🇩🇪 Deutsch](README.de.md) · [🇪🇸 Español](README.es.md) · [🇮🇹 Italiano](README.it.md)

</div>

---

## 🎯 Overview

**ACRA (Augmented Cyber Risk Analysis)** is a guided web application that lets any security team — even without deep expertise — run a complete risk analysis following the French ANSSI **EBIOS Risk Manager** method, compatible with **ISO 27005**.

### The problem ACRA solves

EBIOS RM risk analyses are demanding: the method has 5 interconnected workshops, dozens of concepts to master, and a single consistency error can invalidate the whole study. In practice, teams rely on complex Excel spreadsheets, expensive consultants, or give up on methodological rigour altogether.

ACRA changes that: it is an **interactive methodological assistant** that guides you step by step, offers clickable examples at every stage, keeps consistency across workshops, and automatically produces a structured PDF report.

### Who is it for?

| Profile | Usage |
|---------|-------|
| 🔒 CISOs & Risk Managers | Drive analyses, approve, oversee the risk portfolio |
| 🔍 Security analysts | Run the workshops, document scenarios, plan measures |
| 🏢 IT & Management | Read summaries, track treatment, validate measure budgets |
| 🎓 Students & trainers | Learn the EBIOS RM method on a concrete tool |

### What sets ACRA apart

- **Built-in methodological guidance**: every field has a tooltip, a link to the ANSSI guide, and contextual examples
- **Automatic consistency**: items from one workshop automatically feed the next
- **7 control frameworks**: ISO 27001:2022, NIST CSF, NIST 800-53, CIS Controls v8, ANSSI Hygiene, HDS, PCI-DSS — from a single interface
- **Flash method (Club EBIOS)**: a guided single pass through the 5 workshops, leveraging capitalization (examples, security baseline) — ideal for a first analysis or a constrained context
- **Club EBIOS guides integrated**: the Flash method and method sheet 5 (stakeholder threat level) are implemented directly in the workflow
- **100% self-hosted**: your data never leaves your infrastructure

---

## ✨ Features

### 📋 Complete EBIOS RM method

- **5 guided workshops** with a library of clickable examples (business values, risk sources, scenarios, measures…)
- **Flash method (Club EBIOS)**: a quick pass W1 → W2 → W3 → W4 → W5 in one go, capitalizing on examples and the security baseline, to quickly produce a risk list and an action plan
- **Interactive EBIOS RM guide** with direct links to the official ANSSI guide pages
- Visual **risk matrix** (severity × likelihood) with residual levels and before/after comparison
- **DICT** criteria (Availability, Integrity, Confidentiality, Traceability) on business values and supporting assets
- MITRE ATT&CK links on operational scenarios
- **Ecosystem threat cartography** (Workshop 3, ANSSI method sheet 5): stakeholder dangerousness computed on 4 sub-criteria, polar radar with 3 zones, configurable scales, critical-third-party flagging — [see details](#️-ecosystem-threat-cartography-workshop-3)
- Cross-cutting **Third parties** view: organization-wide *third-party management*, aggregated across all analyses, filterable by zone and criticality

### 🔐 Security & frameworks

- Security measures from **7 frameworks**: ISO 27001:2022 · NIST CSF · NIST 800-53 · CIS Controls v8 · ANSSI Hygiene · HDS · PCI-DSS + custom controls
- Configurable password policy (length, complexity, expiry, history, lockout)
- Configurable **MFA** (one-time passcode by **email** or **SMS**) with a 60-min confirmation window to avoid accidental lockout
- Configurable **SSO** (SAML 2.0 or OIDC) — automatic account provisioning
- Full, exportable audit trail (CSV)

### 👥 Collaboration & governance

- **5-level RBAC**: ADMIN · CISO · RISK_MANAGER · ANALYST · READER
- Approval workflow: submission → review → approval (CISO or Risk Manager)
- Per-analysis access sharing with individual permissions
- Admin dashboard: user management, account creation, suspension, audit logs
- **Recovery (trash)**: an analysis deleted by a user remains restorable by an administrator for **30 days** before permanent purge

### 📊 Export & reporting

- Structured multi-page **PDF** export (executive summary, KPIs, workshops, measures, methodological appendices)
- **Excel (.xlsx)** export with all tabular data per sheet
- **JSON** export (full, re-importable backup) and **CSV** (tabular data)
- Analysis import from JSON or CSV

### 🌐 UX & accessibility

- Interface in **5 languages**: Français · English · Deutsch · Español · Italiano
- **Auto-save** on every change (no data loss)
- Dashboard with KPIs, charts, critical-risk alerts, global search
- Light / dark / automatic theme
- RGAA-compliant: keyboard navigation, ARIA, accessible contrasts

---

## 🎬 Demo

![ACRA demo — full risk analysis walkthrough](docs/screenshots/acra-demo.gif)

## 📸 Interface preview

| | Light theme | Dark theme |
|---|---|---|
| **Dashboard** | ![](docs/screenshots/dashboard-light.png) | ![](docs/screenshots/dashboard-dark.png) |
| **My analyses** | ![](docs/screenshots/analyses-light.png) | ![](docs/screenshots/analyses-dark.png) |
| **Workshop 1 — Scope & baseline** | ![](docs/screenshots/atelier1-light.png) | ![](docs/screenshots/atelier1-dark.png) |
| **Workshop 5 — Risk treatment** | ![](docs/screenshots/atelier5-light.png) | ![](docs/screenshots/atelier5-dark.png) |
| **Risk mapping** | ![](docs/screenshots/risques-light.png) | ![](docs/screenshots/risques-dark.png) |
| **Workshop 3 — Ecosystem cartography** | ![](docs/screenshots/ecosystem-radar-light.png) | ![](docs/screenshots/ecosystem-radar-dark.png) |
| **Configuration (scales & matrix)** | ![](docs/screenshots/configuration-light.png) | ![](docs/screenshots/configuration-dark.png) |
| **Administration** | ![](docs/screenshots/admin-light.png) | ![](docs/screenshots/admin-dark.png) |
| **Audit log** | ![](docs/screenshots/admin-audit-light.png) | ![](docs/screenshots/admin-audit-dark.png) |

---

## 🚀 Quick Start (Docker)

**No local install of Node, npm or Prisma is required**: the Docker image bundles all
dependencies and the Prisma client, and applies migrations automatically on startup
(the `migrator` service).

```bash
git clone https://github.com/votre-org/acra.git
cd acra
make setup        # generates .env + random secrets (interactive)
docker compose up -d
```

> No `make`? Use directly: `./scripts/setup.sh` (or `npm run setup`).
> Automated / CI install (no questions asked): `./scripts/setup.sh --auto`.

`setup.sh` generates strong secrets for you (`NEXTAUTH_SECRET`, PostgreSQL password,
`SECRETS_ENCRYPTION_KEY`) and **only regenerates missing values** if re-run (details in
the "Detailed installation" section below).

**The application is available at http://localhost:3000.**
Create your account at `/auth/register` — **the first account created automatically
becomes an ADMINISTRATOR**.

To load demonstration data (optional, never in production):

```bash
docker compose exec app npx prisma db seed
# Demo account created: admin@chu-metropole.fr / Acra@Admin2024!
# ⚠️ Testing only — change/delete this account before any production deployment
```

---

## 📦 Detailed installation

### Prerequisites

| Tool | Minimum version | Notes |
|------|-----------------|-------|
| Docker Desktop | 4.x | or Docker Engine + Compose v2 |
| Available RAM | 512 MB | 1 GB recommended |
| Free ports | 3000, 5432 | configurable in `docker-compose.yml` |

> **Without Docker** (local development): Node.js 20+ and PostgreSQL 14+ required — see [Local development](#-local-development).

---

### Step 1 — Clone the repository

```bash
git clone https://github.com/votre-org/acra.git
cd acra
```

---

### Step 2 — Configure the environment (automated)

The setup script creates the `.env` file and **generates strong secrets**. It is
**idempotent**: re-run, it keeps already-defined values and only fills in what's missing.

```bash
./scripts/setup.sh          # interactive (asks for the public URL)
# or, with no interaction at all (random secrets, default URL):
./scripts/setup.sh --auto
```

The script fills in automatically:

| Variable | Role | Generated by setup.sh |
|----------|------|:---:|
| `NEXTAUTH_SECRET` | JWT session signing | ✅ random (48 B) |
| `POSTGRES_PASSWORD` | PostgreSQL password | ✅ random (32 chars) |
| `SECRETS_ENCRYPTION_KEY` | AES-256-GCM encryption of secrets in DB (OIDC, SMS, SMTP) | ✅ random (48 B) |
| `DATABASE_URL` | Prisma connection | ✅ derived from PostgreSQL variables |
| `POSTGRES_USER` / `POSTGRES_DB` | Database identity | `acra_user` / `acra_rm` |
| `NEXTAUTH_URL` | Public URL | asked (default `http://localhost:3000`) |

> **Manual configuration** (alternative): `cp .env.example .env` then replace all
> `CHANGEZ_MOI` values. Generate a secret with `openssl rand -base64 48`.
>
> ⚠️ **Production**: `NEXTAUTH_URL` must be **HTTPS**. Never commit `.env`
> (already in `.gitignore`). If `SECRETS_ENCRYPTION_KEY` changes, secrets already
> encrypted in the database will need to be re-entered in the admin interface.

---

### Step 3 — Start the services

```bash
docker compose up -d
```

Docker starts 3 services:
- **`db`** — PostgreSQL 16 (port 5432)
- **`migrator`** — runs `prisma migrate deploy` on startup (then exits)
- **`app`** — Next.js application (port 3000)

Check that everything is up:

```bash
docker compose ps
# All services should be "running" (except migrator: "exited 0")

curl http://localhost:3000/api/health
# {"status":"ok","db":"connected","timestamp":"..."}
```

---

### Useful commands

```bash
# View logs in real time
docker compose logs -f app

# Stop the services
docker compose down

# Stop AND remove volumes (erases the database)
docker compose down -v

# Rebuild after code changes
docker compose up -d --build

# Access the database via psql (uses the container credentials)
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'

# Run a demo data seed
docker compose exec app npx prisma db seed

# Run migrations manually
docker compose exec app npx prisma migrate deploy
```

---

### Updating

```bash
git pull origin main
docker compose up -d --build
# Migrations are applied automatically on startup
```

---

### Backup and restore

PostgreSQL backups are automated in `docker-compose.yml` (7-day rotation):

```bash
# Manual backup
docker compose exec db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup_$(date +%Y%m%d).sql

# Restore
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"' < backup_20240115.sql
```

---

## 🔧 Local development

To contribute to or customize ACRA without Docker:

### Prerequisites

- **Node.js** 20+ (`node --version`)
- **PostgreSQL** 14+ (or Docker for the DB only)
- **npm** 10+

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/votre-org/acra.git
cd acra

# 2. Install dependencies (also generates the Prisma client via postinstall)
npm install

# 3. Start PostgreSQL via Docker (simplest option)
docker run -d --name acra-db \
  -e POSTGRES_USER=acra_user \
  -e POSTGRES_PASSWORD=acra_secret \
  -e POSTGRES_DB=acra_rm \
  -p 5432:5432 postgres:16-alpine

# 4. Configure the environment (generates .env with secrets)
./scripts/setup.sh --auto
# Locally without Docker for the app, point the DB at localhost:
sed -i 's/@db:5432/@localhost:5432/' .env

# 5. Apply migrations and generate the Prisma client
npx prisma migrate deploy
npx prisma generate

# 6. (Optional) Load demo data
npx prisma db seed

# 7. Start in development mode (hot reload)
npm run dev
```

The application is available at **http://localhost:3000**

### Available scripts

```bash
npm run dev          # Development server (hot reload)
npm run build        # Production build
npm run start        # Production server (after build)
npm run setup        # (Re)generates the .env file (missing secrets)
npm test             # Vitest unit tests (run once)
npm run test:watch   # Tests in watch mode
npm run test:coverage # Coverage report
npx tsc --noEmit     # TypeScript check without compilation
```

### TDD workflow

> **TDD is mandatory**: every new feature must come with a test written *before* the implementation. See [CONTRIBUTING.md](./CONTRIBUTING.md).

```bash
# 1. Write the test (it must fail)
# → src/__tests__/unit/lib/my-feature.test.ts

# 2. Run in watch mode to see the red
npm run test:watch

# 3. Implement until green
# 4. Refactor
```

---

## 🏗️ Architecture

```
ebios-rm/
├── src/
│   ├── app/                          # Next.js pages (App Router)
│   │   ├── page.tsx                  # Landing page
│   │   ├── dashboard/                # KPI dashboard
│   │   ├── analyses/                 # List, creation, detail
│   │   │   └── [id]/atelier/[num]/  # The 5 EBIOS RM workshops
│   │   ├── risques/                  # Global risk view
│   │   ├── actions/                  # Global action plan (filters)
│   │   ├── auth/                     # Login / Register / Reset
│   │   ├── admin/                    # Administration (ADMIN only)
│   │   │   ├── users/                # User management
│   │   │   ├── security/             # MFA, SSO, password policy
│   │   │   ├── audit/                # Audit log
│   │   │   └── config/               # Organization configuration
│   │   ├── configuration/            # Scales, matrix, frameworks
│   │   └── profile/                  # Profile, language, theme
│   │   └── api/                      # REST API routes (Next.js)
│   ├── components/
│   │   ├── workshops/                # Atelier1.tsx → Atelier5.tsx
│   │   ├── Navbar.tsx                # Main navigation + search
│   │   ├── RiskMatrix.tsx            # Interactive risk matrix
│   │   ├── WorkshopProgress.tsx      # Workshop progress bar
│   │   ├── EbiosGuide.tsx            # Interactive EBIOS RM guide
│   │   ├── FrameworkControlsPanel.tsx # Multi-framework measures panel
│   │   └── AnalysesChart.tsx         # Dashboard charts
│   └── lib/
│       ├── ebios-data.ts             # EBIOS RM library (suggestions)
│       ├── frameworks-data.ts        # ISO 27001, NIST, CIS controls…
│       ├── permissions.ts            # Centralized RBAC matrix
│       ├── logger.ts                 # Structured Winston logs + audit trail
│       ├── useAutoSave.ts            # React auto-save hook
│       ├── password-policy.ts        # Password policy validation
│       ├── prisma.ts                 # Prisma singleton client
│       └── i18n/                     # Translations (fr/en/de/es/it)
├── prisma/
│   ├── schema.prisma                 # PostgreSQL data model
│   └── migrations/                   # Versioned SQL migrations
├── src/__tests__/                    # Vitest unit tests
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

### Tech stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Next.js App Router (Server + Client Components) | 16 |
| Language | TypeScript strict | 5 |
| Database | PostgreSQL | 16 |
| ORM | Prisma | 5 |
| Authentication | NextAuth.js (credentials + JWT) | 4 |
| UI | Tailwind CSS | 3 |
| PDF export | @react-pdf/renderer (server-side) | — |
| Excel export | ExcelJS | — |
| Tests | Vitest + Testing Library | — |
| Logs | Winston (structured JSON) | — |
| Deployment | Docker + Docker Compose | — |

---

## 🔒 Security

### Measures in place

- Passwords hashed with **bcrypt** (cost 12)
- Signed **JWT** sessions (`NEXTAUTH_SECRET`)
- Next.js authentication middleware on all protected routes
- **Security HTTP headers**: X-Frame-Options, CSP, X-Content-Type-Options, Referrer-Policy, HSTS
- Server-side input validation: **Zod** schemas (authentication, admin policies) and **allowlist sanitizers** on workshops and imports (anti mass-assignment, CWE-915)
- Per-user data isolation + per-analysis RBAC
- **Full audit trail** (`AuditLog` table) for all sensitive actions, exportable to CSV
- Rate limiting on authentication routes
- Configurable **MFA** with a safety window (auto-disabled if not confirmed within 60 min)
- Configurable **SSO** SAML 2.0 / OIDC

### Production checklist

```bash
# 1. Generate all secrets (NEXTAUTH_SECRET, PostgreSQL password,
#    SECRETS_ENCRYPTION_KEY) in one command — idempotent:
./scripts/setup.sh --auto

# 2. Set the public HTTPS URL in .env
#    NEXTAUTH_URL=https://acra.mydomain.com   (HTTPS required)

# 3. Put it behind an HTTPS reverse proxy (Nginx, Caddy, Traefik + TLS)

# 4. Do NOT load the demo seed in production. If it was loaded by mistake:
#    log in at /admin/users and delete/reset admin@chu-metropole.fr

# 5. Start and check the health check
docker compose up -d
curl https://your-domain.com/api/health
# {"status":"ok","db":"connected",...}
```

> The **first account** created at `/auth/register` becomes an **ADMINISTRATOR**.
> Create it immediately after deployment so a third party cannot claim that role
> (registration is open by default).

> A full OWASP/WSTG security audit was conducted on the application. See the report in [docs/](./docs/).

---

## 📖 The 5 EBIOS RM workshops

| # | Workshop | Description |
|---|----------|-------------|
| **W1** | Scope & security baseline | Scope, missions, business values (DICT criteria), supporting assets, feared events, security frameworks |
| **W2** | Risk sources | Identify attackers, targeted objectives (RS/TO couples), P1/P2 relevance levels |
| **W3** | Strategic scenarios | Ecosystem, **stakeholder threat cartography** (dangerousness radar), attack paths, ecosystem security measures |
| **W4** | Operational scenarios | Attackers' technical actions, likelihood, MITRE ATT&CK links |
| **W5** | Risk treatment | Treatment strategies (reduce, transfer, refuse, accept), per-framework measures, residual risks, action plan |

> **⚡ Flash method (Club EBIOS)**: a fast pass W1 → W2 → W3 → W4 → W5, available from the dashboard. Following the Club EBIOS "Flash" approach, all workshops are run in a single pass by capitalizing on examples and the security baseline, focusing on the most relevant scenarios (≈ 5 max). The scale and matrix remain those configured by the administrator. Ideal for a first analysis or a constrained context.

---

## 🗺️ Ecosystem threat cartography (Workshop 3)

ACRA implements **ANSSI / Club EBIOS method sheet 5** ("estimating the dangerousness of stakeholders") to prioritize ecosystem third parties: suppliers, service providers, clients, partners, regulators.

A third party's threat level is computed from **4 sub-criteria** rated on configurable qualitative scales:

```text
              Dependency × Penetration              (exposure, ↑ threat)
threat  =  ───────────────────────────────────
              Cyber maturity × Trust                 (reliability, ↓ threat)
```

Third parties are placed on a **polar radar**: the closer to the centre, the higher the threat. Three **equal-width** zones — danger / control / watch — drive prioritization (third parties in danger or control are *critical* and feed the strategic scenarios).

| Threat radar | Calculation diagram (built-in help) |
|---|---|
| ![Ecosystem threat radar](docs/screenshots/ecosystem-radar-light.png) | ![Threat level calculation](docs/screenshots/ecosystem-formula-light.png) |

**Reading the radar:**

- **Colour** of a point = cyber reliability (red low → green high)
- **Size** of a point = exposure (bigger = more exposed)
- **Rings** = threat zones (danger orange · control yellow · watch green)
- **★** = third party manually flagged *critical*
- **Label** = editable short name (click or **double-click** the point) or ref `T1, T2…`
- Hovering a point → details of the 4 sub-criteria, exposure/reliability and threat

**Rank 2 / 3 tiers (ecosystem depth)** — following Club EBIOS method sheet 5, a critical tier can be broken down into **connected stakeholders** (e.g. a provider's host, a partner's subcontractor). ACRA handles three depth ranks: from a critical tier, the **"+ connected stakeholder"** button adds a **rank-2** stakeholder, itself divisible into **rank 3**. On the radar, a **"Ranks 2/3"** checkbox reveals these connected tiers (hidden by default), dimmed and **linked to their parent tier by a dashed line**, with automatic avoidance of point/label overlaps. The executive summary (PDF) stays focused on rank-1 tiers for readability.

**Configurable scales** — each level of the 4 criteria (1→4 by default) can be renamed in `Configuration → Ecosystem`, with levels added/removed (ADMIN only). The radar adapts automatically to the scale.

![Configurable dangerousness scales](docs/screenshots/ecosystem-scales-light.png)

**Cross-cutting Third parties view** — the **Third parties** page aggregates stakeholders from **all** analyses, filterable by zone and criticality (★), for organization-wide *third-party management*. A same third party may appear several times (its dangerousness depends on the analysed scope).

![Cross-cutting third parties view](docs/screenshots/tiers-light.png)

The radar, criticality stars and the stakeholder table (4 sub-criteria + *Critical* column) are also present in the **PDF export**.

---

## 🏛️ Recommended secure architecture (ANSSI best practices)

ACRA handles sensitive data (risk analyses, ecosystem cartography). Deployment should follow the **ANSSI IT hygiene guide** principles: segmentation, defence in depth, least privilege, strong authentication, logging.

### Case 1 — Internal *on-premises* hosting (recommended)

Host **in your datacenter**, behind a firewall, with no direct Internet exposure. Preferred scenario for the most sensitive data.

```mermaid
flowchart LR
  U["Internal workstations<br/>(LAN / VPN)"] -->|HTTPS / TLS 1.2+| FW["Firewall + WAF"]
  subgraph DC["Internal datacenter — segmented trust zone"]
    FW --> RP["Reverse proxy TLS<br/>Nginx / Caddy / Traefik<br/>HSTS, security headers"]
    RP --> APP["ACRA (Next.js)<br/>Docker container"]
    IDP["SSO IdP<br/>SAML 2.0 / OIDC<br/>+ MFA admins"] -.->|federation| APP
    APP --> DB[("PostgreSQL<br/>private network<br/>encrypted at rest")]
    APP --> BK[("Backups<br/>encrypted, offline")]
    APP --> SIEM["Logs / SIEM"]
  end
```

**Key measures:**
- **Segmented** network (dedicated VLAN), application **not exposed** to the Internet; access via LAN or **VPN**.
- **Firewall** + WAF upstream; reverse proxy terminating HTTPS in **TLS 1.2+** (`NEXTAUTH_URL=https://…`), **HSTS** enabled.
- **SSO** (SAML/OIDC) + **mandatory MFA for administrators** (email/SMS OTP).
- PostgreSQL **never publicly exposed**, **encrypted at rest**, access restricted to the app.
- **Encrypted backups**, regular and tested; secrets via a vault (`SECRETS_ENCRYPTION_KEY`).
- Centralized **logging** (ACRA audit trail + Winston logs → SIEM); periodic access reviews.

### Case 2 — External *PaaS / IaaS* hosting (cloud)

If hosting on an external cloud (IaaS/PaaS), **reduce the attack surface** and strengthen authentication for **all** accounts.

```mermaid
flowchart LR
  U["Users"] -->|"SSL VPN **or** IP allowlist"| GW["Gateway<br/>WAF + TLS"]
  subgraph CL["PaaS / IaaS cloud — exposed zone"]
    GW --> APP["Containerized ACRA"]
    IDP["SSO IdP + MFA<br/>for ALL accounts"] -.->|federation| APP
    APP --> DB[("Managed PostgreSQL<br/>private access, encrypted")]
    APP --> SIEM["Logs exported<br/>to SIEM"]
  end
```

**Key measures (in addition to case 1):**
- Restricted access via **IP allowlist** **or** **SSL VPN** — no open public access.
- **SSO + MFA for ALL users** (not just admins).
- **Managed database on a private network** (never a public IP), encryption in transit and at rest.
- Secrets in a **managed vault** (KMS / Secrets Manager); regular rotation.
- Logs exported to a **SIEM**; alerting on sensitive events (logins, exports, deletions).

### What ACRA provides to apply these best practices

| ANSSI best practice | ACRA feature |
|---|---|
| Strong authentication | **MFA** email/SMS OTP, `ALL` or `ADMIN_ONLY` scope |
| Federated identity | **SSO** SAML 2.0 / OIDC with auto-provisioning |
| Least privilege | **RBAC** 5 roles + per-analysis sharing |
| Traceability | Full **audit trail**, CSV-exportable |
| Confidentiality in transit | Enforced HTTPS + **security headers** (CSP, HSTS, X-Frame-Options…) |
| Secret protection | Encrypted secrets (`SECRETS_ENCRYPTION_KEY`), bcrypt (cost 12) |
| Reversibility / error tolerance | **30-day trash** (soft delete + admin recovery) |
| Input robustness | Zod + **allowlist sanitizers** (anti mass-assignment) |

---

## 🌐 Internationalization

The interface is available in **5 languages**, selectable at any time in the profile:

| Code | Language | Completeness |
|------|----------|-------------|
| `fr` | Français | ✅ 100% (reference) |
| `en` | English | ✅ 100% |
| `de` | Deutsch | ✅ 100% |
| `es` | Español | ✅ 100% |
| `it` | Italiano | ✅ 100% |

To add a language, copy `src/lib/i18n/fr.ts`, translate all keys and save the file with the matching ISO 639-1 code. TypeScript automatically checks that all keys are present.

---

## 👥 User roles (RBAC)

| Role | Create analysis | Edit | Approve | Admin |
|------|:---:|:---:|:---:|:---:|
| `ADMIN` | ✅ | ✅ all | ✅ | ✅ |
| `RSSI` (CISO) | ✅ | ✅ own + shared | ✅ | ❌ |
| `RISK_MANAGER` | ✅ | ✅ own + shared | ✅ | ❌ |
| `ANALYSTE` (Analyst) | ✅ | ✅ own + shared | ❌ | ❌ |
| `LECTEUR` (Reader) | ❌ | ❌ | ❌ | ❌ |

Access can also be granted **analysis by analysis** (ad-hoc sharing with any user).

---

## 🛠️ Troubleshooting

### The application won't start

```bash
# Check container status
docker compose ps

# View detailed logs
docker compose logs app
docker compose logs migrator

# Check that ports are free
lsof -i :3000
lsof -i :5432
```

### Prisma migration error

```bash
# Force migration resolution
docker compose exec app npx prisma migrate resolve --applied "migration_name"
docker compose exec app npx prisma migrate deploy
```

### Database connection issue

```bash
# Check connectivity
docker compose exec app npx prisma db execute --stdin <<< "SELECT 1;"

# Check the DATABASE_URL variable in .env
docker compose exec app env | grep DATABASE
```

### Fully reset the application

```bash
# ⚠️ Erases all data
docker compose down -v
docker compose up -d
```

---

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full guide.

**TL;DR:**
1. Fork the repo and create a `feature/my-feature` branch
2. Write the tests first (**TDD mandatory** — see CLAUDE.md)
3. Implement and make sure `npm test` is green
4. Add translations to the **5 i18n files** if UI strings are added
5. Run `npx tsc --noEmit` — zero TypeScript errors
6. Open a Pull Request with a clear description

---

## 📄 License

MIT — see [LICENSE](./LICENSE)

The EBIOS RM methodology is developed and maintained by [ANSSI](https://cyber.gouv.fr/la-methode-ebios-risk-manager). This application is not affiliated with ANSSI.
