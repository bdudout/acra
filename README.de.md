<div align="center">

<img src="public/logo-mark.png" alt="ACRA Logo" width="120" />

# ACRA — Augmented Cyber (& Business) Risk Analysis

**Die Open-Source-Plattform für Cyber- und Geschäftsrisikomanagement und GRC — EBIOS RM, ISO/IEC 27005, ISO 31000, NIST SP 800-30, 360-Projekte**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Methoden](https://img.shields.io/badge/Methoden-EBIOS%20RM%20·%20ISO%2027005%20·%20ISO%2031000%20·%20NIST%20800--30-red)](#-konfigurierbare-analysemethoden)
[![GRC](https://img.shields.io/badge/GRC-3%20Verteidigungslinien-green)](#️-grc-modul--governance-risk--compliance)
[![ANSSI](https://img.shields.io/badge/Kompatibel-ISO%2027005-green)](https://www.iso.org/standard/75281.html)

**🌐 Langue / Language:** [🇫🇷 Français](README.md) · [🇬🇧 English](README.en.md) · 🇩🇪 Deutsch · [🇪🇸 Español](README.es.md) · [🇮🇹 Italiano](README.it.md)

</div>

---

## 🎯 Überblick

**ACRA — Augmented Cyber (& Business) Risk Analysis —** ist eine selbst gehostete Webplattform für **Cyber- und Geschäftsrisikomanagement (operationelles Risiko, Projekte, Betrug, Auslagerung) und GRC** — die EBIOS-RM-Analyse ist nur eine ihrer Methoden. Ein Sicherheitsteam — auch ohne tiefes Fachwissen — führt damit Risikoanalysen nach der Methode seiner Wahl durch und steuert anschließend Compliance, Kontrollen, Vorfälle und Maßnahmenpläne in einem einzigen Werkzeug:

- **Risikoanalyse mit mehreren Methoden**: **EBIOS Risk Manager** (ANSSI, Standard), **ISO/IEC 27005:2022**, **ISO 31000:2018** und **NIST SP 800-30 Rev. 1**;
- **Vollständiges GRC entlang der drei Verteidigungslinien**: Risikoregister, Compliance über mehrere Rahmenwerke, **Reifegrad** (CMMI-Zielprofile), Ausnahmegenehmigungen, permanente Kontrolle, interne Revision, Vorfälle (DORA), KRI, DSGVO-Verzeichnis, einheitlicher Maßnahmenplan, Steuerung und Gremienunterlagen.

Jedes Modul ist je Organisation aktivierbar: Eine Beratung bleibt bei der Risikoanalyse, eine Bank aktiviert die gesamte Governance-Kette.

### Das Problem, das ACRA löst

Eine sorgfältige Risikoanalyse ist anspruchsvoll (EBIOS RM umfasst 5 verknüpfte Workshops; ISO/IEC 27005 und NIST SP 800-30 geben jeweils einen eigenen Prozess vor) und zählt nur, wenn ihre Ergebnisse weiterverfolgt werden: Compliance, Kontrollen, Ausnahmen, Maßnahmen. In der Praxis liegen diese Informationen in getrennten, manuell gepflegten Tabellen.

ACRA verbindet diese Glieder: ein **methodischer Assistent**, der Schritt für Schritt mit anklickbaren Beispielen führt und die Analyse konsistent hält, verknüpft mit den **Rahmenwerken, Kontrollen und Maßnahmenplänen** der Organisation, mit Exporten (PDF, Word, PowerPoint, Excel) für Gremium oder Prüfer.

### Für wen?

| Profil | Nutzung |
|--------|---------|
| 🔒 CISOs & Risk Manager | Analysen steuern, freigeben, das Risikoportfolio überwachen |
| 🔍 Sicherheitsanalysten | Workshops durchführen, Szenarien dokumentieren, Maßnahmen planen |
| 🏢 IT & Leitung | Zusammenfassungen lesen, Behandlung verfolgen, Maßnahmenbudgets freigeben |
| ✅ Compliance, permanente Kontrolle, Revision | Rahmenwerke bewerten, Reifegrad steuern, Kontrollen testen, Feststellungen verfolgen |
| 🗄️ DSB | Das Verzeichnis von Verarbeitungstätigkeiten führen (DSGVO Art. 30), DSFA erkennen |
| 🎓 Studierende & Lehrende | EBIOS RM, ISO/IEC 27005 oder NIST SP 800-30 an einem konkreten Werkzeug lernen |

### Was ACRA auszeichnet

- **Integrierte methodische Anleitung**: Jedes Feld hat einen Tooltip, einen Link zum ANSSI-Leitfaden und kontextbezogene Beispiele
- **Automatische Konsistenz**: Elemente eines Workshops fließen automatisch in die folgenden ein
- **Mehrere Methoden, ein Werkzeug**: EBIOS RM, ISO/IEC 27005, ISO 31000 und NIST SP 800-30, je Instanz oder je Analyse gewählt
- **Vollständiges GRC**: von der Risikoanalyse bis zum Maßnahmenplan, über Compliance, Reifegrad, Ausnahmen, Kontrollen, Revision und Vorfälle — Module je Organisation aktivierbar
- **15 Maßnahmen-Frameworks**: ISO 27001:2022, NIST CSF 2.0, NIST 800-53, CIS Controls v8, ANSSI-Hygiene, HDS, PCI-DSS, DORA, IEC 62443, SOC 2, NIST SSDF, RGS, ReCyF, TISAX/VDA-ISA, NCSC CAF v4.0 — aus einer einzigen Oberfläche
- **Branchenspezifische Anleitung & Konformität**: an Branche und Teilbranche angepasste Fachbeispiele, Framework-Empfehlungen, Erkennung des regulatorischen Status (NIS2, OIV…) — [Details](#-branchenspezifische-anleitung--konformität)
- **Flash-Methode (Club EBIOS)**: ein geführter Durchlauf der 5 Workshops in einem Zug, gestützt auf die Kapitalisierung (Beispiele, Sicherheitssockel) — ideal für eine erste Analyse oder einen eingeschränkten Kontext
- **Club-EBIOS-Leitfäden integriert**: die Flash-Methode und das Methodenblatt 5 (Gefährlichkeit der Stakeholder) sind direkt im Ablauf umgesetzt
- **Reifegrad (CMMI-Zielprofile)**: aktuelles und angestrebtes Niveau für jedes Compliance-Rahmenwerk (darunter NIST CSF 2.0 und NCSC CAF v4.0), Lücken je Bereich, Maßnahmen — [Details](#-reifegrad--cmmi-zielprofile)
- **In die Anwendung integrierte Aktualisierung**: installierte und verfügbare Version unter Administration → Version, Schaltfläche „Aktualisieren“ (Kanäle stable / beta, automatische Sicherung und Gesundheitsprüfung) oder `scripts/update.sh` auf der Kommandozeile — [Details](#aktualisierung)
- **100 % selbst gehostet**: Ihre Daten verlassen niemals Ihre Infrastruktur

---

## ✨ Funktionen

### 🧭 Konfigurierbare Analysemethoden

Die **Analysemethode** ist auf **Instanzebene** (SUPER_ADMIN) und **je Analyse** konfigurierbar — **EBIOS RM bleibt der Standard**.

- **5 Methoden**: **EBIOS RM** (ANSSI, 5 Workshops) · **ISO/IEC 27005:2022** (phasenbasierter Prozess) · **NIST SP 800-30 Rev. 1** (Prepare / Conduct / Communicate / Maintain) · **ISO 31000:2018** (einfache Beurteilung) · **Projektanalyse 360** (ISO 31000:2018: gesamtes operationelles Risiko eines Projekts).
- **Direkte Erfassung** (ISO 31000 / 27005 / NIST): Risiken werden direkt erfasst (Auswirkung × Wahrscheinlichkeit) auf der Skala der Organisation, ohne EBIOS-Szenarien; bearbeitbarer Kontext, Phasenhinweise, branchenspezifische und übergreifende Risikovorschläge.
- **Drei Risikoniveaus**: **brutto** (inhärent) → **aktuell** (mit bestehenden Maßnahmen) → **Restrisiko** (nach dem Maßnahmenplan); Risikoeigentümer, Maßnahmen und Aktionen je Risiko, Bewertung gegen den Risikoappetit.
- **Bericht je Methode** als PDF und Excel.

### 📋 Vollständige EBIOS-RM-Methode

- **5 geführte Workshops** mit einer Bibliothek anklickbarer Beispiele (Geschäftswerte, Risikoquellen, Szenarien, Maßnahmen…)
- **Flash-Methode (Club EBIOS)**: ein schneller Durchlauf W1 → W2 → W3 → W4 → W5 in einem Zug, gestützt auf Beispiele und den Sicherheitssockel, um schnell eine Risikoliste und einen Aktionsplan zu erstellen
- **Interaktiver EBIOS-RM-Leitfaden** mit Direktlinks zu den Seiten des offiziellen ANSSI-Leitfadens
- Visuelle **Risikomatrix** (Schweregrad × Wahrscheinlichkeit) mit Restrisikoniveaus und Vorher/Nachher-Vergleich
- **DICT**-Kriterien (Verfügbarkeit, Integrität, Vertraulichkeit, Nachvollziehbarkeit) für Geschäftswerte und unterstützende Güter
- MITRE-ATT&CK-Links bei operativen Szenarien
- **Radar-Kartografie der Paare Risikoquelle / angestrebtes Ziel** (Workshop 2)
- **Logische UND/ODER-Operatoren** in den Vorgehensweisen (Workshop 4)
- **Drei Methoden zur Wahrscheinlichkeitsbewertung**: express, standard, erweitert (Bewertung je Elementaraktion und Berechnung der Gesamtwahrscheinlichkeit)
- **EBIOS-Kategorisierung der Maßnahmen**: Governance, Schutz, Abwehr, Resilienz
- **Schutzkennzeichnung** des Analysedokuments (nicht geschützt → vertraulich), auf dem Deckblatt und in Exporten
- **x.y-Versionierung** der Analysen und **Revisionsverlauf** (operativer/strategischer Zyklus)
- **Bedrohungskartierung des Ökosystems** (Workshop 3, ANSSI-Methodenblatt 5): Gefährdung der Beteiligten anhand von 4 Teilkriterien, polares Radar mit 3 Zonen, konfigurierbare Skalen, Markierung kritischer Dritter — [Details](#️-bedrohungskartierung-des-ökosystems-workshop-3)
- Übergreifende **Dritte**-Ansicht: organisationsweites *Third-Party-Management*, über alle Analysen aggregiert, nach Zone und Kritikalität filterbar

### 🔐 Sicherheit & Frameworks

- Sicherheitsmaßnahmen aus **15 Frameworks**: ISO 27001:2022 · NIST CSF 2.0 · NIST 800-53 · CIS Controls v8 · ANSSI-Hygiene · HDS · PCI-DSS · DORA · IEC 62443 · SOC 2 · NIST SSDF · RGS · ReCyF · TISAX/VDA-ISA · NCSC CAF v4.0 + benutzerdefinierte Kontrollen — Kontrollen **in 5 Sprachen lokalisiert**
- Konfigurierbare Passwortrichtlinie (Länge, Komplexität, Ablauf, Verlauf, Sperrung)
- Konfigurierbare **MFA** (Einmalcode per **E-Mail** oder **SMS**) mit 60-Minuten-Bestätigungsfenster zur Vermeidung versehentlicher Sperrung
- **Unternehmens-SSO OIDC** (Azure AD, Okta, Google Workspace…) in NextAuth integriert — automatische (JIT) Kontobereitstellung und **IdP-gesteuertes RBAC**: Zuordnung von IdP-**Gruppen** (AD / SailPoint) zu ACRA-Rollen, bei jeder Anmeldung synchronisiert. **SAML 2.0** im Wartungsmodus. **SCIM 2.0** (Bereitstellung/Deprovisionierung durch den IdP)
- Vollständiger, exportierbarer Audit-Trail (CSV)

### 👥 Zusammenarbeit & Governance

- **RBAC mit 12 Rollen** über die **3 Verteidigungslinien**: SUPER_ADMIN · ADMIN · CISO · RISK_MANAGER · FACHBEREICHSLEITUNG · ANALYST · LESER · **CONTROLLER** (permanente Kontrolle) · **COMPLIANCE** · **DSB** (Datenschutz) · **AUDITOR** (3. Linie) · **OPERATIV** (1. Linie)
- **Multi-Organisation**: Organisationsbaum mit hierarchischen Bereichen (Knoten / Teilbaum); ein ADMIN verwaltet **nur die Konten seiner Organisation**, ein SUPER_ADMIN die Instanz
- Freigabe-Workflow: Einreichung → Prüfung → Freigabe (CISO oder Risk Manager), mit **Funktionstrennung** — ein Genehmiger kann **seine eigene** Analyse nicht freigeben (Vier-Augen-Prinzip) — und **Selbstfreigabe** für Ein-Personen-Organisationen (wo Vier-Augen unmöglich ist)
- **Restrisiko-Akzeptanz** durch die **Fachbereichsleitung** (dedizierte Nur-Lese-Rolle), getrennt von der Validierung der Analyse
- **Ausnahmegenehmigungen** — *vorübergehende* Akzeptanz einer Nichtkonformität der Sicherheitsbasis: an eine Kontrolle eines Rahmenwerks oder ein Risiko gebunden, **begründet, kompensiert, befristet und überwacht**. Pro Organisation konfigurierbarer Workflow (**eigenständig** / **CISO**-Freigabe / CISO + **Fachbereich**, optionale Zweitprüfung durch Gruppen-CISO), **Ablaufwarnungen**, Abschluss mit **Nachweisen** und ein analysenübergreifendes **Ausnahmenregister** — ein Compliance-Liefergegenstand (ISO 27001, DORA-Ausnahmenregister)
  - RSSI-Stellungnahme **positiv, positiv mit Vorbehalten** oder negativ; der Antragsteller kann den Antrag vor jeder Stellungnahme **bearbeiten** und während der Prüfung **zurückziehen** (für die Revision dokumentiert)
- Zugriffsfreigabe pro Analyse mit individuellen Berechtigungen
- Admin-Dashboard: Benutzerverwaltung (Organisationsbereich), Kontoerstellung, Sperrung, Audit-Logs
- **Wiederherstellung (Papierkorb)**: eine vom Benutzer gelöschte Analyse bleibt **30 Tage** lang durch einen Administrator wiederherstellbar, bevor sie endgültig gelöscht wird

### 📈 Reifegrad — CMMI-Zielprofile

Je Organisation aktivierbares Modul (standardmäßig deaktiviert). Der Reifegrad ist eine **Schicht der Compliance**: dasselbe Rahmenwerk, dieselben Kontrollpunkte, dieselben Maßnahmen — die Compliance sagt, ob eine Kontrolle erfüllt ist, der Reifegrad, auf welchem Niveau die Organisation steht und welches sie anstrebt.

- **CMMI-Skala 0 bis 5** (Unvollständig → Optimierend), Bezeichnungen und Definitionen **durch den ADMIN änderbar** in der Konfiguration
- **Globales Zielniveau** (die „Risikoappetit-Erklärung“, RAS) und bei Bedarf ein eigenes Ziel je Punkt
- **Dashboard** (Lesart RAD): durchschnittlicher aktueller und angestrebter Reifegrad, Lücken je Bereich, größte Lücken, offene und überfällige Maßnahmen, letzte Überprüfung
- Jedes aktive Rahmenwerk kann ein Profil tragen: **NIST CSF 2.0**, **NCSC CAF v4.0**, ISO 27001, DORA, eigene Rahmenwerke…
- Eine Lücke wird zu einer **Maßnahme des einheitlichen Maßnahmenplans**, gemeinsam mit der Compliance (keine Dubletten); Verlauf je Punkt, CSV-Export

### 🧩 Projektanalyse 360

Gesamtes operationelles Risiko eines Projekts, Vorgehen nach **ISO 31000:2018**: Qualifizierungsfragebogen über **sechs Bereiche** (Cyber, IT — Architektur und Wartung —, Projekt, Fachbereich, Betrug, Auslagerung), der die zu untersuchenden Risiken vorschlägt; Risiken nach Bereich klassifiziert; **Import der Risiken aus einer bestehenden Cyber-Analyse** (EBIOS RM, ISO/IEC 27005, NIST SP 800-30); **Dashboard je Bereich**; Freigabe durch **RSSI und Risk Manager** (zwei getrennte Stellungnahmen). Projekte werden über die Registerkarte **Projekte** gestartet (Modul „Projekte 360“, standardmäßig aktiv, einstellbar unter Konfiguration → Funktionen); der Fragebogen wird **aus vorhandenen Daten vorausgefüllt** (Cyber-Analysen, IKT-Register, Prozesse, DSGVO-Verzeichnis, DORA) und Registerrisiken werden vorgeschlagen, ohne Dubletten anzulegen. Ein Projekt kann außerdem **Ausgangspunkt einer Cyber-Analyse** sein (Schaltfläche im Register Projekte oder Auswahl bei der Erstellung), und das **GRC-Cockpit** verfolgt Fortschritt, Fristen, Freigabe durch CISO + Risikomanager und hohe Risiken aller Projekte.

- **Strukturierte Anlage**: Name, Ziele, Inbetriebnahmedatum, Branche, **Teilbranchen** und **IS-Architekturmuster**; Risiken und Aktionspläne in jedem Projekt standardmäßig vorhanden (von der Organisation konfigurierbar).
- **Typische Risiken zum Import** in der Identifikationsphase: vollständiger Katalog nach Herkunft gruppiert (Register der Organisation, Teilbranchen, Architektur, Branche, allen gemeinsame Risiken), Kontext direkt änderbar, Kontrollkästchen und Sammelimport.
- **Projektseite**: vom Projektleiter gesetztes Projektwetter, Kennzahlen, Matrix **brutto / aktuell / residual** nach Kategorie filterbar, Risiken stabil nummeriert **R1, R2…** (Matrix, Aktionspläne, Export), bearbeitbare Aktionspläne nach Priorität (Verantwortlicher, Frist, Status, farbige Priorität), Kurve der offenen Pläne bis zur Inbetriebnahme, Freigabe und Akzeptanz der Restrisiken auf der Seite.
- **PowerPoint-Export** der Projektprüfung: Deckblatt, Management-Zusammenfassung, aktuelle und residuale Risikokarten, Fortschritt der Pläne.
- **Projekte und Cyberanalysen** in beide Richtungen verknüpft („Cyberanalyse zuordnen“, „Projekt zuordnen“), mit Ansichtswechsel; Listen der Analysen und Projekte in **Detail- oder Listenansicht**.

### 🤝 Dritte: Dienste, Entitäten und Verträge

- **Drittdienste und Drittakteure**: jeder in einer Analyse untersuchte Stakeholder (erbrachter Dienst, Abhängigkeit, Akteur des Ökosystems), über alle Analysen konsolidiert, mit Bedrohung und Zone.
- **Drittpartei-Entitäten**: die juristische Person (LEI, Land, Aliasse), die diese Dienste erbringt; sie verbindet die Drittdienste der Analysen mit den **Verträgen des IKT-Registers** sowie mit ihren Angeboten und Nutzungen. Anlage ohne Dubletten, Zusammenführung mit Vorschau, Zuordnungen vorgeschlagen (LEI, Name, Alias), aber nie ohne Klick angewendet.
- **Import der Entitäten aus den Drittdiensten**, **Verknüpfungsgraph** einer Entität (Drittdienste ↔ Entität ↔ Verträge), Zuordnen und Lösen von Drittdiensten und Verträgen.
- **Informationsregister zu IKT** (DORA, Art. 28 Abs. 3): geführter Vertragsimport (CSV / Excel), Gruppenverträge, die Tochtergesellschaften vorgeschlagen und von ihnen bestätigt werden, Abdeckung der Angebote je Vertrag.

### 🧭 Risiko-Governance

- **Risikoappetit (RAS / RAD)**: Risikoappetit-Erklärung (Schwellen je Kategorie, angestrebter Reifegrad) und Dashboard (Risiken über dem Appetit, Reifegradlücken, KRI in Warnung) mit Ampeln
- **Tests der digitalen operationalen Resilienz (DORA, Artikel 24 bis 26)**: Jahresprogramm, offizielle Testarten, Feststellungen, kritische oder wichtige Funktionen, TLPT-Fälligkeit und **Bericht über die Überprüfung des IKT-Risikomanagementrahmens** (Artikel 6 Absatz 5) in Word
- **Prozess der Risikolandkarte**: das Vorgehen Schritt für Schritt erklärt, durch die Governance bearbeitbar, mit Überprüfungsstatus der Landkarte

### 📊 Export & Reporting

- Strukturierter mehrseitiger **PDF**-Export (Executive Summary, KPIs, Workshops, Maßnahmen, methodische Anhänge)
- **Excel (.xlsx)**-Export mit allen tabellarischen Daten pro Blatt
- **JSON**-Export (vollständiges, re-importierbares Backup) und **CSV** (tabellarische Daten)
- Analyse-Import aus JSON oder CSV
- **Gremien-Pakete** (PDF) mit einem **Banner „Gesamtrisikoniveau"** (Ampel HOCH / MITTEL / BEHERRSCHT) sowie einer **Risiko-Heatmap** (Schwere × Eintrittswahrscheinlichkeit) — die Kernaussage einer Vorstandsvorlage auf einen Blick

### 🗄️ Datenschutz (DSB / DSGVO)

- **Verzeichnis von Verarbeitungstätigkeiten (VVT — DSGVO Art. 30)**: organisationsbezogenes, dem **DSB** vorbehaltenes Register mit **Vollständigkeitsprüfung** (Zweck, Kategorien betroffener Personen/Daten, Empfänger, Speicherdauer, Sicherheitsmaßnahmen, Garantien bei Drittlandtransfer)
- **DSFA-Entscheidungshilfe (Art. 35)**: automatische Erkennung von Verarbeitungen, die eine Folgenabschätzung erfordern (besondere Datenkategorien Art. 9, systematische Überwachung in großem Umfang)
- **Typische Verarbeitungstätigkeiten zum Import** Zeile für Zeile (vereinfachtes Musterverzeichnis, 5 Sprachen)

### 🤖 KI-Register — Algorithmen und Systeme künstlicher Intelligenz

Modul pro Organisation aktivierbar (standardmäßig aus), der Governance vorbehalten (ADMIN, CISO, Risk Manager, Compliance, DSB).

- Ein Datensatz pro System: Zweck, Anbieter, verwendete Daten (einschließlich besonderer Kategorien), Entscheidungsunterstützung oder automatisierte Entscheidung, menschliche Aufsicht, Kontrollen von Verzerrungen und Drift, **jährliche Überprüfung** (Verzug gekennzeichnet), Verknüpfung mit der Risikoanalyse und der DSFA.
- **Indikative Einstufung** nach der **Verordnung (EU) 2024/1689** (Verordnung über künstliche Intelligenz) — wahrscheinlich Hochrisiko (Anhang III), Transparenzpflichten (Art. 50) oder einzustufen — stets als **von der Rechtsabteilung oder dem DSB zu prüfen** dargestellt.
- **Typische Systeme zum Import** (generativer KI-Assistent, Chatbot, Vorauswahl von Bewerbungen, Betrugserkennung, Bonitätsbewertung…), 5 Sprachen.

### 🔌 Interoperabilität & API

- **Öffentliche v1-API** (REST, schlüsselbasierte Bearer-Authentifizierung): Lesen von **Risikoregister**, **Kontrollen** und **Vorfällen**; integrierte **OpenAPI**-Spezifikation
- **Massenimport** per API (Risikoregister, Kontrollen), mit zeilenweiser Fehlermeldung
- **Signierte ausgehende Webhooks** (HMAC): Benachrichtigung eines Drittsystems (SOAR/SIEM/ITSM) bei Ereignissen (Risiko erstellt, Vorfall gemeldet…), mit Wiederholungen und Anti-SSRF-Schutz
- **OIDC-SSO + SCIM** (siehe *Sicherheit*) zur Anbindung von Authentifizierung und Bereitstellung an das Unternehmensverzeichnis

### 🤖 KI-Assistenten (MCP-Server)

Ein KI-Assistent (Claude, Codex, Mistral Vibe…) verbindet sich über das **Model Context Protocol** mit einem
Organisationsschlüssel mit ACRA. Er **liest** den Kontext, ruft die **von ACRA berechneten Empfehlungen** ab (ohne
externe KI) und **schlägt vor**; **nichts wird ohne menschliche Freigabe geschrieben** (Menü *MCP-Vorschläge*, mit
den üblichen Rechten jeder Rolle). Standardmäßig deaktiviert: Schalter für die Instanz (Super-Administrator) und die
Organisation (Administrator).

- **Lesen**: Referenzrahmen und Anforderungen, Risikotaxonomie, Beispiele nach Sektor, Teilsektoren und
  IS-Architekturmustern, Sektorkatalog, Risikolage, Analysen und 360-Projekte, Meldeverfahren für Vorfälle,
  DORA-Felder, Resilienztests
- **Empfehlen**: Risiken und Szenarien, Kontrollplan
- **Vorschlagen**: 360-Projekt; **neue Analyse** auf Grundlage einer Bedarfsbeschreibung oder **Übernahme einer
  bestehenden Analyse** (EBIOS RM, ISO/IEC 27005, ISO 31000, NIST SP 800-30); **IS-Leitlinie (PSSI)** als
  Maßnahmen-Referenzrahmen, Bibliotheksdokument und Konformitätsverfolgung; Risiken (Brutto- / aktuelle /
  Restbewertung, Maßnahmen und Pläne), Maßnahmen, Aktionspläne, Konformitätsbewertungen, Import in eine bestehende Analyse
- **MCP-Aktivität** (Administrator): MCP-Schlüssel und ihr Status, Aufrufe und Fehler über 30 Tage, meistgenutzte
  Werkzeuge, Vorschläge je Schlüssel, Erstellung eines Schlüssels nur mit `mcp`-Recht samt Verbindungsbefehl,
  **sofortiger Widerruf**
- Strikte Trennung nach Organisation, Protokollierung jedes Aufrufs (`MCP_TOOL_INVOKED`) und jeder Entscheidung,
  120 Aufrufe pro Minute und Schlüssel

```bash
claude mcp add --transport http acra https://<instance>/api/mcp --header "Authorization: Bearer $ACRA_MCP_KEY"
```

Verbindungsleitfaden für einen Assistenten (Schlüssel, Transport, Werkzeuge, Fehler, auf Französisch):
[`docs/mcp-clients.md`](docs/mcp-clients.md).

### 🌐 UX & Barrierefreiheit

- Oberfläche in **5 Sprachen**: Français · English · Deutsch · Español · Italiano
- **Auto-Speichern** bei jeder Änderung (kein Datenverlust)
- **Autovervollständigung** wiederkehrender Felder (Organisation, Risikoquellen, Stakeholder, Maßnahmen, Geschäftswerte, unterstützende Werte, Einheit) aus bereits erfassten Werten im Bereich — vereinheitlicht Bezeichnungen und spart Tipparbeit
- **Intelligente Standardwerte**: Organisation bei einer neuen Analyse vorausgefüllt; **Maßnahmenfristen nach Priorität berechnet** (Kritisch / Hoch / Mittel), pro Organisation konfigurierbare Fristen; Basis-Frameworks **nach Branche vorausgewählt**
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
| **Workshop 3 — Ökosystem-Kartierung** | ![](docs/screenshots/ecosystem-radar-light.png) | ![](docs/screenshots/ecosystem-radar-dark.png) |
| **Konfiguration (Skalen & Matrix)** | ![](docs/screenshots/configuration-light.png) | ![](docs/screenshots/configuration-dark.png) |
| **Administration** | ![](docs/screenshots/admin-light.png) | ![](docs/screenshots/admin-dark.png) |
| **Audit-Protokoll** | ![](docs/screenshots/admin-audit-light.png) | ![](docs/screenshots/admin-audit-dark.png) |

---

## 🏛️ GRC-Modul — Governance, Risk & Compliance

Über die Risikoanalyse (EBIOS RM, ISO/IEC 27005, ISO 31000, NIST SP 800-30) hinaus bringt ACRA eine **vollständige GRC-Basis** mit, die nach dem Modell der **drei Verteidigungslinien** strukturiert ist, für regulierte Einheiten (Banken, Versicherungen, Gesundheitswesen) konzipiert und an **DORA**, **NIS2** und **ISO/IEC 27001/27002** ausgerichtet. Jedes Modul ist pro Organisation aktivierbar; die Navigation wechselt automatisch in den „GRC-Modus", sobald ein Modul der 2./3. Linie aktiv ist.

Sechs Menüs: **Steuerung**, **Risikomanagement**, **Register** (Risiken, Kampagnen, Prozesse, Vorfälle, IKT, DSGVO, KI),
**Kontrolle & Revision**, **Konformität** und **Regulatorisch** (DORA, Aufsichtsverfolgung, Resilienztests, Berichte).

**Branchenspezifische Inhalte**: Kataloge von Prozessen, Risiken, Musterkontrollen, KRI und Prüfungsaufträgen je Branche
(Bank, Versicherung, Versicherungsvereine, Gesundheit, Sozialschutz, öffentlicher Sektor, Industrie, Verteidigung, Bildung,
Landwirtschaft, Immobilien, Medien, Tourismus, Vereine…) und je **IS-Architekturmuster** (24 Muster: Exposition, Zonen,
Verbindungen, Administration, Arbeitsplätze), Zeile für Zeile mit Herkunft importierbar. Administratoren können **die
Liste der angebotenen Branchen** für ihre Organisation **einschränken**.

> Die folgenden Screenshots stammen aus dem **realistischen Demo-Datensatz** (Bankensektor), verankert an öffentlichen Bedrohungen (ENISA Threat Landscape). Ladbar und wieder löschbar: `npm run db:seed:demo` / `npm run db:seed:demo:purge`.

### 📊 GRC-Steuerung — konsolidiertes Cockpit

Führungssicht, die je Organisations-Teilbaum die **Risikolage** und den Fortschritt der Maßnahmenpläne aggregiert: Register (hoch/mittel/niedrig), Nettoverluste (LDC), offene Vorfälle, Konformitätsgrad, Kontrollanomalien, kritische Feststellungen, Risikoappetit, KRIs und **schwere DORA-IKT-Vorfälle**. Ein-Klick-Erzeugung von **Gremien-Paketen** und des **internen Kontrollberichts** (PDF/PPTX).

<img src="docs/screenshots/grc-pilotage-light.png" width="49%"> <img src="docs/screenshots/grc-pilotage-dark.png" width="49%">

### 📚 Frameworks & Anforderungen — *nachgewiesene* Konformität

Die **mitgelieferten Frameworks** (ISO 27001, NIST CSF/800-53, CIS, ANSSI, HDS, PCI-DSS, DORA, IEC 62443, SOC 2, RGS, ReCyF…) und Ihre **eigenen Frameworks** (ISMS-Richtlinie, interne Richtlinien), heruntergebrochen auf **kontrollierbare und prüfbare Kontrollpunkte**. Eine **Standard-Sicherheitsrichtlinie** (DORA- + ISO-27001/27002-Basis, mit ihren Aufgaben) wird per Klick initialisiert. Die **Abdeckung** jeder Anforderung wird **aus den realen Kontrollen** und Prüffeststellungen **abgeleitet** — Konformität wird *nachgewiesen*, nicht nur behauptet.

<img src="docs/screenshots/grc-referentiels-light.png" width="49%"> <img src="docs/screenshots/grc-referentiels-dark.png" width="49%">

Die **abgeleitete Abdeckung** eines Frameworks: der Status jeder Anforderung (konform / teilweise / Anomalie / nicht abgedeckt) wird aus den **realen Kontrollen**, die sie abdecken, und aus Prüffeststellungen berechnet — hier die StarBank-ISMS-Richtlinie, abgedeckt durch permanente Kontrollen.

<img src="docs/screenshots/grc-couverture-light.png" width="49%"> <img src="docs/screenshots/grc-couverture-dark.png" width="49%">

### 🚨 Vorfälle & Verluste — DORA-Meldung (Art. 19)

Meldung in der 1. Linie, Qualifizierung in der 2. Linie, Verluste in **LDC**-Logik (brutto, Rückflüsse, netto). Jeder Vorfall wird **automatisch nach DORA klassifiziert** (gering / erheblich / schwer); für schwere Vorfälle werden die **Meldefristen nach Art. 19** (erste / Zwischen- / Abschlussmeldung) berechnet und verfolgt, und das **ITS-Register** ist exportierbar.

- **Meldungen**: ein einziger Bildschirm für DORA (Felder und Wertelisten des offiziellen Glossars, Ergänzungen aus Anhang I der Durchführungsverordnung (EU) 2025/302, Excel- und JSON-Export) und die anderen aktivierten Regime — NIS2, DSGVO Art. 33 (Rubriken, Export), CRA Art. 14, SEC 8-K, NYDFS 500.17, HIPAA, US-Bankaufsicht (36 Std.), FTC — mit Fristen in Tagen oder Arbeitstagen, Informationsblatt je Regime und Erinnerungen; das Werkzeug übermittelt nichts an die Behörde.
- **Typische Vorfälle** (Katalog von 28 Cyber- und Nicht-Cyber-Vorfällen, passend zu den Branchen der Organisation) zum Vorbefüllen einer Meldung; ein Vorfall kann **mehrere Registerrisiken** betreffen.
- **Wiederherstellbares Löschen**: ein gelöschter Vorfall kann 30 Tage lang von einem Administrator unverändert wiederhergestellt werden (Audit- und SIEM-Spuren).

<img src="docs/screenshots/grc-incidents-light.png" width="49%"> <img src="docs/screenshots/grc-incidents-dark.png" width="49%">

### ✅ Permanente Kontrolle (N1/N2) & 🔎 Interne Revision (3. Linie)

Bibliothek **permanenter Kontrollen**, an das Raster (Risiko / Prozess / Framework-Anforderung) gebunden, periodisch ausgeführt, mit **beobachteter Wirksamkeit** (RCSA-Schleife) und **N1-Kontrollkampagnen**. In der 3. Linie plant die **interne Revision** Prüfungen, formuliert **Feststellungen** (Kritikalität + Empfehlung) und verfolgt deren Behebung; die Empfehlungen der **Aufsichtsbehörde** (ACPR/EZB) werden im selben Ablauf verfolgt.

<img src="docs/screenshots/grc-controles-light.png" width="49%"> <img src="docs/screenshots/grc-audit-light.png" width="49%">

### 🛡️ Konformität & 🗂️ Dokumentenbibliothek

Verfolgung der **Konformität** je Framework (Multi-Organisations-Heatmap, **SoA**-Export CSV/PDF) und GRC-**Dokumentenbibliothek** (ISMS-Richtlinie, Strategien, Richtlinien): versionierter Upload, an ein Framework / Risiko / eine Organisation gebunden, authentifizierter Download.

<img src="docs/screenshots/grc-conformite-light.png" width="49%"> <img src="docs/screenshots/grc-documents-light.png" width="49%">

### 📄 Gebrauchsfertige regulatorische Ergebnisse

- **RAS** — Risk Appetite Statement (PDF)
- **SoA** — Statement of Applicability / Anwendbarkeitserklärung (PDF)
- **Gremien-Pakete** — Risiken / Konformität / Vorfälle (PDF)
- **Jährlicher interner Kontrollbericht** — 3 Verteidigungslinien + DORA-Resilienzteil (PDF **und PPTX**)
- **DORA-ITS-Register** schwerer Vorfälle (Art. 19) und **Informationsregister der IKT-Drittparteien** (Art. 28) — CSV
- **Risiko-Landkarte** (PDF)

Beispiel — **jährlicher interner Kontrollbericht** (aus den StarBank-Demodaten erzeugt): Gesamtbeurteilung, Aufmerksamkeitspunkte, dann Zusammenfassung je Verteidigungslinie (permanente Kontrolle, Risikomanagement & Konformität, Revision) und DORA-Resilienzteil.

<img src="docs/screenshots/grc-rapport-controle-interne.png" width="60%">

---

## 🚀 Schnellstart (Docker)

**Keine lokale Installation von Node, npm oder Prisma erforderlich**: Das Docker-Image
bündelt alle Abhängigkeiten und den Prisma-Client und wendet die Migrationen beim Start
automatisch an (Dienst `migrator`).

```bash
git clone https://github.com/bdudout/acra.git
cd acra
make setup        # erzeugt .env + zufällige Secrets (interaktiv)
docker compose up -d
```

> Kein `make`? Direkt verwenden: `./scripts/setup.sh` (oder `npm run setup`).
> Automatisierte / CI-Installation (ohne Rückfragen): `./scripts/setup.sh --auto`.
> **Windows (Docker Desktop + WSL)**: Klonen Sie das Repository *innerhalb von WSL* (oder führen Sie vor dem Klonen `git config --global core.autocrlf input` aus). Erscheint `$'\r': command not found`, wurde das Skript in Windows-Zeilenenden umgewandelt: `sed -i 's/\r$//' scripts/setup.sh` ausführen und erneut starten.

`setup.sh` erzeugt für Sie starke Secrets (`NEXTAUTH_SECRET`, PostgreSQL-Passwort,
`SECRETS_ENCRYPTION_KEY`) und **regeneriert bei erneutem Lauf nur fehlende Werte**
(Details im Abschnitt „Detaillierte Installation" unten).

**Die Anwendung ist unter http://localhost:3000 erreichbar.**
Erstellen Sie Ihr Konto unter `/auth/register` — **das erste erstellte Konto wird
automatisch INSTANZ-SUPER-ADMINISTRATOR**.

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
git clone https://github.com/bdudout/acra.git
cd acra
```

---

### Schritt 2 — Umgebung konfigurieren (automatisiert)

Das Setup-Skript erstellt die Datei `.env` und **erzeugt starke Secrets**. Es ist
**idempotent**: erneut ausgeführt, behält es bereits definierte Werte und ergänzt nur Fehlendes.

```bash
./scripts/setup.sh          # interaktiv (fragt nach öffentlicher URL)
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

Docker startet 4 Dienste:
- **`db`** — PostgreSQL 16 (Port 5432)
- **`migrator`** — führt `prisma migrate deploy` beim Start aus (beendet sich danach)
- **`app`** — Next.js-Anwendung (Port 3000)
- **`backup`** — automatische PostgreSQL-Backups (7-Tage-Rotation)

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

Zwei Kanäle:
- **stable** — letzte freigegebene Version (Branch `stable`, auf die zuletzt veröffentlichte Release ausgerichtet);
- **beta** — letzte freigegebene Version + spätere Änderungen (Branch `main`, Version `x.y.z-beta.n`).

```bash
scripts/update.sh stable   # oder: scripts/update.sh beta
```

Das Skript verweigert die Ausführung bei lokalen Änderungen, sichert die Datenbank
(`backups/`), aktualisiert den Code nur per Fast-Forward, baut neu, wendet Migrationen an
und prüft den Zustand; bei einem Fehler zeigt es den Befehl zum Zurücksetzen an.
Manuelles Äquivalent: `git checkout stable && git pull && docker compose up -d --build`.

**Schaltfläche „Aktualisieren“** (Administration → Version): ein einziger Befehl auf dem
Server, als der Benutzer, der Docker steuert:

```bash
scripts/update-agent.sh --install     # richtet den Cron-Job ein; in Produktion: --install -f docker-compose.yml -f docker-compose.production.yml
```

Die Anwendung führt selbst keinen Befehl aus: Sie hinterlegt eine Anfrage, die der Agent
ausführt (Sicherung, Aktualisierung, Neubau, Zustandsprüfung). Deinstallation:
`scripts/update-agent.sh --uninstall`.

**Instanz älter als v1.0.3** (ohne diese Skripte): einmalig manuell aktualisieren, danach
übernehmen die Schaltfläche und `scripts/update.sh`:

```bash
git fetch origin && git checkout stable && git pull   # oder auf main bleiben (Beta)
scripts/update-agent.sh --install                      # optional: aktiviert die Schaltfläche
docker compose up -d --build
```

**Wiederherstellungspunkt und automatisches Zurücksetzen.** Vor jeder Änderung hält das Update die Anwendung an und legt einen **geprüften Wiederherstellungspunkt** an (`scripts/acra-snapshot.sh`: Datenbank-Dump im Custom-Format, Dokumente, Prüfsummen, Datenbankklon für schnelle Wiederherstellung). Schlägt Migration, Start oder Gesundheitsprüfung fehl, erfolgt das **Zurücksetzen automatisch** (Code, Datenbank, Dokumente); das Ergebnis erscheint unter Administration → Version, wo auch die Punkte aufgelistet sind und **„Zu diesem Punkt zurückkehren“** angeboten wird (zur Bestätigung ist die Version einzugeben). Variablen: `ACRA_BACKUP_DIR`, `ACRA_SNAPSHOT_KEEP`, `ACRA_BACKUP_AGE_RECIPIENT` (`age`-Verschlüsselung), `ACRA_FAILED_DB_RETENTION_DAYS`. Benötigter Speicherplatz: etwa 2 × Datenbank + Dokumente. Manuelles Verfahren: `docs/runbook-exploitation.md` § 6.

---

### Sicherung und Wiederherstellung

PostgreSQL-Sicherungen sind in `docker-compose.yml` automatisiert (Anzahl aufbewahrter Kopien: `BACKUP_KEEP`, standardmäßig 7).
**Administration → Version** plant **tägliche, wöchentliche und monatliche Sicherungen** (standardmäßig 3 Kopien, Schätzung
des Speicherbedarfs), bietet „Jetzt sichern“ und überwacht die **externe Kopie** der Wiederherstellungspunkte (Verzeichnis,
Befehl oder S3-kompatibler Speicher); **Administration → Speicher** verfolgt die Belegung und gibt Cache gefahrlos frei.
Verfahren: `docs/runbook-exploitation.md`.

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
git clone https://github.com/bdudout/acra.git
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
| UI | Tailwind CSS | 4 |
| PDF-Export | @react-pdf/renderer (serverseitig) | — |
| Excel-Export | ExcelJS | — |
| Tests | Vitest + Testing Library | — |
| Logs | Winston (strukturiertes JSON) | — |
| Bereitstellung | Docker + Docker Compose | — |

---

## 🔒 Sicherheit

### Vorhandene Maßnahmen

- Passwörter mit **bcrypt** gehasht (Kosten 12)
- Signierte **JWT**-Sitzungen (`NEXTAUTH_SECRET`)
- Next.js-Authentifizierungs-Middleware auf allen geschützten Routen
- **HTTP-Sicherheitsheader**: X-Frame-Options, CSP, X-Content-Type-Options, Referrer-Policy, HSTS
- Serverseitige Eingabevalidierung: **Zod**-Schemata (Authentifizierung, Admin-Richtlinien) und **Allowlist-Sanitizer** für Workshops und Importe (Anti-Mass-Assignment, CWE-915)
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
| **W3** | Strategische Szenarien | Ökosystem, **Bedrohungskartierung der Stakeholder** (Gefährdungsradar), Angriffspfade, Sicherheitsmaßnahmen des Ökosystems |
| **W4** | Operative Szenarien | Technische Aktionen der Angreifer, Wahrscheinlichkeit, MITRE-ATT&CK-Links |
| **W5** | Risikobehandlung | Behandlungsstrategien (reduzieren, übertragen, ablehnen, akzeptieren), Maßnahmen je Framework, Restrisiken, Aktionsplan |

> **⚡ Flash-Methode (Club EBIOS)**: ein schneller Durchlauf W1 → W2 → W3 → W4 → W5, vom Dashboard aus verfügbar. Gemäß dem „Flash“-Ansatz des Club EBIOS werden alle Workshops in einem Durchgang absolviert, indem auf Beispiele und den Sicherheitssockel zurückgegriffen wird, mit Fokus auf die relevantesten Szenarien (≈ 5 max). Skala und Matrix bleiben die vom Administrator konfigurierten. Ideal für eine erste Analyse oder einen eingeschränkten Kontext.

---

## 🗺️ Bedrohungskartierung des Ökosystems (Workshop 3)

ACRA setzt **ANSSI / Club EBIOS Methodenblatt 5** um („Einschätzung der Gefährdung durch Beteiligte"), um Dritte im Ökosystem zu priorisieren: Lieferanten, Dienstleister, Kunden, Partner, Aufsichtsbehörden.

Das Bedrohungsniveau eines Dritten wird aus **4 Teilkriterien** berechnet, bewertet auf konfigurierbaren qualitativen Skalen:

```text
              Abhängigkeit × Durchdringung           (Exposition, ↑ Bedrohung)
Bedrohung =  ───────────────────────────────────
              Cyber-Reife × Vertrauen                 (Zuverlässigkeit, ↓ Bedrohung)
```

Die Dritten werden auf einem **Polarradar** platziert: je näher am Zentrum, desto höher die Bedrohung. Drei **gleich breite** Zonen — Gefahr / Kontrolle / Beobachtung — steuern die Priorisierung (Dritte in Gefahr oder Kontrolle sind *kritisch* und fließen in die strategischen Szenarien ein).

| Bedrohungsradar | Berechnungsschema (integrierte Hilfe) |
|---|---|
| ![Bedrohungsradar des Ökosystems](docs/screenshots/ecosystem-radar-light.png) | ![Berechnung des Bedrohungsniveaus](docs/screenshots/ecosystem-formula-light.png) |

**Radar lesen:**

- **Farbe** eines Punkts = Cyber-Zuverlässigkeit (rot niedrig → grün hoch)
- **Größe** eines Punkts = Exposition (größer = stärker exponiert)
- **Ringe** = Bedrohungszonen (Gefahr orange · Kontrolle gelb · Beobachtung grün)
- **★** = manuell als *kritisch* markierter Dritter
- **Beschriftung** = bearbeitbarer Kurzname (Punkt klicken oder **doppelklicken**) oder Ref. `T1, T2…`
- Beim Überfahren eines Punkts → Details der 4 Teilkriterien, Exposition/Zuverlässigkeit und Bedrohung

**Tiers von Rang 2 / 3 (Ökosystem-Tiefe)** — gemäß Methodenblatt 5 des Club EBIOS kann ein kritischer Tier in **verbundene Stakeholder** zerlegt werden (z. B. der Hoster eines Dienstleisters, der Subunternehmer eines Partners). ACRA verwaltet drei Tiefenränge: Von einem kritischen Tier aus fügt die Schaltfläche **„+ verbundener Stakeholder“** einen Stakeholder vom **Rang 2** hinzu, der selbst in **Rang 3** zerlegbar ist. Im Radar blendet ein Kontrollkästchen **„Ränge 2/3“** diese verbundenen Tiers ein (standardmäßig ausgeblendet), abgeschwächt und **durch eine gestrichelte Linie mit ihrem übergeordneten Tier verbunden**, mit automatischer Vermeidung von Punkt-/Beschriftungsüberlappungen. Die Management-Zusammenfassung (PDF) bleibt aus Gründen der Lesbarkeit auf Tiers vom Rang 1 fokussiert.

**Konfigurierbare Skalen** — jede Stufe der 4 Kriterien (standardmäßig 1→4) kann unter `Konfiguration → Ökosystem` umbenannt werden, mit Hinzufügen/Entfernen von Stufen (nur ADMIN). Das Radar passt sich automatisch an die Skala an.

![Konfigurierbare Gefährdungsskalen](docs/screenshots/ecosystem-scales-light.png)

**Übergreifende Dritte-Ansicht** — die Seite **Dritte** aggregiert die Beteiligten **aller** Analysen, filterbar nach Zone und Kritikalität (★), für ein organisationsweites *Third-Party-Management*. Ein und derselbe Dritte kann mehrfach erscheinen (seine Gefährdung hängt vom analysierten Umfang ab).

![Übergreifende Dritte-Ansicht](docs/screenshots/tiers-light.png)

Das Radar, die Kritikalitätssterne und die Stakeholder-Tabelle (4 Teilkriterien + Spalte *Kritisch*) sind auch im **PDF-Export** enthalten.

---

## 🏛️ Empfohlene sichere Architektur (ANSSI-Best-Practices)

ACRA verarbeitet sensible Daten (Risikoanalysen, Ökosystem-Kartierung). Das Deployment sollte den Prinzipien des **ANSSI-IT-Hygieneleitfadens** folgen: Segmentierung, Defence in Depth, geringste Rechte, starke Authentifizierung, Protokollierung.

### Überblick — vollständige Bereitstellungsarchitektur

Das folgende Schema vereint die Bausteine einer Produktivbereitstellung: Zugriff von Benutzern und **KI-Assistenten (MCP)**, föderierte Identität, **zentrale Protokollierung** an das SIEM und geprüfte **externe Sicherung**. Fall 1 und 2 beschreiben anschließend die Netzwerkexposition.

```mermaid
flowchart LR
  subgraph EXT["Benutzer und Werkzeuge"]
    U["Benutzer<br/>(Browser)"]
    IA["KI-Assistenten<br/>lokal oder souverän<br/>(Claude, Codex, Mistral…)"]
    IDP["Unternehmens-IdP<br/>OIDC-SSO + MFA"]
  end
  subgraph ZONE["Abgeschottete ACRA-Zone"]
    RP["TLS-Reverse-Proxy<br/>WAF, HSTS"]
    APP["ACRA (Next.js)<br/>RBAC 12 Rollen,<br/>Audit-Trail"]
    MCP["MCP-Server<br/>/api/mcp"]
    API["API v1 + Webhooks"]
    DB[("PostgreSQL<br/>privates Netz")]
    DOC[("Dokumente<br/>Datenträger oder S3")]
    AG["Host-Agent<br/>geplante Sicherungen,<br/>Updates"]
    BK[("Wiederherstellungspunkte<br/>verschlüsselt (age)")]
  end
  subgraph SOC["Betrieb und Sicherheit"]
    SIEM["SIEM<br/>Splunk HEC, Elastic,<br/>syslog-HTTP…"]
    OFF[("Externe Sicherung<br/>eingehängter Ordner, Befehl<br/>oder S3-Speicher")]
    SOAR["SOAR / ITSM"]
  end
  U -->|HTTPS| RP --> APP
  IA -->|"HTTPS + „mcp“-Schlüssel"| RP --> MCP
  IDP -.->|"OIDC · SCIM"| APP
  APP --- MCP
  APP --- API
  APP --> DB
  APP --> DOC
  APP -->|"JSON-Audit-Ereignisse<br/>nach Kategorie"| SIEM
  API -->|"HMAC-signierte Webhooks"| SOAR
  AG -->|"täglich / wöchentlich / monatlich"| BK
  BK -->|"geprüfte Kopie"| OFF
```

**KI-Assistenten (MCP)** — ACRA enthält keine KI. Ein Assistent verbindet sich mit `/api/mcp` über einen Organisationsschlüssel nur mit dem Recht `mcp`, der vom Administrator erstellt und **widerrufen** werden kann (Seite *MCP-Aktivität*). Er liest, stützt sich auf die von ACRA berechneten Empfehlungen und **schlägt vor**: Nichts wird ohne menschliche Freigabe geschrieben. Für sensible Daten ein **lokales oder souveränes** Modell bevorzugen: Die Antworten der Werkzeuge gehen an den Anbieter des Assistenten. Leitfaden (Französisch): [`docs/mcp-clients.md`](docs/mcp-clients.md).

**Zentrale Protokollierung** — jede sensible Aktion (Anmeldungen, Konten, Konfiguration, Exporte, MCP-Werkzeugaufrufe, Entscheidungen über Vorschläge) speist den **Audit-Trail** und kann als JSON an das **SIEM** weitergeleitet werden (Splunk HEC, Elastic, syslog-HTTP, Ingestion-Webhook), **Protokoll für Protokoll** (Authentifizierung, Konten, Konfiguration, Daten, Governance). Ziele per Positivliste begrenzt (`SIEM_ALLOWED_HOSTS`); strukturierte Anwendungsprotokolle auf der Standardausgabe für den Kollektor des Hosts.

**Externe Sicherung** — der Host-Agent erstellt **Wiederherstellungspunkte** (Datenbank + Dokumente), **verschlüsselt** (`ACRA_BACKUP_AGE_RECIPIENT`), täglich, wöchentlich und monatlich sowie vor jedem Update (automatisches Zurücksetzen bei Fehlschlag). Jeder Punkt wird **außerhalb des Servers** kopiert (`ACRA_OFFSITE_DRIVER`: `fs` eingehängter Ordner, `command` Unternehmens-Sicherungssoftware, `s3` S3-kompatibler Speicher über rclone), **zurückgelesen und geprüft**; ein unverschlüsselter Punkt verlässt den Server nie ohne ausdrückliche Zustimmung. Der Status (letzte Kopie, verspätet, fehlgeschlagen) erscheint unter *Administration › Version*. Wiederherstellung quartalsweise testen (`scripts/acra-offsite.sh fetch`).

### Fall 1 — Internes *On-Premises*-Hosting (empfohlen)

Hosting **im eigenen Rechenzentrum**, hinter einer Firewall, ohne direkte Internet-Exposition. Bevorzugtes Szenario für die sensibelsten Daten.

```mermaid
flowchart LR
  U["Interne Arbeitsplätze<br/>(LAN / VPN)"] -->|HTTPS / TLS 1.2+| FW["Firewall + WAF"]
  subgraph DC["Internes Rechenzentrum — segmentierte Vertrauenszone"]
    FW --> RP["Reverse Proxy TLS<br/>Nginx / Caddy / Traefik<br/>HSTS, Security-Header"]
    RP --> APP["ACRA (Next.js)<br/>Docker-Container"]
    IDP["SSO-IdP<br/>SAML 2.0 / OIDC<br/>+ MFA Admins"] -.->|Föderation| APP
    APP --> DB[("PostgreSQL<br/>privates Netz<br/>verschlüsselt at rest")]
    APP --> BK[("Backups<br/>verschlüsselt, offline")]
    APP --> SIEM["Logs / SIEM"]
  end
```

**Schlüsselmaßnahmen:**
- **Segmentiertes** Netz (dediziertes VLAN), Anwendung **nicht** im Internet **exponiert**; Zugriff über LAN oder **VPN**.
- **Firewall** + WAF vorgelagert; Reverse Proxy terminiert HTTPS in **TLS 1.2+** (`NEXTAUTH_URL=https://…`), **HSTS** aktiviert.
- **SSO** (SAML/OIDC) + **obligatorische MFA für Administratoren** (E-Mail/SMS-OTP).
- PostgreSQL **niemals öffentlich exponiert**, **verschlüsselt at rest**, Zugriff auf die App beschränkt.
- **Verschlüsselte Backups**, regelmäßig und getestet; Secrets über einen Vault (`SECRETS_ENCRYPTION_KEY`).
- Zentralisierte **Protokollierung** (ACRA-Audit-Trail + Winston-Logs → SIEM); periodische Zugriffsüberprüfungen.

### Fall 2 — Externes *PaaS / IaaS*-Hosting (Cloud)

Bei Hosting in einer externen Cloud (IaaS/PaaS) **die Angriffsfläche reduzieren** und die Authentifizierung für **alle** Konten stärken.

```mermaid
flowchart LR
  U["Benutzer"] -->|"SSL-VPN **oder** IP-Allowlist"| GW["Gateway<br/>WAF + TLS"]
  subgraph CL["PaaS / IaaS Cloud — exponierte Zone"]
    GW --> APP["Containerisiertes ACRA"]
    IDP["SSO-IdP + MFA<br/>für ALLE Konten"] -.->|Föderation| APP
    APP --> DB[("Managed PostgreSQL<br/>privater Zugriff, verschlüsselt")]
    APP --> SIEM["Logs exportiert<br/>zum SIEM"]
  end
```

**Schlüsselmaßnahmen (zusätzlich zu Fall 1):**
- Beschränkter Zugriff über **IP-Allowlist** **oder** **SSL-VPN** — kein offener öffentlicher Zugriff.
- **SSO + MFA für ALLE Benutzer** (nicht nur Admins).
- **Managed-Datenbank in einem privaten Netz** (niemals öffentliche IP), Verschlüsselung in Transit und at rest.
- Secrets in einem **Managed Vault** (KMS / Secrets Manager); regelmäßige Rotation.
- Logs zu einem **SIEM** exportiert; Alarmierung bei sensiblen Ereignissen (Anmeldungen, Exporte, Löschungen).

### Was ACRA zur Umsetzung dieser Best-Practices bietet

| ANSSI-Best-Practice | ACRA-Funktion |
|---|---|
| Starke Authentifizierung | **MFA** E-Mail/SMS-OTP, Bereich `ALL` oder `ADMIN_ONLY` |
| Föderierte Identität | **SSO** SAML 2.0 / OIDC mit Auto-Provisioning |
| Geringste Rechte | **RBAC** 12 Rollen (3 Verteidigungslinien) + Freigabe pro Analyse |
| Nachvollziehbarkeit | Vollständiger **Audit-Trail**, CSV-exportierbar |
| Zentrale Protokollierung | **SIEM**-Weiterleitung Protokoll für Protokoll, Positivliste der Ziele |
| Externe Sicherung | **Verschlüsselte** Wiederherstellungspunkte, **geprüfte** externe Kopie (Ordner, Befehl, S3) |
| Beherrschte KI | Keine eingebettete KI; **MCP**: eigener widerrufbarer Schlüssel, menschliche Freigabe, protokollierte Aufrufe |
| Vertraulichkeit in Transit | Erzwungenes HTTPS + **Security-Header** (CSP, HSTS, X-Frame-Options…) |
| Geheimnisschutz | Verschlüsselte Secrets (`SECRETS_ENCRYPTION_KEY`), bcrypt (Kosten 12) |
| Reversibilität / Fehlertoleranz | **30-Tage-Papierkorb** (Soft Delete + Admin-Wiederherstellung) |
| Eingaberobustheit | Zod + **Allowlist-Sanitizer** (Anti-Mass-Assignment) |

---

## 🧭 Branchenspezifische Anleitung & Konformität

ACRA passt das Vorgehen an den **regulatorischen und branchenspezifischen Kontext** der Organisation an, ohne ihn je aufzuzwingen.

**Branchenspezifische Beispiele** — die bei der Rahmensetzung gewählte Branche (und für regulierte Branchen eine **Teilbranche**) speist gezielte Fachbeispiel-Bibliotheken in den Workshops 1 bis 3 (Geschäftswerte, unterstützende Assets, befürchtete Ereignisse, Risikoquellen, Szenarien, Interessengruppen). **16 Familien** decken die 20 Branchen ab: Gesundheit, Bank/Finanzen, Industrie & Energie (inkl. **erneuerbare Energien**: Wind/PV/BESS), Verkehr, Telekom, öffentliche Verwaltung, Lebensmittelindustrie, Immobilien/Bau, Medien, Tourismus, Vereine, Recht, Digital, Bildung/Forschung, Handel, Verteidigung. **Teilbranchen** verfeinern den Inhalt weiter: ein Notar sieht keine anwaltsspezifischen Beispiele, Schiene unterscheidet sich von Luftfahrt, Bau von der Immobilienagentur.

**Framework-Empfehlung** — Branche, **Organisationsgröße** (Kleinstunternehmen / KMU / Großunternehmen) und Teilbranche steuern die empfohlenen Frameworks (z. B. Bank → DORA, Gesundheit → HDS, Industrie/Energie → IEC 62443, Verwaltung → RGS, Softwarehersteller → NIST SSDF/SOC 2). DORA wird nur regulierten Finanzunternehmen vorgeschlagen (nicht einem Fintech-Start-up vor der Zulassung).

**Konformitätsmodul (optional, pro Organisation aktivierbar)**

- **Qualifizierung** der Analyse (Kritikalität, personenbezogene Daten, Exposition, interner CISO…), die Orientierungen erzeugt;
- **Regulatorischer Status**: proaktive Erkennung des **NIS2**-Regimes (*wesentliche* / *wichtige* Einrichtung je Branche), Marker **OSE / EEI / OIV** mit Auswahl der **OIV-Branche** (12 SAIV-Branchen), Hinweis auf das **Doppelregime OIV (LPM) + EEI (NIS2)** und darauf, dass **DORA vor NIS2 Vorrang hat** für die Finanzbranche;
- **kontextbezogene Pflichten** (Registrierung, Vorfallmeldung an das CSIRT/ANSSI — oder an **CERT Santé/ANS** im Gesundheitswesen, SIIV-Krisenübung…);
- **Informationsklassifizierung** (**IGI-1300**-Marker: NP / DR / Geheim / Streng geheim);
- **DSGVO-Art.-9-Warnung** bei sensiblen Daten;
- **Verwertungshinweise** zum Bericht: IKT-Risikodokumentation (**DORA Art. 8**), Bestandteil einer **Sicherheitsakkreditierung** (PSSIE / RGS / IGI 1300), **ORSA**-Bewertung (Solvency II) für Versicherungen;
- **NIS2-Art.-21**-Abdeckung des gewählten Maßnahmen-Frameworks.

**Generative KI** — neue Risiken durch generative KI (Deepfakes, KI-gestütztes Phishing, Datenabfluss über „Shadow AI“, Prompt Injection) sind in den Standardbeispielen enthalten, branchenübergreifend.

> Diese Elemente sind **dokumentarisch und nicht blockierend**: Sie leiten und warnen, aber der Analyst bleibt frei in seiner Wahl.

---

## 🏢 Multi-Organisation (hierarchisch)

ACRA verwaltet **mehrere Organisationen in einer Instanz**, als **Baum** angeordnet. Eine Installation deckt vier Anwendungsfälle ab:

| Anwendungsfall | Mechanismus |
|---|---|
| **Beratungsfirma** mit mehreren Kunden | **Isolierte Wurzel**-Organisationen; ein Berater ist **Mitglied mehrerer** Organisationen mit je einer Rolle |
| **Großkonzern** (Einheit + Gruppe) | **Hierarchie**; der Einheits-CISO hat eine *Einheits*-Sicht, der Gruppen-CISO eine **konsolidierte** Teilbaum-Sicht |
| **Unternehmen mit mehreren Standorten/Ländern** | Hierarchie Unternehmen → Standorte |
| **Tochter- und Enkelgesellschaften** | Baum **beliebiger Tiefe** |

Jedes Mitglied hat eine Rolle **pro Organisation** und einen Bereich `NODE` oder `SUBTREE`. Die Isolation ist zentralisiert: jede Ansicht filtert nach der **aktiven** Organisation (Umschalter in der Kopfzeile). Erstreckt sich ein Bereich über mehrere Organisationen, zeigen Dashboard/Risiken/Dritte die **Ursprungs-Einheit** jedes Elements.

**Konfiguration pro Organisation** — jede Organisation kann eigene Ökosystem-Skalen, Beispiele, Frameworks und Optionen haben; ohne Wert **erbt** sie von den Vorfahren. **Risikoskalen** sind eine Instanzeinstellung (Super-Admin): **gemeinsam** (Gruppenmodus) oder **pro Organisation** (Beratermodus).

**Rollen** — eine Instanzrolle **`SUPER_ADMIN`** verwaltet Organisationen; `ADMIN` wird Organisationsadministrator. Das erste Konto einer Neuinstallation ist SUPER_ADMIN; auf einer bestehenden Instanz wird der älteste Admin beim ersten Start befördert. Jede Organisation erhält ein **automatisch generiertes Logo**.

Verwaltung: `Admin → Organisationen` (nur Super-Admin).

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
| `DIRECTION_METIER` (Fachbereich) | ❌ | ❌ (Lesen) | ❌ | ❌ — *akzeptiert Restrisiken* |
| `ANALYSTE` (Analyst) | ✅ | ✅ eigene + geteilte | ❌ | ❌ |
| `LECTEUR` (Leser) | ❌ | ❌ | ❌ | ❌ |

**GRC-Rollen / 3 Verteidigungslinien** (globaler Lesezugriff auf das Dispositiv + Schreibzugriff auf ihr Modul):

| Rolle | Bereich |
|------|-----------|
| `CONTROLEUR` | Permanente Kontrolle (1./2. Linie) — Ausführung & Definition der Kontrollen |
| `CONFORMITE` | 2. Linie — Compliance, Ausnahmegenehmigungen, RCSA-Kampagnen |
| `DPO` | Datenschutz — **Verzeichnis von Verarbeitungstätigkeiten (VVT, DSGVO Art. 30)** |
| `AUDITEUR` | 3. Linie — interne Revision (Prüfungen, Feststellungen, Empfehlungen) |
| `METIER` | Operativ 1. Linie — Vorfallmeldung, Kontrollausführung |

Zugriffe können auch **analyseweise** gewährt werden (punktuelles Teilen mit jedem Benutzer).

---

## 💾 Speicherplatz (Docker)

```bash
make docker-usage   # Aufschlüsselung des von Docker belegten Speichers (docker system df -v)
make docker-clean   # nach Bestätigung: gestoppte Projekt-Container, verwaiste Images, Build-Cache über 5 GB
make rebuild        # Neuaufbau ohne Cache (make build nutzt den Cache)
```

`make docker-clean` löscht **nie** ein Volume (Datenbank, Dokumente, Sicherungen). Container-Logs sind auf
3 × 10 MB pro Dienst begrenzt; ein erfolgreiches Update entfernt ACRA-Images, die älter als die Vorversion sind (diese bleibt für einen schnellen Rollback erhalten).

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
