# ACRA — Contre-audit sécurité

**Date :** 20 septembre 2026  
**Objet :** vérification du correctif F-01 et de la version prête à publier.

## Résultat

Le correctif F-01 est effectif : `getClientIp` sélectionne le dernier saut
`X-Forwarded-For`, soit l’adresse ajoutée par Caddy, et non la valeur initiale
injectable par le client. L’inscription et la connexion utilisent cette même
règle pour leurs limites par IP.

Les tests unitaires dédiés sont verts, de même que TypeScript et la vérification
i18n. La qualification VPS tourne sur la révision `eea0fe4`, sa migration Prisma
est appliquée, son health-check est vert et aucune erreur Prisma récente n’a été
observée dans les journaux.

| Point contrôlé | Résultat |
|---|---|
| F-01, IP client injectée en tête de XFF | Corrigé |
| Réinitialisation de mot de passe | Conforme au contrôle attendu |
| En-têtes CSP / HSTS / anti-frame | Présents |
| IDOR à deux comptes distincts (lecture, modification, export, liste) | Bloqué : réponses 404 et liste isolée |
| Image et schéma qualification | Alignés |

**Verdict :** pas de vulnérabilité critique, élevée ou moyenne ouverte parmi les
constats vérifiés. Les trois améliorations de l’audit principal restent à
planifier après la démo.
