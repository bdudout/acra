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
		lb_policy round_robin
		# Réplica indisponible à la connexion : nouvel essai sur un autre pendant 5 s au plus.
		# Une requête déjà transmise n'est rejouée que pour GET (défaut de Caddy) : pas de double écriture.
		lb_try_duration 5s
		lb_try_interval 250ms

		# Contrôle de santé ACTIF : /api/health répond 503 si la base est injoignable ou le schéma en retard.
		health_uri /api/health
		health_interval 10s
		health_timeout 5s
		health_status 200

		# Contrôle PASSIF : un réplica injoignable est écarté 30 s. Volontairement PAS de « unhealthy_status 503 » :
		# l'application répond 503 sur certaines routes pour une raison de configuration commune à tous les
		# réplicas (ex. /api/cron sans CRON_SECRET), ce qui les écarterait tous. Le contrôle passif complète le
		# contrôle actif, dont la prise en charge avec des upstreams « dynamic » dépend de la version de Caddy
		# (à vérifier à la recette, cf. docs/deploiement-haute-disponibilite.md).
		fail_duration 30s
	}

	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options "nosniff"
		-Server
	}
}
