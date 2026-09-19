# ACRA — mise à jour de version stable en version stable

## La règle

Le site public **https://acra-cyber.com** n'est pas mis à jour à chaque commit.
Il reçoit une release choisie, dont l'image Docker est identifiée par son empreinte
(digest). App et migrator utilisent la même image. Aucune reconstruction sur le VPS.

`package.json` indique 1.0.0, mais cela ne vaut pas qualification : **v1.0.0 ne sera
la première stable qu'après fermeture de la [fiche de recette](RELEASE-CHECKLIST.md)**.
Une release stable est préparée en brouillon, jamais publiée automatiquement.

## Les mots utiles

| Terme | Sens |
|---|---|
| Commit / SHA | Photographie exacte du code |
| PR | Proposition de changement revue avant fusion |
| CI | Tests automatiques portant sur un commit précis |
| Tag | Nom lisible de la version, comme v1.0.0 |
| Release | Fiche de version avec changements, limites et artefact |
| Image / digest | Application construite, identifiable sans ambiguïté |
| Migration | Changement de structure de la base ; à prendre en compte pour revenir en arrière |

## Ce qui est livré

- `security.yml` : tests, types, i18n, audit dépendances, **build de production et
  E2E cyber avec PostgreSQL jetable**. Le build utilise Webpack ; la recette teste
  connexion, sauvegarde des cinq ateliers, approbation/acceptation, gel, export PDF
  et refus d'accès hors organisation, ainsi que la demande de dérogation.
- `release.yml` (« Prepare versioned release ») : refuse un SHA main sans CI réussie,
  construit une image GHCR, crée `release.json` (version, SHA, digest, empreinte des
  migrations). `v1.0.0-rc.1` devient une préversion ; `v1.0.0` reste un brouillon.
- `deploy-release.yml` (« Deploy stable demo release ») : accepte seulement une
  release publiée non préversion et un manifeste valide, installe l'image par SSH,
  effectue une recette publique en lecture, puis confirme ou tente le retour arrière.
- `docker-compose.release.yml` : overlay à ajouter **après** base et demo ; retire
  les builds et le script de récupération automatique des migrations. Le migrator
  exécute uniquement `prisma migrate deploy`. Volume persistant pour les documents.
- `scripts/deploy-release.sh` : sauvegarde base/documents, maintenance courte,
  migration, santé avec contrôle version/SHA ; aucune utilisation de `git pull`.

Ces mécanismes sont versionnés ; leur présence ne signifie pas qu'un déploiement
OVH ou une première stable a déjà été validé. Voir le rapport de qualification.

## Mise en place, une seule fois

Cible confirmée : `debian@vps-8eb84369.vps.ovh.net`, SSH port 22. Le répertoire
`DEPLOY_PATH=/home/debian/acra` est confirmé par inspection du VPS. Installer le dépôt et les
scripts de cette livraison à cet emplacement, Docker Compose >= 2.24.4, `.env`
protégé (mode 600), DNS/Caddy et accès en lecture à GHCR si l'image est privée.

Dans GitHub, créer les environnements `release` et `demo`. Restreindre leur usage
à main et activer la revue de déploiement si disponible. Dans `demo` :

| Paramètre | Type | Contenu |
|---|---|---|
| DEPLOY_PATH | Variable | Chemin absolu du dépôt sur le VPS, sans espaces |
| SSH_PRIVATE_KEY | Secret | Clé dédiée autorisée pour debian |
| SSH_KNOWN_HOSTS | Secret | Entrée d'hôte vérifiée par un canal de confiance ; pas d'acceptation aveugle |
| SMOKE_EMAIL / SMOKE_PASSWORD | Secrets | Compte dédié, vérifié, lecture seule d'une analyse fictive exportable, sans défi interactif |

