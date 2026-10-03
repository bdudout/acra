// ─── Consignes de restitution pour l'assistant IA qui consomme les outils de connaissance (PUR) ───
// Constat du comparatif « assistant avec ACRA / assistant seul » : appuyé sur le catalogue, l'assistant creuse moins
// les vecteurs techniques et recopie parfois les identifiants internes. Ces consignes accompagnent les réponses des
// outils de connaissance ; elles ne changent aucune donnée.

export const ASSISTANT_GUIDANCE =
  'Ces éléments sont un socle vérifié à adapter au contexte, pas une liste exhaustive. Pour un livrable d’expert : ' +
  '(1) complétez par la chaîne d’attaque détaillée (techniques MITRE ATT&CK — champ `attack` des actions élémentaires) ' +
  'et par les vecteurs techniques propres au contexte (formats de fichiers et analyseurs, API, accès d’administration et de support, sauvegardes) ; ' +
  '(2) couvrez tout l’écosystème : prestataires et leurs sous-traitants, personnes concernées, autorités ; ' +
  '(3) gardez les références citées telles quelles et marquez « à vérifier » ce qui ne vient pas de l’outil ; ' +
  '(4) restituez des libellés lisibles, sans identifiants internes (clés de catalogue) dans un livrable destiné à un humain ; ' +
  '(5) distinguez la vision MÉTIER (secteur, sous-secteurs : que fait l’organisation ?) de la vision TECHNIQUE (patterns d’architecture : exposition sur Internet, DMZ, interconnexions, télémaintenance, administration… ' +
  'comment le système est-il construit ?) : les deux se combinent, demandez ou déduisez les patterns du système étudié.'
