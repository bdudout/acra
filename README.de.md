<div align="center">

<img src="public/logo-mark.png" alt="ACRA Logo" width="120" />

# ACRA — Augmented Cyber Risk Analysis

**Die Open-Source-Plattform, die EBIOS-RM-Risikoanalysen für alle zugänglich macht**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![EBIOS RM](https://img.shields.io/badge/Methode-EBIOS%20RM-red)](https://cyber.gouv.fr/la-methode-ebios-risk-manager)
[![ANSSI](https://img.shields.io/badge/Kompatibel-ISO%2027005-green)](https://www.iso.org/standard/75281.html)

**🌐 Langue / Language:** [🇫🇷 Français](README.md) · [🇬🇧 English](README.en.md) · 🇩🇪 Deutsch · [🇪🇸 Español](README.es.md) · [🇮🇹 Italiano](README.it.md)

</div>

---

## 🎯 Überblick

**ACRA (Augmented Cyber Risk Analysis)** ist eine geführte Webanwendung, mit der jedes Sicherheitsteam — auch ohne tiefes Fachwissen — eine vollständige Risikoanalyse nach der **EBIOS Risk Manager**-Methode der französischen ANSSI durchführen kann, kompatibel mit **ISO 27005**.

### Das Problem, das ACRA löst

EBIOS-RM-Risikoanalysen sind anspruchsvoll: Die Methode umfasst 5 miteinander verbundene Workshops, Dutzende zu beherrschende Konzepte, und schon ein einziger Konsistenzfehler kann die gesamte Studie entwerten. In der Praxis greifen Teams auf komplexe Excel-Tabellen oder teure Berater zurück — oder verzichten auf methodische Strenge.

ACRA ändert das: Es ist ein **interaktiver methodischer Assistent**, der Schritt für Schritt führt, in jeder Phase anklickbare Beispiele anbietet, die Konsistenz zwischen den Workshops wahrt und automatisch einen strukturierten PDF-Bericht erzeugt.

### Für wen?

| Profil | Nutzung |
|--------|---------|
| 🔒 CISOs & Risk Manager | Analysen steuern, freigeben, das Risikoportfolio überwachen |
| 🔍 Sicherheitsanalysten | Workshops durchführen, Szenarien dokumentieren, Maßnahmen planen |
| 🏢 IT & Leitung | Zusammenfassungen lesen, Behandlung verfolgen, Maßnahmenbudgets freigeben |
| 🎓 Studierende & Lehrende | Die EBIOS-RM-Methode an einem konkreten Werkzeug lernen |

### Was ACRA auszeichnet

- **Integrierte methodische Anleitung**: Jedes Feld hat einen Tooltip, einen Link zum ANSSI-Leitfaden und kontextbezogene Beispiele
- **Automatische Konsistenz**: Elemente eines Workshops fließen automatisch in die folgenden ein
- **7 Maßnahmen-Frameworks**: ISO 27001:2022, NIST CSF, NIST 800-53, CIS Controls v8, ANSSI-Hygiene, HDS, PCI-DSS — aus einer einzigen Oberfläche
- **Express-Modus**: eine vollständige Analyse (W1+W2+W5) in unter 30 Minuten für dringende Kontexte
- **100 % selbst gehostet**: Ihre Daten verlassen niemals Ihre Infrastruktur

---

## ✨ Funktionen

### 📋 Vollständige EBIOS-RM-Methode

- **5 geführte Workshops** mit einer Bibliothek anklickbarer Beispiele (Geschäftswerte, Risikoquellen, Szenarien, Maßnahmen…)
- **Express-Analysemodus** (W1 + W2 + W5), um schnell eine Risikoliste und einen Aktionsplan zu erhalten
- **Interaktiver EBIOS-RM-Leitfaden** mit Direktlinks zu den Seiten des offiziellen ANSSI-Leitfadens
- Visuelle **Risikomatrix** (Schweregrad × Wahrscheinlichkeit) mit Restrisikoniveaus und Vorher/Nachher-Vergleich
- **DICT**-Kriterien (Verfügbarkeit, Integrität, Vertraulichkeit, Nachvollziehbarkeit) für Geschäftswerte und unterstützende Güter
- MITRE-ATT&CK-Links bei operativen Szenarien

### 🔐 Sicherheit & Frameworks

- Sicherheitsmaßnahmen aus **7 Frameworks**: ISO 27001:2022 · NIST CSF · NIST 800-53 · CIS Controls v8 · ANSSI-Hygiene · HDS · PCI-DSS + benutzerdefinierte Kontrollen
- Konfigurierbare Passwortrichtlinie (Länge, Komplexität, Ablauf, Verlauf, Sperrung)
- Konfigurierbare **MFA** (TOTP, SMS) mit 60-Minuten-Bestätigungsfenster zur Vermeidung versehentlicher Sperrung
- Konfigurierbares **SSO** (SAML 2.0 oder OIDC) — automatische Kontobereitstellung
- Vollständiger, exportierbarer Audit-Trail (CSV)

### 👥 Zusammenarbeit & Governance

- **5-stufiges RBAC**: ADMIN · CISO · RISK_MANAGER · ANALYST · LESER
- Freigabe-Workflow: Einreichung → Prüfung → Freigabe (CISO oder Risk Manager)
- Zugriffsfreigabe pro Analyse mit individuellen Berechtigungen
- Admin-Dashboard: Benutzerverwaltung, Kontoerstellung, Sperrung, Audit-Logs

### 📊 Export & Reporting

- Strukturierter mehrseitiger **PDF**-Export (Executive Summary, KPIs, Workshops, Maßnahmen, methodische Anhänge)
- **Excel (.xlsx)**-Export mit allen tabellarischen Daten pro Blatt
- **JSON**-Export (vollständiges, re-importierbares Backup) und **CSV** (tabellarische Daten)
- Analyse-Import aus JSON oder CSV

### 🌐 UX & Barrierefreiheit

- Oberfläche in **5 Sprachen**: Français · English · Deutsch · Español · Italiano
- **Auto-Speichern** bei jeder Änderung (kein Datenverlust)
- Dashboard mit KPIs, Diagrammen, Warnungen zu kritischen Risiken, globaler Suche
- Helles / dunkles / automatisches Theme
- RGAA-konform: Tastaturnavigation, ARIA, barrierefreie Kontraste

---

## 🎬 Demo

![ACRA-Demo — kompletter Durchlauf einer Risikoanalyse](docs/screenshots/acra-demo.gif)

## 📸 Oberflächen-Vorschau

| | Helles Theme | Dunkles Theme |
|---|---|---|
| **Dashboard** | ![](docs/screenshots/dashboard-light.png) | ![](docs/screenshots/dashboard-dark.png) |
| **Meine Analysen** | ![](docs/screenshots/analyses-light.png) | ![](docs/screenshots/analyses-dark.png) |
| **Workshop 1 — Rahmen & Basis** | ![](docs/screenshots/atelier1-light.png) | ![](docs/screenshots/atelier1-dark.png) |
| **Workshop 5 — Risikobehandlung** | ![](docs/screenshots/atelier5-light.png) | ![](docs/screenshots/atelier5-dark.png) |
| **Risiko-Mapping** | ![](docs/screenshots/risques-light.png) | ![](docs/screenshots/risques-dark.png) |
| **Konfiguration (Skalen & Matrix)** | ![](docs/screenshots/configuration-light.png) | ![](docs/screenshots/configuration-dark.png) |
| **Administration** | ![](docs/screenshots/admin-light.png) | ![](docs/screenshots/admin-dark.png) |
| **Audit-Protokoll** | ![](docs/screenshots/admin-audit-light.png) | ![](docs/screenshots/admin-audit-dark.png) |

---

## 🚀 Schnellstart (Docker)

**Keine lokale Installation von Node, npm oder Prisma erforderlich**: Das Docker-Image
bündelt alle Abhängigkeiten und den Prisma-Client und wendet die Migrationen beim Start
automatisch an (Dienst `migrator`).

```bash
git clone https://github.com/votre-org/acra.git
cd acra
make setup        # erzeugt .env + zufällige Secrets (interaktiv)
docker compose up -d
```

> Kein `make`? Direkt verwenden: `./scripts/setup.sh` (oder `npm run setup`).
> Automatisierte / CI-Installation (ohne Rückfragen): `./scripts/setup.sh --auto`.

`setup.sh` erzeugt für Sie starke Secrets (`NEXTAUTH_SECRET`, PostgreSQL-Passwort,
`SECRETS_ENCRYPTION_KEY`) und **regeneriert bei erneutem Lauf nur fehlende Werte**
(Details im Abschnitt „Detaillierte Installation" unten).

**Die Anwendung ist unter http://localhost:3000 erreichbar.**
Erstellen Sie Ihr Konto unter `/auth/register` — **das erste erstellte Konto wird
automatisch ADMINISTRATOR**.

Zum Laden der Demodaten (optional, niemals in Produktion):

```bash
docker compose exec app npx prisma db seed
# Erstelltes Demokonto: admin@chu-metropole.fr / Acra@Admin2024!
# ⚠️ Nur zum Testen — ändern/löschen Sie dieses Konto vor jedem Produktiveinsatz
```

---

## 📦 Detaillierte Installation

### Voraussetzungen

| Werkzeug | Mindestversion | Hinweise |
|----------|----------------|----------|
| Docker Desktop | 4.x | oder Docker Engine + Compose v2 |
| Verfügbarer RAM | 512 MB | 1 GB empfohlen |
| Freie Ports | 3000, 5432 | in `docker-compose.yml` konfigurierbar |

> **Ohne Docker** (lokale Entwicklung): Node.js 20+ und PostgreSQL 14+ erforderlich — siehe [Lokale Entwicklung](#-lokale-entwicklung).

---

### Schritt 1 — Repository klonen

```bash
git clone https://github.com/votre-org/acra.git
cd acra
```

---

### Schritt 2 — Umgebung konfigurieren (automatisiert)

Das Setup-Skript erstellt die Datei `.env` und **erzeugt starke Secrets**. Es ist
**idempotent**: erneut ausgeführt, behält es bereits definierte Werte und ergänzt nur Fehlendes.

```bash
./scripts/setup.sh          # interaktiv (fragt nach öffentlicher URL und KI-Schlüssel)
# oder ganz ohne Interaktion (zufällige Secrets, Standard-URL):
./scripts/setup.sh --auto
```

Das Skript füllt automatisch aus:

| Variable | Rolle | Von setup.sh erzeugt |
|----------|-------|:---:|
| `NEXTAUTH_SECRET` | Signatur der JWT-Sitzungen | ✅ zufällig (48 B) |
| `POSTGRES_PASSWORD` | PostgreSQL-Passwort | ✅ zufällig (32 Zeichen) |
| `SECRETS_ENCRYPTION_KEY` | AES-256-GCM-Verschlüsselung der Secrets in der DB (OIDC, SMS, SMTP) | ✅ zufällig (48 B) |
| `DATABASE_URL` | Prisma-Verbindung | ✅ aus PostgreSQL-Variablen abgeleitet |
| `POSTGRES_USER` / `POSTGRES_DB` | Datenbank-Identität | `acra_user` / `acra_rm` |
| `NEXTAUTH_URL` | Öffentliche URL | abgefragt (Standard `http://localhost:3000`) |
| `ANTHROPIC_API_KEY` | KI-Schlüssel (optional) | nie erzeugt — leer gelassen, falls nicht vorhanden |

> **Manuelle Konfiguration** (Alternative): `cp .env.example .env`, dann alle
> `CHANGEZ_MOI`-Werte ersetzen. Ein Secret erzeugen mit `openssl rand -base64 48`.
>
> ⚠️ **Produktion**: `NEXTAUTH_URL` muss **HTTPS** sein. Committen Sie niemals `.env`
> (bereits in `.gitignore`). Wenn sich `SECRETS_ENCRYPTION_KEY` ändert, müssen die
> bereits in der DB verschlüsselten Secrets in der Admin-Oberfläche neu eingegeben werden.

---

### Schritt 3 — Dienste starten

```bash
docker compose up -d
```

Docker startet 3 Dienste:
- **`db`** — PostgreSQL 16 (Port 5432)
- **`migrator`** — führt `prisma migrate deploy` beim Start aus (beendet sich danach)
- **`app`** — Next.js-Anwendung (Port 3000)

Prüfen, ob alles läuft:

```bash
docker compose ps
# Alle Dienste sollten „running" sein (außer migrator: „exited 0")

curl http://localhost:3000/api/health
# {"status":"ok","db":"connected","timestamp":"..."}
```

---

### Nützliche Befehle

```bash
# Logs in Echtzeit ansehen
docker compose logs -f app

# Dienste stoppen
docker compose down

# Stoppen UND Volumes entfernen (löscht die Datenbank)
docker compose down -v

# Nach Codeänderungen neu bauen
docker compose up -d --build

# Auf die Datenbank per psql zugreifen (verwendet die Container-Zugangsdaten)
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'

# Einen Demo-Daten-Seed ausführen
docker compose exec app npx prisma db seed

# Migrationen manuell ausführen
docker compose exec app npx prisma migrate deploy
```

---

### Aktualisierung

```bash
git pull origin main
docker compose up -d --build
# Migrationen werden beim Start automatisch angewendet
```

---

### Sicherung und Wiederherstellung

PostgreSQL-Sicherungen sind in `docker-compose.yml` automatisiert (7-Tage-Rotation):

```bash
# Manuelle Sicherung
docker compose exec db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup_$(date +%Y%m%d).sql

# Wiederherstellung
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"' < backup_20240115.sql
```

---

## 🔧 Lokale Entwicklung

Um ohne Docker zu ACRA beizutragen oder es anzupassen:

### Voraussetzungen

- **Node.js** 20+ (`node --version`)
- **PostgreSQL** 14+ (oder Docker nur für die DB)
- **npm** 10+

### Installation

```bash
# 1. Repository klonen
git clone https://github.com/votre-org/acra.git
cd acra

# 2. Abhängigkeiten installieren (erzeugt via postinstall auch den Prisma-Client)
npm install

# 3. PostgreSQL per Docker starten (einfachste Option)
docker run -d --name acra-db \
  -e POSTGRES_USER=acra_user \
  -e POSTGRES_PASSWORD=acra_secret \
  -e POSTGRES_DB=acra_rm \
  -p 5432:5432 postgres:16-alpine

# 4. Umgebung konfigurieren (erzeugt .env mit Secrets)
./scripts/setup.sh --auto
# Lokal ohne Docker für die App die DB auf localhost zeigen lassen:
sed -i 's/@db:5432/@localhost:5432/' .env

# 5. Migrationen anwenden und Prisma-Client erzeugen
npx prisma migrate deploy
npx prisma generate

# 6. (Optional) Demodaten laden
npx prisma db seed

# 7. Im Entwicklungsmodus starten (Hot Reload)
npm run dev
```

Die Anwendung ist unter **http://localhost:3000** erreichbar

### Verfügbare Skripte

```bash
npm run dev          # Entwicklungsserver (Hot Reload)
npm run build        # Produktions-Build
npm run start        # Produktionsserver (nach dem Build)
npm run setup        # (Neu-)Erzeugung der .env-Datei (fehlende Secrets)
npm test             # Vitest-Unit-Tests (einmalig)
npm run test:watch   # Tests im Watch-Modus
npm run test:coverage # Abdeckungsbericht
npx tsc --noEmit     # TypeScript-Prüfung ohne Kompilierung
```

### TDD-Workflow

> **TDD ist Pflicht**: Jede neue Funktion muss mit einem Test *vor* der Implementierung kommen. Siehe [CONTRIBUTING.md](./CONTRIBUTING.md).

```bash
# 1. Test schreiben (er muss fehlschlagen)
# → src/__tests__/unit/lib/my-feature.test.ts

# 2. Im Watch-Modus laufen lassen, um Rot zu sehen
npm run test:watch

# 3. Implementieren bis Grün
# 4. Refaktorieren
```

---

## 🏗️ Architektur

```
ebios-rm/
├── src/
│   ├── app/                          # Next.js-Seiten (App Router)
│   │   ├── page.tsx                  # Landing Page
│   │   ├── dashboard/                # KPI-Dashboard
│   │   ├── analyses/                 # Liste, Erstellung, Detail
│   │   │   └── [id]/atelier/[num]/  # Die 5 EBIOS-RM-Workshops
│   │   ├── risques/                  # Globale Risikoansicht
│   │   ├── actions/                  # Globaler Aktionsplan (Filter)
│   │   ├── auth/                     # Login / Register / Reset
│   │   ├── admin/                    # Administration (nur ADMIN)
│   │   │   ├── users/                # Benutzerverwaltung
│   │   │   ├── security/             # MFA, SSO, Passwortrichtlinie
│   │   │   ├── audit/                # Audit-Protokoll
│   │   │   └── config/               # Organisationskonfiguration
│   │   ├── configuration/            # Skalen, Matrix, Frameworks
│   │   └── profile/                  # Profil, Sprache, Theme
│   │   └── api/                      # REST-API-Routen (Next.js)
│   ├── components/
│   │   ├── workshops/                # Atelier1.tsx → Atelier5.tsx
│   │   ├── Navbar.tsx                # Hauptnavigation + Suche
│   │   ├── RiskMatrix.tsx            # Interaktive Risikomatrix
│   │   ├── WorkshopProgress.tsx      # Workshop-Fortschrittsbalken
│   │   ├── EbiosGuide.tsx            # Interaktiver EBIOS-RM-Leitfaden
│   │   ├── FrameworkControlsPanel.tsx # Multi-Framework-Maßnahmenpanel
│   │   └── AnalysesChart.tsx         # Dashboard-Diagramme
│   └── lib/
│       ├── ebios-data.ts             # EBIOS-RM-Bibliothek (Vorschläge)
│       ├── frameworks-data.ts        # ISO 27001-, NIST-, CIS-Kontrollen…
│       ├── permissions.ts            # Zentrale RBAC-Matrix
│       ├── logger.ts                 # Strukturierte Winston-Logs + Audit-Trail
│       ├── useAutoSave.ts            # React-Auto-Save-Hook
│       ├── password-policy.ts        # Validierung der Passwortrichtlinie
│       ├── prisma.ts                 # Prisma-Singleton-Client
│       └── i18n/                     # Übersetzungen (fr/en/de/es/it)
├── prisma/
│   ├── schema.prisma                 # PostgreSQL-Datenmodell
│   └── migrations/                   # Versionierte SQL-Migrationen
├── src/__tests__/                    # Vitest-Unit-Tests
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

### Technologie-Stack

| Schicht | Technologie | Version |
|---------|-------------|---------|
| Framework | Next.js App Router (Server + Client Components) | 16 |
| Sprache | TypeScript strict | 5 |
| Datenbank | PostgreSQL | 16 |
| ORM | Prisma | 5 |
| Authentifizierung | NextAuth.js (credentials + JWT) | 4 |
| UI | Tailwind CSS | 3 |
| PDF-Export | @react-pdf/renderer (serverseitig) | — |
| Excel-Export | ExcelJS | — |
| Tests | Vitest + Testing Library | — |
| Logs | Winston (strukturiertes JSON) | — |
| KI (optional) | Claude API (Anthropic) | — |
| Bereitstellung | Docker + Docker Compose | — |

---

## 🔒 Sicherheit

### Vorhandene Maßnahmen

- Passwörter mit **bcrypt** gehasht (Kosten 12)
- Signierte **JWT**-Sitzungen (`NEXTAUTH_SECRET`)
- Next.js-Authentifizierungs-Middleware auf allen geschützten Routen
- **HTTP-Sicherheitsheader**: X-Frame-Options, CSP, X-Content-Type-Options, Referrer-Policy, HSTS
- Serverseitige Eingabevalidierung mit **Zod** auf allen API-Routen
- Datenisolierung pro Benutzer + RBAC pro Analyse
- **Vollständiger Audit-Trail** (Tabelle `AuditLog`) für alle sensiblen Aktionen, als CSV exportierbar
- Rate Limiting auf den Authentifizierungsrouten
- Konfigurierbare **MFA** mit Sicherheitsfenster (Auto-Deaktivierung, falls nicht binnen 60 Min. bestätigt)
- Konfigurierbares **SSO** SAML 2.0 / OIDC

### Produktions-Checkliste

```bash
# 1. Alle Secrets erzeugen (NEXTAUTH_SECRET, PostgreSQL-Passwort,
#    SECRETS_ENCRYPTION_KEY) mit einem Befehl — idempotent:
./scripts/setup.sh --auto

# 2. Öffentliche HTTPS-URL in .env festlegen
#    NEXTAUTH_URL=https://acra.meinedomain.de   (HTTPS erforderlich)

# 3. Hinter einen HTTPS-Reverse-Proxy stellen (Nginx, Caddy, Traefik + TLS)

# 4. Den Demo-Seed NICHT in Produktion laden. Falls versehentlich geschehen:
#    unter /admin/users anmelden und admin@chu-metropole.fr löschen/zurücksetzen

# 5. Starten und den Health-Check prüfen
docker compose up -d
curl https://ihre-domain.de/api/health
# {"status":"ok","db":"connected",...}
```

> Das **erste Konto**, das unter `/auth/register` erstellt wird, wird **ADMINISTRATOR**.
> Erstellen Sie es unmittelbar nach der Bereitstellung, damit kein Dritter diese Rolle
> beansprucht (die Registrierung ist standardmäßig offen).

> Ein vollständiges OWASP/WSTG-Sicherheitsaudit wurde durchgeführt. Siehe den Bericht in [docs/](./docs/).

---

## 📖 Die 5 EBIOS-RM-Workshops

| # | Workshop | Beschreibung |
|---|----------|--------------|
| **W1** | Rahmen & Sicherheitsbasis | Umfang, Missionen, Geschäftswerte (DICT-Kriterien), unterstützende Güter, befürchtete Ereignisse, Sicherheits-Frameworks |
| **W2** | Risikoquellen | Angreifer identifizieren, anvisierte Ziele (RQ/AZ-Paare), Relevanzstufen P1/P2 |
| **W3** | Strategische Szenarien | Ökosystem, Stakeholder, Angriffspfade, Sicherheitsmaßnahmen des Ökosystems |
| **W4** | Operative Szenarien | Technische Aktionen der Angreifer, Wahrscheinlichkeit, MITRE-ATT&CK-Links |
| **W5** | Risikobehandlung | Behandlungsstrategien (reduzieren, übertragen, ablehnen, akzeptieren), Maßnahmen je Framework, Restrisiken, Aktionsplan |

> **🚀 Express-Modus**: ein schneller Durchlauf W1 → W2 → W5, vom Dashboard aus verfügbar, um in unter 30 Minuten eine Risikoliste und einen Aktionsplan zu erhalten. Ideal für dringende Kontexte oder erste Analysen.

---

## 🌐 Internationalisierung

Die Oberfläche ist in **5 Sprachen** verfügbar, jederzeit im Profil wählbar:

| Code | Sprache | Vollständigkeit |
|------|---------|----------------|
| `fr` | Français | ✅ 100 % (Referenz) |
| `en` | English | ✅ 100 % |
| `de` | Deutsch | ✅ 100 % |
| `es` | Español | ✅ 100 % |
| `it` | Italiano | ✅ 100 % |

Zum Hinzufügen einer Sprache `src/lib/i18n/fr.ts` kopieren, alle Schlüssel übersetzen und die Datei mit dem passenden ISO-639-1-Code speichern. TypeScript prüft automatisch, dass alle Schlüssel vorhanden sind.

---

## 👥 Benutzerrollen (RBAC)

| Rolle | Analyse erstellen | Bearbeiten | Freigeben | Admin |
|-------|:---:|:---:|:---:|:---:|
| `ADMIN` | ✅ | ✅ alle | ✅ | ✅ |
| `RSSI` (CISO) | ✅ | ✅ eigene + geteilte | ✅ | ❌ |
| `RISK_MANAGER` | ✅ | ✅ eigene + geteilte | ✅ | ❌ |
| `ANALYSTE` (Analyst) | ✅ | ✅ eigene + geteilte | ❌ | ❌ |
| `LECTEUR` (Leser) | ❌ | ❌ | ❌ | ❌ |

Zugriffe können auch **analyseweise** gewährt werden (punktuelles Teilen mit jedem Benutzer).

---

## 🛠️ Fehlerbehebung

### Die Anwendung startet nicht

```bash
# Container-Status prüfen
docker compose ps

# Detaillierte Logs ansehen
docker compose logs app
docker compose logs migrator

# Prüfen, ob die Ports frei sind
lsof -i :3000
lsof -i :5432
```

### Prisma-Migrationsfehler

```bash
# Migrationsauflösung erzwingen
docker compose exec app npx prisma migrate resolve --applied "migrations_name"
docker compose exec app npx prisma migrate deploy
```

### Problem mit der Datenbankverbindung

```bash
# Konnektivität prüfen
docker compose exec app npx prisma db execute --stdin <<< "SELECT 1;"

# Die Variable DATABASE_URL in .env prüfen
docker compose exec app env | grep DATABASE
```

### Anwendung vollständig zurücksetzen

```bash
# ⚠️ Löscht alle Daten
docker compose down -v
docker compose up -d
```

---

## 🤝 Mitwirken

Siehe [CONTRIBUTING.md](./CONTRIBUTING.md) für den vollständigen Leitfaden.

**TL;DR:**
1. Repo forken und einen Branch `feature/meine-funktion` erstellen
2. Zuerst die Tests schreiben (**TDD verpflichtend** — siehe CLAUDE.md)
3. Implementieren und sicherstellen, dass `npm test` grün ist
4. Übersetzungen in den **5 i18n-Dateien** ergänzen, falls UI-Strings hinzukommen
5. `npx tsc --noEmit` ausführen — null TypeScript-Fehler
6. Eine Pull Request mit klarer Beschreibung öffnen

---

## 📄 Lizenz

MIT — siehe [LICENSE](./LICENSE)

Die EBIOS-RM-Methode wird von der [ANSSI](https://cyber.gouv.fr/la-methode-ebios-risk-manager) entwickelt und gepflegt. Diese Anwendung ist nicht mit der ANSSI affiliiert.
