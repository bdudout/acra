// ─── Consignes du serveur MCP (PUR) ───────────────────────────────────────────
// Renvoyées à `initialize` : la même démarche s'applique quel que soit le client (Claude, Codex, Mistral Vibe…).
// Elles décrivent comment utiliser ACRA ; elles ne donnent aucun droit et ne changent aucune donnée.

export const MCP_INSTRUCTIONS = [
  'ACRA est une application de gestion des risques (EBIOS RM, ISO/IEC 27005, ISO 31000, projets 360, GRC).',
  'Démarche : (1) LIRE le contexte avec les outils read_* ; (2) demander les RECOMMANDATIONS calculées par ACRA (recommend_*) plutôt que d’inventer ;',
  '(3) PROPOSER avec les outils propose_* : chaque proposition est mise en attente et validée par un humain dans ACRA, rien n’est écrit directement.',
  'Créations (ancrées à l’organisation de la clé) : propose_projet360 (projet), propose_nouvelle_analyse (analyse rédigée d’après une expression de besoins ou reprise d’une analyse existante ; vérifiez d’abord le paquet avec analyse_import_preview), propose_pssi (PSSI → référentiel de mesures, document et suivi de conformité).',
  'Les cotations suivent l’échelle de l’organisation : reprenez celles des outils, n’en inventez pas. Rattachez chaque proposition à un objet existant (analyse, risque, contrôle…).',
  'Citez les références (réglementations, normes) telles qu’ACRA les donne et marquez « à vérifier » ce qui ne vient pas d’ACRA. Répondez dans la langue de l’utilisateur.',
].join(' ')
