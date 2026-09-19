# ACRA ouvre sa démo : analyser les risques cyber sans perdre la maîtrise de ses données

Je mets aujourd’hui ACRA à disposition en démo sur [acra-cyber.com](https://acra-cyber.com/).

ACRA est une application d’analyse de risques cyber guidée par la méthode EBIOS Risk Manager. Son objectif est simple : aider les équipes métiers, sécurité et risques à construire ensemble une analyse traçable, compréhensible et exploitable.

La démo permet de créer son propre espace isolé, puis de parcourir les cinq ateliers EBIOS RM : cadrage, sources de risque, écosystème, scénarios et traitement. Elle inclut aussi le socle de conformité, les référentiels et PSSI, les documents, les dérogations et les plans d’action.

Les données de chaque testeur restent dans son organisation de démonstration. Les comptes sont vérifiés par e-mail, la récupération du mot de passe est autonome et les protections contre les tentatives répétées sont actives.

Je cherche maintenant des retours concrets : ce qui aide à animer un atelier, ce qui manque pour passer d’une analyse à un plan d’action, ce qui est trop complexe, et ce qui doit être mieux expliqué. Les remarques de RSSI, métiers, DPO, auditeurs, consultants et étudiants sont les bienvenues.

## Quelle place pour l’IA ?

Le choix actuel est volontaire : ACRA ne transmet pas les données à une IA externe par défaut. Une analyse de risques peut contenir des informations sur les actifs critiques, les faiblesses, les scénarios d’attaque ou les tiers. Avant d’automatiser quoi que ce soit, il faut savoir où vont ces données, qui peut les lire et sous quel contrôle elles sont conservées.

Pour autant, l’IA peut être utile. Elle peut aider à préparer un atelier, reformuler une mesure, proposer des questions de clarification, structurer une synthèse ou vérifier la complétude d’un dossier. La bonne approche me semble être une IA **optionnelle et gouvernée** : activation explicite par organisation, fournisseur et localisation maîtrisés, journalisation, périmètre de données minimal, et validation humaine systématique.

Une piste intéressante consiste à exposer une API ACRA compatible MCP. Codex, Cowork, OpenClaw ou un orchestrateur interne pourraient alors agir comme des utilisateurs techniques : ils s’authentifient, ne voient que l’organisation autorisée et n’exécutent que les actions permises par leur rôle. C’est déjà l’esprit des tests fonctionnels : l’agent n’a pas un accès direct à la base, il utilise l’application à travers ses contrôles.

Ce modèle ne supprime pas le risque. Il le rend visible et gouvernable : identité de l’agent, droits limités, trace d’audit, révocation, et aucune délégation aveugle de décision. L’IA assisterait le travail ; elle ne déciderait pas du risque à la place des responsables.

La démo est ouverte : [acra-cyber.com](https://acra-cyber.com/). Vos retours orienteront les prochaines évolutions.

#cybersecurite #EBIOSRM #gestiondesrisques #GRC #RSSI #conformite #IA #MCP