L'utilisateur SSH doit pouvoir utiliser Docker. Une seule planification doit être
active (sidecars ou tâches GitHub). Ne pas publier 3000/5432. Configurer dans `.env`
`DEMO_DOMAIN=acra-cyber.com`, `NEXTAUTH_URL=https://acra-cyber.com`,
`NEXT_PUBLIC_BASE_URL=https://acra-cyber.com`, `ACRA_DEMO_MODE=true`, les secrets DB,
NextAuth, chiffrement et cron. SMTP : `smtp.mail.ovh.net` et `ssl0.ovh.net` sont valables (confirmation utilisateur).
Le VPS conserve `ssl0.ovh.net:587` ; authentification TLS également testée avec
succès sur `smtp.mail.ovh.net:587` le 19 septembre 2026. Saisir les
paramètres du compte OVH dans Admin/SMTP et tester l'envoi réel. Aucun secret SMTP
ne doit être collé dans un commit ou une conversation.

## Première installation et premier administrateur

Une base existante estampillée PROD ne doit pas être convertie en DEMO. Employer
une instance/base dédiée ; vérifier le mode avant tout seed. L'outil de mise à jour
refuse une application existante sans manifeste de release : sauvegarder ses
fichiers et sa base, puis qualifier sa reprise manuellement avant de l'adopter.
Cela évite de perdre des documents conservés dans un ancien conteneur sans volume.

Sur une installation neuve, installer/recetter l'image en accès privé, créer
l'exploitant avec `node scripts/create-admin.mjs <email> SUPER_ADMIN` dans le
conteneur. Le mot de passe est demandé masqué. Configurer SMTP, créer les comptes
fictifs et le compte de recette, tester le mode démo, la purge et la restauration.
Le premier administrateur n'est **jamais** créé par `/auth/register`.

Pour cette première version, la recette de l'image et l'amorçage précèdent la
publication de la stable et le lancement de la mise à jour publique. Ne pas
faire de la publication publique le premier essai du système.

## Tes gestes pour une mise à jour

1. Fusionner la PR et attendre la CI verte sur le commit final de main.
2. Actions → **Prepare versioned release** → saisir la version.
3. Recetter l'image exacte du manifeste en privé ; remplir la fiche de release.
   Pour une stable, publier le brouillon seulement si les critères sont satisfaits.
4. Actions → **Deploy stable demo release** → saisir `v1.0.1`, par exemple.
5. Lire le résultat. La recette vérifie HTTPS, DB, version/SHA, connexion, lecture
   d'une analyse et génération d'un vrai PDF. Aucun seed n'est exécuté en public.

Les releases immuables sont recommandées : [documentation GitHub](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases).
La recette publique exige un compte de test opérationnel ; elle échoue si les
secrets sont absents, si MFA interactif empêche la connexion ou si aucune analyse
fictive n'est accessible.

## Sauvegarde et retour arrière

Le serveur conserve `.release-state/current`, `previous`, `pending` et les dumps
horodatés dans `.release-state/backups/`. La base et les documents sont sauvegardés
avant migration. **Copier ces sauvegardes hors VPS et tester leur restauration** ;
un fichier gzip valide ne prouve pas à lui seul une restauration correcte.

Si la recette échoue, le job reste rouge. Le script ne réutilise l'image précédente
que lorsque l'empreinte des migrations est identique. Sinon, ou à la première
installation sans précédente stable, il arrête l'application et demande une
restauration maîtrisée. Il ne restaure jamais automatiquement la base : cela
pourrait écraser des données. Garder l'application arrêtée, restaurer le dump et
les documents dans un environnement séparé, vérifier puis basculer sous maintenance.

Ne pas utiliser `docker compose down -v`, ni réinitialiser la base, pour corriger
un déploiement. Prévoir une fenêtre de maintenance : l'application est arrêtée
pendant la sauvegarde et les migrations, les planificateurs ne reprennent qu'après
recette réussie.

## Avant CLUSIR

Garder la même version entre la répétition et mercredi 23 septembre. Le conducteur
cyber/conformité est dans `docs/demo/CLUSIR-2026-09-23-conducteur-application.md`.
Si l'accès VPS, SMTP, restauration ou recette reste non qualifié, conserver une
présentation privée ; ne pas nommer une version « stable » uniquement pour tenir
la date de dimanche.
