# Qualification de la release cyber/conformité

Cette fiche est un modèle : une case non renseignée ne constitue pas une preuve.
Avant de publier une stable, remplir les résultats sur l'image exacte du manifeste joint.

- [ ] CI du commit exact : tests, TS, i18n, audit dépendances, build et E2E.
- [ ] Image exacte du manifeste : démarrage, connexion, cinq ateliers, approbation/acceptation, gel et PDF.
- [ ] Deux organisations et utilisateur sans appartenance : aucun accès croisé.
- [ ] Installation vierge et mise à jour depuis la version précédente.
- [ ] Sauvegarde base + documents, restauration et retour arrière éprouvés sur base dédiée.
- [ ] SMTP OVH : envoi réel, OTP reçu et connexion vérifiée ; purge testée sur org fictive.
- [ ] Domaine acra-cyber.com : HTTPS et seuls ports 80/443 exposés.
- [ ] Comptes de démonstration à secrets distincts ; exploitant amorcé par CLI.
- [ ] GRC désactivée ; scénario Novera répété ; PDF de secours disponible.

Renseigner : SHA, digest d'image, date, testeur, résultats, réserves, lien CI et sauvegarde de recette.
Une migration non rétrocompatible interdit le retour automatique à la seule image précédente.
