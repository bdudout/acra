# Réinitialisation de mot de passe

La politique de mot de passe de l'instance permet au SUPER_ADMIN de choisir le
mode de récupération : `ADMIN` (mot de passe temporaire délivré depuis la
gestion des utilisateurs) ou `EMAIL` (lien autonome). Une instance de démo
force le mode `EMAIL`, afin que chaque testeur puisse récupérer son accès sans
intervention humaine.

`POST /api/auth/forgot-password` répond toujours avec le même succès, qu'un
compte existe ou non. Il est limité à trois demandes par adresse et par quinze
minutes. Le lien contient un secret aléatoire de 256 bits ; seul son SHA-256 est
conservé en base. Il expire après une heure, ne peut être consommé qu'une fois,
et l'émission d'un nouveau lien invalide les précédents.

`POST /api/auth/reset-password` applique la politique de mot de passe, consomme
le jeton de façon atomique et invalide les autres jetons ouverts du compte. Les
événements de demande et de consommation sont consignés dans le journal d'audit
et peuvent être exportés vers le SIEM.

La connexion signale désormais le temps restant en cas de verrouillage. La
durée et le seuil restent configurables dans la politique de mot de passe ; le
défaut est de cinq tentatives puis quinze minutes de verrouillage.
