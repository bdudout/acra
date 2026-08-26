# Webhooks sortants

Notification d'événements de l'organisation vers un SI tiers (SOAR, SIEM, ITSM, ETL…).
Complète l'API publique v1 (lecture + import en masse) pour l'**interopérabilité**.

## Configuration (ADMIN)

`/configuration` → section **Webhooks** (visible `isAdmin`). Un webhook =
`{ nom, url (https), events[], actif }`. Le **secret de signature** est généré à la
création et affiché **une seule fois** (jamais re-consultable ensuite).

API : `GET|POST /api/config/webhooks`, `PATCH|DELETE /api/config/webhooks/[id]`
(gardés `isAdminRole`, portés à l'organisation active).

## Événements

`risk.created`, `risk.updated`, `incident.declared`, `incident.updated`,
`control.executed`, `control.anomaly`, `analyse.approved`. Un webhook abonné à
`"*"` reçoit tous les événements. Vocabulaire dans `WEBHOOK_EVENTS` (`lib/webhook.ts`).

Points d'émission câblés : `risk.created` (création manuelle + import API),
`incident.declared`. Ajouter un point = `emitWebhookEvent(orgId, event, data)`
(best-effort, ne casse jamais l'action métier).

## Corps & signature

`POST` JSON vers l'URL : `{ event, organizationId, data, emittedAt }`.
En-tête `X-ACRA-Signature` = `HMAC-SHA256(secret, corps_brut)` en hex. Le
consommateur recalcule le HMAC sur le corps brut reçu et compare (constant-time).

## Livraison & ré-essais

File `WebhookDelivery` (statut `EN_ATTENTE|LIVRE|ECHEC`). Le cron
`POST /api/cron/webhooks-dispatch` (auth `Bearer CRON_SECRET`, cf.
`lib/cron-auth.ts`) traite les livraisons dues : POST signé, timeout 10 s,
`redirect: manual`. Backoff exponentiel (base 30 s, plafond 6 h), abandon après
`WEBHOOK_MAX_ATTEMPTS` (6) tentatives → `ECHEC`. Planifié à chaque tick du
`scheduler.sh`.

## Garde SSRF

`isSafeWebhookUrl` (pur, testé) impose **https** et refuse loopback / IP privées
(10/8, 172.16/12, 192.168/16), link-local / metadata (169.254/16), `localhost`,
IPv6 ULA/link-local. Vérifié à la **création** ET à l'**envoi** (une URL posée
avant durcissement est re-contrôlée). Limite connue : rebinding DNS (durcir par
résolution + contrôle de l'IP résolue si le besoin apparaît).

## Cœur pur (testé, `lib/webhook.ts`)

`cleanWebhookEvents`, `signWebhookPayload`, `webhookSubscribers`,
`nextBackoffDelayMs`, `resolveDeliveryUpdate`, `isSafeWebhookUrl`. La couche
serveur (`lib/webhook.server.ts`) n'orchestre que la persistance et le `fetch`.
