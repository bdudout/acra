<div align="center">

<img src="public/logo-mark.png" alt="ACRA Logo" width="120" />

# ACRA — Augmented Cyber Risk Analysis

**La plataforma open-source que hace accesible el análisis de riesgos EBIOS RM a todos**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![EBIOS RM](https://img.shields.io/badge/M%C3%A9todo-EBIOS%20RM-red)](https://cyber.gouv.fr/la-methode-ebios-risk-manager)
[![ANSSI](https://img.shields.io/badge/Compatible-ISO%2027005-green)](https://www.iso.org/standard/75281.html)

**🌐 Langue / Language:** [🇫🇷 Français](README.md) · [🇬🇧 English](README.en.md) · [🇩🇪 Deutsch](README.de.md) · 🇪🇸 Español · [🇮🇹 Italiano](README.it.md)

</div>

---

## 🎯 Presentación

**ACRA (Augmented Cyber Risk Analysis)** es una aplicación web guiada que permite a cualquier equipo de seguridad — incluso sin gran experiencia — llevar a cabo un análisis de riesgos completo según el método **EBIOS Risk Manager** de la ANSSI francesa, compatible con **ISO 27005**.

### El problema que resuelve ACRA

Los análisis de riesgos EBIOS RM son exigentes: el método consta de 5 talleres interconectados, decenas de conceptos que dominar, y el menor error de coherencia puede invalidar todo el estudio. En la práctica, los equipos recurren a hojas de cálculo Excel complejas, a consultores caros, o renuncian al rigor metodológico.

ACRA cambia esto: es un **asistente metodológico interactivo** que guía paso a paso, propone ejemplos clicables en cada etapa, mantiene la coherencia entre los talleres y produce automáticamente un informe PDF estructurado.

### ¿Para quién?

| Perfil | Uso |
|--------|-----|
| 🔒 CISO y Risk Managers | Dirigir los análisis, aprobar, supervisar la cartera de riesgos |
| 🔍 Analistas de seguridad | Realizar los talleres, documentar los escenarios, planificar las medidas |
| 🏢 TI y Dirección | Leer las síntesis, seguir el tratamiento, validar los presupuestos de medidas |
| 🎓 Estudiantes y formadores | Aprender el método EBIOS RM con una herramienta concreta |

### Lo que diferencia a ACRA

- **Guía metodológica integrada**: cada campo dispone de un tooltip, un enlace a la guía ANSSI y ejemplos contextuales
- **Coherencia automática**: los elementos de un taller alimentan automáticamente los siguientes
- **14 marcos de medidas**: ISO 27001:2022, NIST CSF 2.0, NIST 800-53, CIS Controls v8, Higiene ANSSI, HDS, PCI-DSS, DORA, IEC 62443, SOC 2, NIST SSDF, RGS, ReCyF, TISAX/VDA-ISA — desde una única interfaz
- **Guía sectorial y conformidad**: ejemplos de negocio adaptados al sector y subsector, recomendación de marcos, detección del estatus regulatorio (NIS2, OIV…) — [ver detalles](#-guía-sectorial-y-conformidad)
- **Método Flash (Club EBIOS)**: un recorrido guiado de los 5 talleres en una sola pasada, apoyándose en la capitalización (ejemplos, base de seguridad) — ideal para un primer análisis o un contexto restringido
- **Guías del Club EBIOS integradas**: el método Flash y la ficha de método 5 (peligrosidad de las partes interesadas) están implementados directamente en el recorrido
- **100 % autoalojado**: tus datos nunca salen de tu infraestructura

---

## ✨ Funcionalidades

### 📋 Método EBIOS RM completo

- **5 talleres guiados** con biblioteca de ejemplos clicables (valores de negocio, fuentes de riesgo, escenarios, medidas…)
- **Método Flash (Club EBIOS)**: un recorrido rápido T1 → T2 → T3 → T4 → T5 en una sola pasada, capitalizando los ejemplos y la base de seguridad, para producir rápidamente una lista de riesgos y un plan de acción
- **Guía EBIOS RM interactiva** integrada con enlaces directos a las páginas de la guía oficial de la ANSSI
- **Matriz de riesgos** visual (gravedad × probabilidad) con niveles residuales y comparación antes/después de las medidas
- Criterios **DICT** (Disponibilidad, Integridad, Confidencialidad, Trazabilidad) sobre valores de negocio y activos de soporte
- Enlaces MITRE ATT&CK en los escenarios operativos
- **Mapa radar de los pares fuente de riesgo / objetivo perseguido** (Taller 2)
- **Operadores lógicos Y/O** en los modos operativos (Taller 4)
- **Tres métodos de evaluación de la probabilidad**: exprés, estándar, avanzado (puntuación por acción elemental y cálculo de la probabilidad global)
- **Categorización EBIOS de las medidas**: gobernanza, protección, defensa, resiliencia
- **Mención de protección** del documento de análisis (no protegida → confidencial), en la portada y las exportaciones
- **Versionado x.y** de los análisis e **historial de revisiones** (ciclo operativo/estratégico)
- **Cartografía de amenaza del ecosistema** (Taller 3, ficha de método 5 de ANSSI): peligrosidad de las partes interesadas calculada con 4 subcriterios, radar polar de 3 zonas, escalas configurables, marcado de terceros críticos — [ver detalle](#️-cartografía-de-amenaza-del-ecosistema-taller-3)
- Vista transversal de **Terceros**: gestión de terceros (*third-party management*) a escala de la organización, agregada sobre todos los análisis, filtrable por zona y criticidad

### 🔐 Seguridad y marcos

- Medidas de seguridad de **14 marcos**: ISO 27001:2022 · NIST CSF 2.0 · NIST 800-53 · CIS Controls v8 · Higiene ANSSI · HDS · PCI-DSS · DORA · IEC 62443 · SOC 2 · NIST SSDF · RGS · ReCyF · TISAX/VDA-ISA + controles personalizados — controles **localizados en 5 idiomas**
- Política de contraseñas configurable (longitud, complejidad, caducidad, historial, bloqueo)
- **MFA** configurable (código de un solo uso por **correo electrónico** o **SMS**) con ventana de confirmación de 60 min para evitar bloqueos accidentales
- **SSO** configurable (SAML 2.0 u OIDC) — aprovisionamiento automático de cuentas
- Pista de auditoría completa exportable (CSV)

### 👥 Colaboración y gobernanza

- **RBAC de 7 niveles**: SUPER_ADMIN · ADMIN · CISO · RISK_MANAGER · DIRECCIÓN_DE_NEGOCIO · ANALISTA · LECTOR
- **Multiorganización**: árbol de organizaciones con perímetros jerárquicos (nodo / subárbol); un ADMIN administra **solo las cuentas de su organización**, un SUPER_ADMIN gestiona la instancia
- Flujo de aprobación: envío → revisión → aprobación (CISO o Risk Manager), con **separación de funciones** — un aprobador no puede aprobar **su propio** análisis (principio de cuatro ojos) — y **autovalidación** para organizaciones de un solo usuario (despachos individuales, donde los cuatro ojos son imposibles)
- **Aceptación de riesgos residuales** por la **Dirección de negocio** (rol dedicado de solo lectura), distinta de la validación del análisis
- **Exenciones** — aceptación *temporal* de una no conformidad de la base de seguridad: vinculada a un control de un marco o a un riesgo, **justificada, compensada, acotada en el tiempo y supervisada**. Flujo configurable por organización (**autoservicio** / validación **CISO** / CISO + **Dirección de negocio**, segunda revisión opcional por el CISO de grupo), **alertas de vencimiento**, cierre con **pruebas** y un **registro de exenciones** transversal — un entregable de cumplimiento (ISO 27001, registro de excepciones DORA)
- Compartición de acceso por análisis con permisos individuales
- Panel de administración: gestión de usuarios (perímetro de la organización), creación de cuentas, suspensión, registros de auditoría
- **Recuperación (papelera)**: un análisis eliminado por un usuario sigue siendo restaurable por un administrador durante **30 días** antes de su purga definitiva

### 📊 Exportación y reporting

- Exportación **PDF** estructurada de varias páginas (resumen ejecutivo, KPIs, talleres, medidas, anexos metodológicos)
- Exportación **Excel (.xlsx)** con todos los datos tabulares por pestaña
- Exportación **JSON** (copia de seguridad completa, reimportable) y **CSV** (datos tabulares)
- Importación de análisis desde JSON o CSV

### 🌐 UX y accesibilidad

- Interfaz en **5 idiomas**: Français · English · Deutsch · Español · Italiano
- **Autoguardado** en cada modificación (sin pérdida de datos)
- Panel con KPIs, gráficos, alertas de riesgos críticos, búsqueda global
- Tema claro / oscuro / automático
- Conforme a RGAA: navegación por teclado, ARIA, contrastes accesibles

---

## 🎬 Demo

![Demo ACRA — recorrido completo de un análisis de riesgos](docs/screenshots/acra-demo.gif)

## 📸 Vista previa de la interfaz

| | Tema claro | Tema oscuro |
|---|---|---|
| **Panel** | ![](docs/screenshots/dashboard-light.png) | ![](docs/screenshots/dashboard-dark.png) |
| **Mis análisis** | ![](docs/screenshots/analyses-light.png) | ![](docs/screenshots/analyses-dark.png) |
| **Taller 1 — Encuadre y base** | ![](docs/screenshots/atelier1-light.png) | ![](docs/screenshots/atelier1-dark.png) |
| **Taller 5 — Tratamiento del riesgo** | ![](docs/screenshots/atelier5-light.png) | ![](docs/screenshots/atelier5-dark.png) |
| **Mapa de riesgos** | ![](docs/screenshots/risques-light.png) | ![](docs/screenshots/risques-dark.png) |
| **Taller 3 — Cartografía del ecosistema** | ![](docs/screenshots/ecosystem-radar-light.png) | ![](docs/screenshots/ecosystem-radar-dark.png) |
| **Configuración (escalas y matriz)** | ![](docs/screenshots/configuration-light.png) | ![](docs/screenshots/configuration-dark.png) |
| **Administración** | ![](docs/screenshots/admin-light.png) | ![](docs/screenshots/admin-dark.png) |
| **Registro de auditoría** | ![](docs/screenshots/admin-audit-light.png) | ![](docs/screenshots/admin-audit-dark.png) |

---

## 🚀 Inicio rápido (Docker)

**No se requiere ninguna instalación local de Node, npm o Prisma**: la imagen Docker
incluye todas las dependencias y el cliente Prisma, y aplica las migraciones
automáticamente al arrancar (servicio `migrator`).

```bash
git clone https://github.com/votre-org/acra.git
cd acra
make setup        # genera .env + secretos aleatorios (interactivo)
docker compose up -d
```

> ¿Sin `make`? Usa directamente: `./scripts/setup.sh` (o `npm run setup`).
> Instalación automatizada / CI (sin preguntas): `./scripts/setup.sh --auto`.

`setup.sh` genera por ti secretos fuertes (`NEXTAUTH_SECRET`, contraseña de
PostgreSQL, `SECRETS_ENCRYPTION_KEY`) y **solo regenera los valores que faltan**
si se vuelve a ejecutar (detalles en la sección «Instalación detallada» más abajo).

**La aplicación está disponible en http://localhost:3000.**
Crea tu cuenta en `/auth/register` — **la primera cuenta creada se convierte
automáticamente en SUPER-ADMINISTRADOR de instancia**.

Para cargar los datos de demostración (opcional, nunca en producción):

```bash
docker compose exec app npx prisma db seed
# Cuenta demo creada: admin@chu-metropole.fr / Acra@Admin2024!
# ⚠️ Solo para pruebas — cambia/elimina esta cuenta antes de cualquier puesta en producción
```

---

## 📦 Instalación detallada

### Requisitos previos

| Herramienta | Versión mínima | Notas |
|-------------|----------------|-------|
| Docker Desktop | 4.x | o Docker Engine + Compose v2 |
| RAM disponible | 512 MB | 1 GB recomendado |
| Puertos libres | 3000, 5432 | configurables en `docker-compose.yml` |

> **Sin Docker** (desarrollo local): se requieren Node.js 20+ y PostgreSQL 14+ — ver [Desarrollo local](#-desarrollo-local).

---

### Paso 1 — Clonar el repositorio

```bash
git clone https://github.com/votre-org/acra.git
cd acra
```

---

### Paso 2 — Configurar el entorno (automatizado)

El script de setup crea el archivo `.env` y **genera secretos fuertes**. Es
**idempotente**: al reejecutarlo, conserva los valores ya definidos y solo completa lo que falta.

```bash
./scripts/setup.sh          # interactivo (pide la URL pública)
# o, sin ninguna interacción (secretos aleatorios, URL por defecto):
./scripts/setup.sh --auto
```

El script rellena automáticamente:

| Variable | Función | Generado por setup.sh |
|----------|---------|:---:|
| `NEXTAUTH_SECRET` | Firma de las sesiones JWT | ✅ aleatorio (48 B) |
| `POSTGRES_PASSWORD` | Contraseña de PostgreSQL | ✅ aleatorio (32 car.) |
| `SECRETS_ENCRYPTION_KEY` | Cifrado AES-256-GCM de los secretos en BD (OIDC, SMS, SMTP) | ✅ aleatorio (48 B) |
| `DATABASE_URL` | Conexión Prisma | ✅ derivada de las variables PostgreSQL |
| `POSTGRES_USER` / `POSTGRES_DB` | Identidad de la base | `acra_user` / `acra_rm` |
| `NEXTAUTH_URL` | URL pública | solicitada (por defecto `http://localhost:3000`) |

> **Configuración manual** (alternativa): `cp .env.example .env` y luego reemplaza
> todos los valores `CHANGEZ_MOI`. Genera un secreto con `openssl rand -base64 48`.
>
> ⚠️ **Producción**: `NEXTAUTH_URL` debe ser **HTTPS**. Nunca hagas commit de `.env`
> (ya está en `.gitignore`). Si cambia `SECRETS_ENCRYPTION_KEY`, los secretos ya
> cifrados en la base deberán reintroducirse en la interfaz de administración.

---

### Paso 3 — Arrancar los servicios

```bash
docker compose up -d
```

Docker lanza 4 servicios:
- **`db`** — PostgreSQL 16 (puerto 5432)
- **`migrator`** — ejecuta `prisma migrate deploy` al arrancar (luego se detiene)
- **`app`** — Aplicación Next.js (puerto 3000)
- **`backup`** — copias de seguridad automáticas de PostgreSQL (rotación de 7 días)

Comprobar que todo funciona:

```bash
docker compose ps
# Todos los servicios deben estar en estado "running" (excepto migrator: "exited 0")

curl http://localhost:3000/api/health
# {"status":"ok","db":"connected","timestamp":"..."}
```

---

### Comandos útiles

```bash
# Ver los logs en tiempo real
docker compose logs -f app

# Detener los servicios
docker compose down

# Detener Y eliminar los volúmenes (borra la base de datos)
docker compose down -v

# Recompilar tras modificar el código
docker compose up -d --build

# Acceder a la base de datos vía psql (usa las credenciales del contenedor)
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'

# Ejecutar un seed de datos de demostración
docker compose exec app npx prisma db seed

# Lanzar las migraciones manualmente
docker compose exec app npx prisma migrate deploy
```

---

### Actualización

```bash
git pull origin main
docker compose up -d --build
# Las migraciones se aplican automáticamente al arrancar
```

---

### Copia de seguridad y restauración

Las copias de PostgreSQL están automatizadas en `docker-compose.yml` (rotación de 7 días):

```bash
# Copia manual
docker compose exec db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup_$(date +%Y%m%d).sql

# Restauración
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"' < backup_20240115.sql
```

---

## 🔧 Desarrollo local

Para contribuir o personalizar ACRA sin Docker:

### Requisitos previos

- **Node.js** 20+ (`node --version`)
- **PostgreSQL** 14+ (o Docker solo para la BD)
- **npm** 10+

### Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/votre-org/acra.git
cd acra

# 2. Instalar las dependencias (también genera el cliente Prisma vía postinstall)
npm install

# 3. Arrancar PostgreSQL vía Docker (la opción más simple)
docker run -d --name acra-db \
  -e POSTGRES_USER=acra_user \
  -e POSTGRES_PASSWORD=acra_secret \
  -e POSTGRES_DB=acra_rm \
  -p 5432:5432 postgres:16-alpine

# 4. Configurar el entorno (genera .env con secretos)
./scripts/setup.sh --auto
# En local sin Docker para la app, apunta la base a localhost:
sed -i 's/@db:5432/@localhost:5432/' .env

# 5. Aplicar las migraciones y generar el cliente Prisma
npx prisma migrate deploy
npx prisma generate

# 6. (Opcional) Cargar los datos de demostración
npx prisma db seed

# 7. Arrancar en modo desarrollo (hot reload)
npm run dev
```

La aplicación está disponible en **http://localhost:3000**

### Scripts disponibles

```bash
npm run dev          # Servidor de desarrollo (hot reload)
npm run build        # Build de producción
npm run start        # Servidor de producción (tras el build)
npm run setup        # (Re)genera el archivo .env (secretos faltantes)
npm test             # Pruebas unitarias Vitest (una vez)
npm run test:watch   # Pruebas en modo watch
npm run test:coverage # Informe de cobertura
npx tsc --noEmit     # Verificación TypeScript sin compilación
```

### Flujo TDD

> **TDD obligatorio**: cada nueva funcionalidad debe ir acompañada de una prueba escrita *antes* de la implementación. Ver [CONTRIBUTING.md](./CONTRIBUTING.md).

```bash
# 1. Escribir la prueba (debe fallar)
# → src/__tests__/unit/lib/mi-feature.test.ts

# 2. Lanzar en watch para ver el rojo
npm run test:watch

# 3. Implementar hasta el verde
# 4. Refactorizar
```

---

## 🏗️ Arquitectura

```
ebios-rm/
├── src/
│   ├── app/                          # Páginas Next.js (App Router)
│   │   ├── page.tsx                  # Landing page
│   │   ├── dashboard/                # Panel de KPIs
│   │   ├── analyses/                 # Lista, creación, detalle
│   │   │   └── [id]/atelier/[num]/  # Los 5 talleres EBIOS RM
│   │   ├── risques/                  # Vista global de riesgos
│   │   ├── actions/                  # Plan de acción global (filtros)
│   │   ├── auth/                     # Login / Register / Reset
│   │   ├── admin/                    # Administración (solo ADMIN)
│   │   │   ├── users/                # Gestión de usuarios
│   │   │   ├── security/             # Política MFA, SSO, contraseña
│   │   │   ├── audit/                # Registro de auditoría
│   │   │   └── config/               # Configuración de la organización
│   │   ├── configuration/            # Escalas, matriz, marcos
│   │   └── profile/                  # Perfil, idioma, tema
│   │   └── api/                      # Rutas API REST (Next.js)
│   ├── components/
│   │   ├── workshops/                # Atelier1.tsx → Atelier5.tsx
│   │   ├── Navbar.tsx                # Navegación principal + búsqueda
│   │   ├── RiskMatrix.tsx            # Matriz de riesgos interactiva
│   │   ├── WorkshopProgress.tsx      # Barra de progreso de talleres
│   │   ├── EbiosGuide.tsx            # Guía interactiva EBIOS RM
│   │   ├── FrameworkControlsPanel.tsx # Panel de medidas multi-marco
│   │   └── AnalysesChart.tsx         # Gráficos del panel
│   └── lib/
│       ├── ebios-data.ts             # Biblioteca EBIOS RM (sugerencias)
│       ├── frameworks-data.ts        # Controles ISO 27001, NIST, CIS…
│       ├── permissions.ts            # Matriz RBAC centralizada
│       ├── logger.ts                 # Logs estructurados Winston + audit trail
│       ├── useAutoSave.ts            # Hook React de autoguardado
│       ├── password-policy.ts        # Validación de política de contraseñas
│       ├── prisma.ts                 # Cliente Prisma singleton
│       └── i18n/                     # Traducciones (fr/en/de/es/it)
├── prisma/
│   ├── schema.prisma                 # Modelo de datos PostgreSQL
│   └── migrations/                   # Migraciones SQL versionadas
├── src/__tests__/                    # Pruebas unitarias Vitest
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

### Stack técnico

| Capa | Tecnología | Versión |
|------|------------|---------|
| Framework | Next.js App Router (Server + Client Components) | 16 |
| Lenguaje | TypeScript strict | 5 |
| Base de datos | PostgreSQL | 16 |
| ORM | Prisma | 5 |
| Autenticación | NextAuth.js (credentials + JWT) | 4 |
| UI | Tailwind CSS | 3 |
| Exportación PDF | @react-pdf/renderer (servidor) | — |
| Exportación Excel | ExcelJS | — |
| Pruebas | Vitest + Testing Library | — |
| Logs | Winston (JSON estructurado) | — |
| Despliegue | Docker + Docker Compose | — |

---

## 🔒 Seguridad

### Medidas implementadas

- Contraseñas con hash **bcrypt** (coste 12)
- Sesiones **JWT** firmadas (`NEXTAUTH_SECRET`)
- Middleware de autenticación Next.js en todas las rutas protegidas
- **Cabeceras HTTP de seguridad**: X-Frame-Options, CSP, X-Content-Type-Options, Referrer-Policy, HSTS
- Validación de entradas del lado servidor: esquemas **Zod** (autenticación, políticas de administración) y **sanitizadores por lista blanca** en talleres e importaciones (anti asignación masiva, CWE-915)
- Aislamiento de datos por usuario + RBAC por análisis
- **Pista de auditoría completa** (tabla `AuditLog`) para todas las acciones sensibles, exportable a CSV
- Rate limiting en las rutas de autenticación
- **MFA** configurable con ventana de seguridad (autodesactivación si no se confirma en 60 min)
- **SSO** SAML 2.0 / OIDC configurable

### Checklist de producción

```bash
# 1. Generar todos los secretos (NEXTAUTH_SECRET, contraseña de PostgreSQL,
#    SECRETS_ENCRYPTION_KEY) con un solo comando — idempotente:
./scripts/setup.sh --auto

# 2. Definir la URL pública HTTPS en .env
#    NEXTAUTH_URL=https://acra.midominio.es   (HTTPS obligatorio)

# 3. Colocar detrás de un proxy inverso HTTPS (Nginx, Caddy, Traefik + TLS)

# 4. NO cargar el seed de demo en producción. Si se hizo por error:
#    inicia sesión en /admin/users y elimina/reinicia admin@chu-metropole.fr

# 5. Arrancar y comprobar el health check
docker compose up -d
curl https://tu-dominio.com/api/health
# {"status":"ok","db":"connected",...}
```

> La **primera cuenta** creada en `/auth/register` se convierte en **ADMINISTRADOR**.
> Créala inmediatamente tras el despliegue para evitar que un tercero se atribuya
> ese rol (el registro está abierto por defecto).

> Se ha realizado una auditoría de seguridad OWASP/WSTG completa de la aplicación. Ver el informe en [docs/](./docs/).

---

## 📖 Los 5 talleres EBIOS RM

| # | Taller | Descripción |
|---|--------|-------------|
| **T1** | Encuadre y base de seguridad | Alcance, misiones, valores de negocio (criterios DICT), activos de soporte, eventos temidos, marcos de seguridad |
| **T2** | Fuentes de riesgo | Identificación de atacantes, objetivos perseguidos (pares FR/OP), niveles de pertinencia P1/P2 |
| **T3** | Escenarios estratégicos | Ecosistema, **cartografía de amenaza de las partes interesadas** (radar de peligrosidad), caminos de ataque, medidas de seguridad del ecosistema |
| **T4** | Escenarios operativos | Acciones técnicas de los atacantes, probabilidad, enlaces MITRE ATT&CK |
| **T5** | Tratamiento del riesgo | Estrategias de tratamiento (reducción, transferencia, rechazo, aceptación), medidas por marco, riesgos residuales, plan de acción |

> **⚡ Método Flash (Club EBIOS)**: un recorrido rápido T1 → T2 → T3 → T4 → T5, disponible desde el panel. Conforme al enfoque «Flash» del Club EBIOS, todos los talleres se recorren en una sola pasada capitalizando los ejemplos y la base de seguridad, concentrándose en los escenarios más pertinentes (≈ 5 máx). La escala y la matriz siguen siendo las configuradas por el administrador. Ideal para un primer análisis o un contexto restringido.

---

## 🗺️ Cartografía de amenaza del ecosistema (Taller 3)

ACRA implementa la **ficha de método 5 de ANSSI / Club EBIOS** («estimar la peligrosidad de las partes interesadas») para priorizar los terceros del ecosistema: proveedores, prestadores, clientes, socios, reguladores.

El nivel de amenaza de un tercero se calcula a partir de **4 subcriterios** valorados en escalas cualitativas configurables:

```text
              Dependencia × Penetración             (exposición, ↑ amenaza)
amenaza  =  ───────────────────────────────────
              Madurez cibernética × Confianza        (fiabilidad, ↓ amenaza)
```

Los terceros se sitúan en un **radar polar**: cuanto más cerca del centro, mayor es la amenaza. Tres zonas de **igual anchura** — peligro / control / vigilancia — guían la priorización (los terceros en peligro o control son *críticos* y alimentan los escenarios estratégicos).

| Radar de amenaza | Esquema de cálculo (ayuda integrada) |
|---|---|
| ![Radar de amenaza del ecosistema](docs/screenshots/ecosystem-radar-light.png) | ![Cálculo del nivel de amenaza](docs/screenshots/ecosystem-formula-light.png) |

**Lectura del radar:**

- **Color** del punto = fiabilidad cibernética (rojo baja → verde alta)
- **Tamaño** del punto = exposición (mayor = más expuesto)
- **Anillos** = zonas de amenaza (peligro naranja · control amarillo · vigilancia verde)
- **★** = tercero marcado como *crítico* (manual)
- **Etiqueta** = nombre corto editable (clic o **doble clic** en el punto) o ref. `T1, T2…`
- Al pasar el cursor sobre un punto → detalle de los 4 subcriterios, exposición/fiabilidad y amenaza

**Terceros de rango 2 / 3 (profundidad del ecosistema)** — conforme a la ficha de método 5 del Club EBIOS, un tercero crítico puede descomponerse en **partes interesadas conexas** (p. ej. el alojador de un proveedor, el subcontratista de un socio). ACRA gestiona tres rangos de profundidad: desde un tercero crítico, el botón **«+ PP conexa»** añade una parte interesada de **rango 2**, a su vez divisible en **rango 3**. En el radar, una casilla **«Rangos 2/3»** muestra estos terceros conexos (ocultos por defecto), atenuados y **vinculados a su tercero padre mediante una línea de puntos**, con evitación automática de solapamientos de puntos y etiquetas. El resumen ejecutivo (PDF) se centra en los terceros de rango 1 para la legibilidad.

**Escalas configurables** — cada nivel de los 4 criterios (1→4 por defecto) puede renombrarse en `Configuración → Ecosistema`, con adición/eliminación de niveles (solo ADMIN). El radar se adapta automáticamente a la escala.

![Escalas de peligrosidad configurables](docs/screenshots/ecosystem-scales-light.png)

**Vista transversal de Terceros** — la página **Terceros** agrega las partes interesadas de **todos** los análisis, filtrables por zona y criticidad (★), para una gestión de terceros (*third-party management*) a escala de la organización. Un mismo tercero puede aparecer varias veces (su peligrosidad depende del alcance analizado).

![Vista transversal de terceros](docs/screenshots/tiers-light.png)

El radar, las estrellas de criticidad y la tabla de partes interesadas (4 subcriterios + columna *Crítico*) también están presentes en la **exportación PDF**.

---

## 🏛️ Arquitectura segura recomendada (buenas prácticas ANSSI)

ACRA trata datos sensibles (análisis de riesgos, cartografía del ecosistema). El despliegue debe seguir los principios de la **guía de higiene informática de ANSSI**: segmentación, defensa en profundidad, mínimo privilegio, autenticación fuerte, registro.

### Caso 1 — Alojamiento interno *on-premises* (recomendado)

Alojamiento **en su centro de datos**, detrás de un cortafuegos, sin exposición directa a Internet. Escenario preferente para los datos más sensibles.

```mermaid
flowchart LR
  U["Puestos internos<br/>(LAN / VPN)"] -->|HTTPS / TLS 1.2+| FW["Cortafuegos + WAF"]
  subgraph DC["Centro de datos interno — zona de confianza segmentada"]
    FW --> RP["Reverse proxy TLS<br/>Nginx / Caddy / Traefik<br/>HSTS, cabeceras de seguridad"]
    RP --> APP["ACRA (Next.js)<br/>contenedor Docker"]
    IDP["IdP SSO<br/>SAML 2.0 / OIDC<br/>+ MFA admins"] -.->|federación| APP
    APP --> DB[("PostgreSQL<br/>red privada<br/>cifrado en reposo")]
    APP --> BK[("Copias de seguridad<br/>cifradas, fuera de línea")]
    APP --> SIEM["Registros / SIEM"]
  end
```

**Medidas clave:**
- Red **segmentada** (VLAN dedicada), aplicación **no expuesta** a Internet; acceso vía LAN o **VPN**.
- **Cortafuegos** + WAF en cabeza; reverse proxy terminando HTTPS en **TLS 1.2+** (`NEXTAUTH_URL=https://…`), **HSTS** activado.
- **SSO** (SAML/OIDC) + **MFA obligatoria para los administradores** (OTP correo/SMS).
- PostgreSQL **nunca expuesto públicamente**, **cifrado en reposo**, acceso restringido a la app.
- **Copias de seguridad cifradas**, regulares y probadas; secretos mediante una bóveda (`SECRETS_ENCRYPTION_KEY`).
- **Registro** centralizado (pista de auditoría de ACRA + registros Winston → SIEM); revisiones periódicas de acceso.

### Caso 2 — Alojamiento externo *PaaS / IaaS* (nube)

Si el alojamiento se hace en una nube externa (IaaS/PaaS), **reduzca la superficie de ataque** y refuerce la autenticación para **todas** las cuentas.

```mermaid
flowchart LR
  U["Usuarios"] -->|"VPN SSL **o** lista blanca de IP"| GW["Pasarela<br/>WAF + TLS"]
  subgraph CL["Nube PaaS / IaaS — zona expuesta"]
    GW --> APP["ACRA en contenedor"]
    IDP["IdP SSO + MFA<br/>para TODAS las cuentas"] -.->|federación| APP
    APP --> DB[("PostgreSQL gestionado<br/>acceso privado, cifrado")]
    APP --> SIEM["Registros exportados<br/>al SIEM"]
  end
```

**Medidas clave (además del caso 1):**
- Acceso restringido mediante **lista blanca de IP** **o** **VPN SSL** — sin acceso público abierto.
- **SSO + MFA para TODOS los usuarios** (no solo los administradores).
- **Base de datos gestionada en red privada** (nunca una IP pública), cifrado en tránsito y en reposo.
- Secretos en una **bóveda gestionada** (KMS / Secrets Manager); rotación regular.
- Registros exportados a un **SIEM**; alertas sobre eventos sensibles (inicios de sesión, exportaciones, eliminaciones).

### Lo que ACRA aporta para aplicar estas buenas prácticas

| Buena práctica ANSSI | Función de ACRA |
|---|---|
| Autenticación fuerte | **MFA** OTP correo/SMS, ámbito `ALL` o `ADMIN_ONLY` |
| Identidad federada | **SSO** SAML 2.0 / OIDC con aprovisionamiento automático |
| Mínimo privilegio | **RBAC** 5 roles + compartición por análisis |
| Trazabilidad | **Pista de auditoría** completa, exportable a CSV |
| Confidencialidad en tránsito | HTTPS forzado + **cabeceras de seguridad** (CSP, HSTS, X-Frame-Options…) |
| Protección de secretos | Secretos cifrados (`SECRETS_ENCRYPTION_KEY`), bcrypt (coste 12) |
| Reversibilidad / tolerancia a errores | **Papelera de 30 días** (soft delete + recuperación admin) |
| Robustez de entradas | Zod + **sanitizadores por lista blanca** (anti asignación masiva) |

---

## 🧭 Guía sectorial y conformidad

ACRA adapta el enfoque al **contexto regulatorio y sectorial** de la organización, sin imponerlo nunca.

**Ejemplos adaptados al sector** — el sector elegido en el encuadre (y, para los sectores regulados, un **subsector**) alimenta bibliotecas de ejemplos de negocio específicos en los Talleres 1 a 3 (valores de negocio, activos de soporte, eventos temidos, fuentes de riesgo, escenarios, partes interesadas). **16 familias** cubren los 20 sectores: salud, banca/finanzas, industria y energía (incluidas las **renovables**: eólica/FV/BESS), transporte, telecom, administración pública, agroalimentario, inmobiliario/construcción, medios, turismo, asociaciones, jurídico, digital, educación/investigación, comercio, defensa. Los **subsectores** afinan aún más el contenido: un notario no ve los ejemplos propios de los abogados, el ferroviario difiere del aéreo, la construcción de la agencia inmobiliaria.

**Recomendación de marcos** — el sector, el **tamaño de la organización** (muy pequeña / pyme / gran empresa) y el subsector orientan los marcos recomendados (p. ej. Banca → DORA, Salud → HDS, Industria/Energía → IEC 62443, Administración → RGS, editor de software → NIST SSDF/SOC 2). DORA solo se propone a las entidades financieras reguladas (no a una fintech previa a la autorización).

**Módulo de conformidad (opcional, activable por organización)**

- **Cualificación** del análisis (criticidad, datos personales, exposición, RSSI interno…) que produce orientaciones;
- **Estatus regulatorio**: detección proactiva del régimen **NIS2** (entidad *esencial* / *importante* según el sector), marcadores **OSE / EEI / OIV** con selección de la **filial OIV** (12 sectores SAIV), señalización del **doble régimen OIV (LPM) + EEI (NIS2)** y de que **DORA prevalece sobre NIS2** para las finanzas;
- **obligaciones contextualizadas** (registro, notificación de incidentes al CSIRT/ANSSI — o al **CERT Santé/ANS** en salud, ejercicio de crisis SIIV…);
- **clasificación de la información** (marcador **IGI-1300**: NP / DR / Secreto / Alto Secreto);
- **alerta RGPD art. 9** ante datos sensibles;
- **notas de valorización** del informe: documentación del riesgo TIC (**DORA art. 8**), pieza de un expediente de **homologación de seguridad** (PSSIE / RGS / IGI 1300), evaluación **ORSA** (Solvencia II) para seguros;
- cobertura **NIS2 art. 21** del marco de medidas elegido.

**IA generativa** — los riesgos emergentes de la IA generativa (deepfakes, phishing asistido por IA, fuga de datos vía «Shadow AI», inyección de prompts) figuran en los ejemplos por defecto, en todos los sectores.

> Estos elementos son **documentales y no bloqueantes**: guían y alertan, pero el analista sigue siendo libre de elegir.

---

## 🏢 Multiorganización (jerárquica)

ACRA gestiona **varias organizaciones en una sola instancia**, en **árbol**. Una instalación cubre cuatro casos de uso:

| Caso de uso | Mecanismo |
|---|---|
| **Consultora** con varios clientes | Organizaciones **raíz aisladas**; un consultor es **miembro de varias** con un rol en cada una |
| **Gran grupo** (entidad + grupo) | **Jerarquía**; el RSSI de entidad tiene vista *entidad*, el de grupo una vista **consolidada** del subárbol |
| **Empresa multisede / multipaís** | Jerarquía empresa → sedes |
| **Filiales y subfiliales** | Árbol de **profundidad arbitraria** |

Cada miembro tiene un rol **por organización** y un alcance `NODE` o `SUBTREE`. El aislamiento está centralizado: cada vista filtra por la organización **activa** (selector en la cabecera). Cuando un alcance abarca varias organizaciones, el panel/riesgos/terceros muestran la **entidad de origen** de cada elemento.

**Configuración por organización** — cada una puede tener sus escalas de ecosistema, ejemplos, marcos y opciones; sin valor **hereda** de sus ancestros. Las **escalas de riesgo** son un ajuste de instancia (superadministrador): **comunes** (modo grupo) o **por organización** (modo consultor).

**Roles** — un rol de instancia **`SUPER_ADMIN`** gestiona las organizaciones; `ADMIN` pasa a ser administrador de una organización. La primera cuenta de una instalación nueva es SUPER_ADMIN; en una instancia existente el administrador más antiguo se promueve automáticamente al primer arranque. Cada organización recibe un **logotipo generado automáticamente**.

Administración: `Admin → Organizaciones` (solo superadministrador).

---

## 🌐 Internacionalización

La interfaz está disponible en **5 idiomas**, seleccionables en cualquier momento en el perfil:

| Código | Idioma | Completitud |
|--------|--------|-------------|
| `fr` | Français | ✅ 100 % (referencia) |
| `en` | English | ✅ 100 % |
| `de` | Deutsch | ✅ 100 % |
| `es` | Español | ✅ 100 % |
| `it` | Italiano | ✅ 100 % |

Para añadir un idioma, copia `src/lib/i18n/fr.ts`, traduce todas las claves y guarda el archivo con el código ISO 639-1 correspondiente. TypeScript verifica automáticamente que todas las claves estén presentes.

---

## 👥 Roles de usuario (RBAC)

| Rol | Crear análisis | Editar | Aprobar | Admin |
|-----|:---:|:---:|:---:|:---:|
| `ADMIN` | ✅ | ✅ todos | ✅ | ✅ |
| `RSSI` (CISO) | ✅ | ✅ propios + compartidos | ✅ | ❌ |
| `RISK_MANAGER` | ✅ | ✅ propios + compartidos | ✅ | ❌ |
| `ANALYSTE` (Analista) | ✅ | ✅ propios + compartidos | ❌ | ❌ |
| `LECTEUR` (Lector) | ❌ | ❌ | ❌ | ❌ |

Los accesos también pueden concederse **análisis por análisis** (compartición puntual con cualquier usuario).

---

## 🛠️ Resolución de problemas

### La aplicación no arranca

```bash
# Comprobar el estado de los contenedores
docker compose ps

# Ver los logs detallados
docker compose logs app
docker compose logs migrator

# Comprobar que los puertos están libres
lsof -i :3000
lsof -i :5432
```

### Error de migración Prisma

```bash
# Forzar la resolución de la migración
docker compose exec app npx prisma migrate resolve --applied "nombre_migracion"
docker compose exec app npx prisma migrate deploy
```

### Problema de conexión a la base de datos

```bash
# Comprobar la conectividad
docker compose exec app npx prisma db execute --stdin <<< "SELECT 1;"

# Comprobar la variable DATABASE_URL en .env
docker compose exec app env | grep DATABASE
```

### Reiniciar completamente la aplicación

```bash
# ⚠️ Borra todos los datos
docker compose down -v
docker compose up -d
```

---

## 🤝 Contribuir

Ver [CONTRIBUTING.md](./CONTRIBUTING.md) para la guía completa.

**TL;DR:**
1. Hacer fork del repo y crear una rama `feature/mi-feature`
2. Escribir las pruebas primero (**TDD obligatorio** — ver CLAUDE.md)
3. Implementar y asegurarse de que `npm test` esté en verde
4. Añadir las traducciones en los **5 archivos i18n** si se añaden cadenas de UI
5. Ejecutar `npx tsc --noEmit` — cero errores TypeScript
6. Abrir una Pull Request con una descripción clara

---

## 📄 Licencia

MIT — ver [LICENSE](./LICENSE)

El método EBIOS RM es desarrollado y mantenido por la [ANSSI](https://cyber.gouv.fr/la-methode-ebios-risk-manager). Esta aplicación no está afiliada a la ANSSI.
