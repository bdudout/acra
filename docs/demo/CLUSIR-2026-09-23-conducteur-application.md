# Conducteur applicatif — CLUSIR 23 septembre 2026

Périmètre : cyber et conformité uniquement. Cas fictif Novera Services, altération
de factures par compromission des accès privilégiés du prestataire Orion Admin.

## Préparation

Sur une instance **dédiée**, déjà marquée DEMO : définir `ACRA_DEMO_MODE=true`,
`ACRA_SEED_CONFIRM=DEMO_ONLY` et trois secrets distincts d'au moins 16 caractères :
`ACRA_SEED_ANALYSTE_PASSWORD`, `ACRA_SEED_RSSI_PASSWORD`,
`ACRA_SEED_DIRECTION_PASSWORD`. Les fournir par l'environnement, jamais dans les
supports, arguments ou journaux. Puis `npx tsx prisma/seed-demo-clusir.ts`.
Le script ne crée aucun super-admin. Il prépare trois comptes métier, active
acceptation/dérogations et impose les modules GRC hors périmètre à FORCE_OFF.
Ne pas l'utiliser sur une instance hébergeant d'autres travaux : il remplace le
cas de démonstration et la politique de modules de l'instance dédiée.

Préparer trois sessions : analyste, RSSI, direction métier. L'exploitant reste hors
présentation. Générer le PDF et conserver les captures localement avant la séance.
Le seed réinitialise l'analyse à SOUMIS ; répéter sans valider ou réinjecter ensuite.

## Déroulé — 15 minutes

| Temps | Écran | Message et preuve |
|---|---|---|
| 0–2 min | Atelier 1, facturation, biens supports, événement redouté | Impact métier avant le détail technique |
| 2–6 min | Ateliers 2 → 3 → 4, dans cet ordre | Cybercriminel, accès Orion Admin, chemin d'attaque, scénario concret |
| 6–9 min | Atelier 5 | Risque initial, cible conditionnelle, trois mesures avec responsables et échéances ; l'estimation à date n'est pas une preuve d'efficacité |
| 9–11 min | Conformité de l'organisation, PSSI-NOVERA | Exigence PSSI-ACC-01, écart MFA, justification et traitement ; un traitement n'est pas une conformité acquise |
| 11–13 min | Session RSSI puis direction métier | Approbation de l'analyse distincte de l'acceptation du risque ; décision datée et gel |
| 13–15 min | Synthèse et PDF pré-généré | Retrouver le périmètre, le décideur, le risque et les actions dans six mois |

À chaque écran : partir du haut, faire défiler lentement jusqu'à la preuve, marquer
une pause. En mode régie, attendre « suivant » / « continue » du présentateur.
Ne pas modifier de configuration pendant la séance. Aucun écran de contrôle
permanent, audit interne, RCSA, perte, incident opérationnel ou administration.

Dire : ACRA structure la décision cyber et ses preuves. Ne pas annoncer une
certification ISO, une conformité réglementaire automatique, un SOC ou un PRA.
Si un écran bloque, passer à sa capture ou au PDF. Durée cible 10–15 minutes.
Les diapositives qui présentaient contrôle permanent ou super-administration
restent à aligner sur ce conducteur avant la répétition finale.
