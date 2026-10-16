# Caddy — frontal du profil « ha » (docker-compose.ha.yml) : TLS automatique, répartition de charge
# entre les réplicas de l'application et contrôle de santé. Domaine et e-mail ACME : variables d'environnement.

{
	email {$ACME_EMAIL}
}

{$DOMAIN} {
	encode gzip zstd

	# Documents jusqu'à 25 Mo (+ enveloppe multipart), cohérent avec proxyClientMaxBodySize (next.config.js).
	request_body {
		max_size 26MB
	}

	reverse_proxy {
		# Réplicas découverts par DNS (Docker renvoie une adresse par réplica du service « app »).
		dynamic a {
			name app
			port 3000
			refresh 10s
		}
		# Affinité par cookie (« acra_lb », HMAC de l'adresse du réplica, sans donnée personnelle) : pendant une mise à
		# jour progressive (scripts/update-ha.sh), un navigateur reste sur le MÊME réplica, donc sur une seule version
		# (pages, ressources /_next/static et Server Functions cohérentes). Réplica retiré ou malade : un autre est choisi
		# (politique de repli, aléatoire par défaut) et l'identifiant de déploiement (NEXT_DEPLOYMENT_ID) provoque un
		# rechargement complet de la page au lieu d'une navigation incohérente.
		lb_policy cookie acra_lb
		# Réplica indisponible à la connexion : nouvel essai sur un autre pendant 5 s au plus.
		# Une requête déjà transmise n'est rejouée que pour GET (défaut de Caddy) : pas de double écriture.
		lb_try_duration 5s
		lb_try_interval 250ms

		# Contrôle de santé ACTIF : /api/health répond 503 si la base est injoignable, le schéma en retard ou le réplica
		# en cours de DRAINAGE (fichier /tmp/acra-drain posé par scripts/update-ha.sh avant l'arrêt du réplica).
		# Intervalle court : le script attend ACRA_HA_DRAIN_SECONDS (12 s) avant d'arrêter un réplica drainé.
		health_uri /api/health
		health_interval 5s
		health_timeout 5s
		health_status 200

		# Contrôle PASSIF : un réplica injoignable est écarté 30 s. Volontairement PAS de « unhealthy_status 503 » :
		# l'application répond 503 sur certaines routes pour une raison de configuration commune à tous les
		# réplicas (ex. /api/cron sans CRON_SECRET), ce qui les écarterait tous. Le contrôle passif complète le
		# contrôle actif, dont la prise en charge avec des upstreams « dynamic » dépend de la version de Caddy
		# (à vérifier à la recette, cf. docs/deploiement-haute-disponibilite.md).
		fail_duration 30s
	}

	# Cache : aucune mise en cache par Caddy. Next.js sert /_next/static/* avec « public, max-age=31536000, immutable »
	# (noms de fichiers à empreinte de contenu, + ?dpl=<déploiement>) et les API avec « no-store » (next.config.js) :
	# ne pas surcharger Cache-Control ici, sous peine de mettre en cache une 404 d'une ressource d'une autre version.
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options "nosniff"
		-Server
	}
}
