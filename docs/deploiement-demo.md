# Déploiement d'ACRA-Demo sur un VPS OVH (Docker Compose + Caddy)

Guide pas-à-pas pour mettre en ligne le **site de démonstration** ACRA, avec HTTPS
automatique (Caddy) et purge planifiée. Le mode démo est isolé du code de production
par la variable `ACRA_DEMO_MODE` + un marqueur d'instance figé : une instance de prod
ne peut jamais devenir une démo.

---

## 1. Serveur et DNS

1. **VPS OVH** (Debian 12/13 ou Ubuntu 22.04/24.04, 2 vCPU / 4 Go RAM suffisent).
2. **DNS** : créez un enregistrement **A** `demo.votredomaine.fr` → IP du VPS.
3. **Pare-feu** : ouvrez `80/tcp` et `443/tcp` (Caddy). Ne publiez PAS `3000`
   (l'app n'est atteignable que via Caddy — voir §5).

```bash
# Sur le VPS (Debian ou Ubuntu) — Docker + plugin compose (le script get.docker.com gère les deux)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"   # puis reconnectez-vous
docker compose version            # doit être >= 2.24 (pour `!reset`)
```

> Si `docker compose version` < 2.24, voir §5 (repli sans `!reset`).

---

## 2. Récupérer le code

```bash
git clone https://github.com/bdudout/acra.git
cd acra
```

---

## 3. Configurer `.env`

```bash
./scripts/setup.sh        # génère les secrets (POSTGRES, NEXTAUTH_SECRET, …)
```

Puis éditez `.env` et renseignez le **bloc démo** :

```dotenv
# Domaine public (HTTPS servi par Caddy)
DEMO_DOMAIN=demo.votredomaine.fr
ACME_EMAIL=admin@votredomaine.fr
NEXTAUTH_URL=https://demo.votredomaine.fr
NEXT_PUBLIC_BASE_URL=https://demo.votredomaine.fr

# Mode démo
ACRA_DEMO_MODE=true
ACRA_DEMO_CONTACT_URL=mailto:contact@votredomaine.fr

# Requis en démo : jeton du cron de purge (généré par setup.sh, sinon :
# openssl rand -base64 32)
CRON_SECRET=<valeur_aléatoire>
```

> `DATABASE_URL` doit pointer sur `@db:5432` (service Docker). `setup.sh` s'en charge.

---

## 4. Démarrer la pile

```bash
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --build
```

Ordre automatique : `db` (santé) → `migrator` (applique les migrations, puis sort) →
`app` (Next.js standalone) → `caddy` (obtient le certificat TLS) + `cron`.

```bash
docker compose logs -f app     # suivre le démarrage
docker compose logs -f caddy   # vérifier l'obtention du certificat
```

Au **premier démarrage sur une base vierge**, l'instance se stampe automatiquement
`DEMO` (marqueur figé). Vérifiez :

```bash
curl -s https://demo.votredomaine.fr/api/health
```

---

## 5. Sécurité réseau (port 3000)

Le fichier `docker-compose.demo.yml` retire la publication du port `3000` via
`ports: !reset []` — l'app n'est joignable que par Caddy sur le réseau interne.

- **Compose < 2.24** (pas de `!reset`) : le port 3000 reste publié. Bloquez-le au
  pare-feu OVH, ou éditez le `docker-compose.yml` de base pour lier `127.0.0.1:3000:3000`.

---

## 6. Premier compte : amorçage local obligatoire

Même en démo, aucune inscription publique ne crée le premier administrateur.
Depuis le VPS, après migration et démarrage de l'application :

```bash
docker compose -f docker-compose.yml -f docker-compose.demo.yml exec app node scripts/create-admin.mjs admin@votredomaine.fr SUPER_ADMIN
```

Le mot de passe est demandé de façon masquée ; ne pas le mettre en argument.
Se connecter, configurer SMTP dans Admin et envoyer un message de test. Les
inscrits suivants reçoivent une organisation isolée et doivent vérifier leur e-mail.

Configuration de cette démo : domaine `acra-cyber.com`, VPS
`vps-8eb84369.vps.ovh.net`, utilisateur SSH `debian`, port `22`, SMTP
`smtp.mail.ovh.net` (valeurs communiquées par l'exploitant). Les identifiants SMTP
et les secrets d'application restent dans l'instance ; aucun secret dans GitHub
hors secrets dédiés au déploiement et à la recette.

---

## 7. Purge planifiée

Le service `cron` du compose appelle `POST /api/cron/demo-purge` toutes les heures
(en interne, avec `CRON_SECRET`) : préavis par e-mail aux organisations proches de
l'expiration, puis suppression des organisations expirées. Intervalle réglable via
`CRON_INTERVAL` (secondes) dans `.env`.

Vérifier :

```bash
docker compose logs -f cron
```

---

## 8. Exploitation

Pour la première démo publique, suivre le [plan de versions stables](VERSIONS-STABLES-DEMO.md)
et fermer les points bloquants de l'[audit](AUDIT-CYBER-CONFORMITE-2026-09-18.md).
La commande `git pull` ci-dessous est la procédure historique de reconstruction :
elle ne garantit pas une version qualifiée. Les workflows de release et de déploiement d’image figée sont désormais versionnés ;
leur qualification sur OVH reste nécessaire avant la première stable.

```bash
# Mise à jour (nouveau code)
git pull
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --build

# Sauvegarde ponctuelle de la base
docker compose run --rm backup

# Arrêt
docker compose -f docker-compose.yml -f docker-compose.demo.yml down
```

---

## Récapitulatif des variables démo (`.env`)

| Variable | Rôle |
|---|---|
| `ACRA_DEMO_MODE=true` | Active le mode démo (interrupteur maître) |
| `CRON_SECRET` | Protège `/api/cron/demo-purge` (requis) |
| `ACRA_DEMO_CONTACT_URL` | Cible du bouton « Déployer dans mon SI » |
| `DEMO_DOMAIN` | Domaine public (certificat Caddy) |
| `ACME_EMAIL` | Contact Let's Encrypt |
| `NEXTAUTH_URL` / `NEXT_PUBLIC_BASE_URL` | `https://<DEMO_DOMAIN>` |
| `CRON_INTERVAL` | Période de purge en secondes (défaut 3600) |
