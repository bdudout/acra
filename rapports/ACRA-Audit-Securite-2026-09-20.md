# ACRA — Audit sécurité SAST / DAST

**Date :** 20 septembre 2026  
**Version auditée :** `v1.0.0` — révision `eea0fe4`  
**Référentiels :** OWASP ASVS/WSTG, OWASP Top 10 2021, CWE Top 25

## Résumé exécutif

La revue a couvert 152 routes API, les flux d’authentification, la séparation
multi-organisation, les exports, les intégrations sortantes, les en-têtes HTTP
et les dépendances de production. La qualification VPS a répondu correctement
sur `/` et `/api/health`, avec CSP, HSTS, protections anti-clickjacking et
`nosniff` actives.

Un constat **moyen** a été confirmé puis corrigé avant publication. Aucun constat
critique ou élevé n’a été confirmé dans les contrôles menés à ce stade.

| Sévérité | Ouverts | Corrigés |
|---|---:|---:|
| Critique | 0 | 0 |
| Élevée | 0 | 0 |
| Moyenne | 0 | 1 |
| Faible / amélioration | 2 | 0 |

## Constat F-01 — Contournement possible de la limite par IP

**Sévérité initiale :** moyenne — CVSS 5.3  
**CWE :** CWE-290, CWE-307  
**OWASP :** A07 Identification and Authentication Failures

Les flux d’inscription et de connexion prenaient la première adresse de
`X-Forwarded-For`. Cette valeur peut être fournie par le client avant que Caddy
ajoute le saut réseau réel. Un attaquant pouvait donc faire varier cette valeur
pour réduire l’efficacité de la limite par IP et polluer les journaux.

**Correctif appliqué :** les limites et la journalisation utilisent désormais le
dernier saut de la liste, ajouté par le reverse proxy. Tests unitaires ajoutés.

## Contrôles confirmés

- **Isolation / IDOR :** revue de code des clauses d’accès, puis test dynamique
  sur qualification avec deux comptes et organisations temporaires. Le compte B
  a reçu `404` pour la lecture, la modification et l’export d’une analyse privée
  du compte A; elle n’apparaissait pas dans sa liste. Les comptes et données de
  test ont été supprimés en fin de contrôle.
- **Réinitialisation de mot de passe :** jeton de 256 bits, SHA-256 stocké,
  expiration d’une heure, consommation atomique, invalidation des jetons
  précédents et réponse non énumérable.
- **SSRF :** les webhooks exigent HTTPS, refusent les adresses internes, résolvent
  les DNS avant émission et ne suivent pas les redirections.
- **Injection :** aucune requête SQL brute, exécution système ou interpolation
  HTML non maîtrisée confirmée dans les chemins applicatifs inspectés.
- **IA :** le endpoint historique de suggestion répond 404 et aucune clé ou API
  IA externe n’est appelée par défaut.

## Améliorations à planifier

1. Ajouter un store de rate-limit partagé (Redis) avant un passage multi-instance.
2. Ajouter ces scénarios e2e à deux comptes démo à la CI, et les étendre aux
   ressources organisationnelles autres que les analyses et leurs exports.
3. Encadrer le endpoint SIEM interne par une allowlist réseau lorsqu’il n’est pas
   réservé à une administration de confiance.

## Limites

Le DAST a été non destructif et exécuté sur la qualification. Les tests ne
comprennent pas de déni de service, de scan agressif ni de tentative d’accès aux
ressources d’un tiers réel. `npm audit` local n’a pas pu joindre le registre ; la
CI GitHub a exécuté son audit de dépendances avec succès.
