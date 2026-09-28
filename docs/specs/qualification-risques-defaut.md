# Expression de besoins — Qualification d’analyse et risques proposés

## Objectif

Toute nouvelle analyse, quelle que soit sa méthode (EBIOS RM, ISO/IEC 27005,
ISO 31000 ou NIST SP 800-30), bénéficie par défaut d’un questionnaire de
qualification. Ses réponses permettent de proposer un sous-ensemble explicite
de risques préconfigurés. L’utilisateur reste décisionnaire : aucun risque ne
doit être créé sans voir son intitulé, sa justification et sa cotation.

## Parcours utilisateur

1. À l’ouverture d’une analyse, le questionnaire de qualification cyber est
   affiché. Il est activé par défaut pour toute organisation et toute méthode.
2. L’utilisateur répond puis valide. Le système enregistre les réponses et
   évalue les règles de risque de l’organisation.
3. Une fenêtre de proposition présente chaque risque correspondant : origine
   (question/réponse), intitulé, description, gravité, vraisemblance, traitement
   et catégorie par défaut. Chaque risque peut être décoché avant import.
4. La confirmation crée uniquement les risques cochés dans le registre de
   l’analyse, puis un bilan donne les créations et les exclusions. Les risques
   demeurent accessibles et modifiables dans le registre comme tout autre risque.
5. Une nouvelle validation ne recrée pas un risque déjà proposé/importé pour la
   même règle : l’opération est idempotente au niveau analyse + règle.

## Configuration et gouvernance

- L’ADMIN de l’organisation gère un catalogue de règles : condition
  `questionId = réponse`, risque proposé, catégorie (cyber, projet,
  opérationnel, fraude), titre, description, gravité, vraisemblance, stratégie
  et état actif.
- Le catalogue et les questions sont hérités dans l’arbre d’organisations via
  `getOrgConfig`; aucune organisation ne peut lire ou modifier le catalogue d’une
  autre organisation.
- Le socle cyber est fourni par défaut. Des questions supplémentaires sont
  activables par catégorie (projet, opérationnel, fraude) et des questions/règles
  personnalisées peuvent être ajoutées progressivement.
- Les paramètres par défaut ne masquent jamais la cotation : ils sont affichés
  dans la proposition et restent éditables avant création ainsi qu’après.

## Règles métier et sécurité

- Les réponses, règles et créations sont contrôlées côté serveur dans le
  périmètre de l’analyse et avec les droits de création de risque existants.
- Une règle invalide, désactivée, ou dont la question n’est pas active est
  ignorée; elle ne bloque pas les autres propositions.
- L’import est atomique pour les risques effectivement sélectionnés. Une erreur
  ne crée aucun sous-ensemble silencieux.
- Les interfaces et explications existent en français, anglais, allemand,
  espagnol et italien.

## Critères d’acceptation

- La qualification est active par défaut pour une organisation sans configuration
  explicite et pour les nouvelles lignes de configuration.
- Une réponse cyber éligible ouvre la proposition; l’utilisateur peut accepter
  un sous-ensemble et retrouve les risques créés dans son analyse.
- Un ADMIN peut modifier les règles, leurs cotations et activer des extensions
  projet, opérationnel et fraude sans migration de code.
- Les tests couvrent : moteur de règles pur, isolation d’organisation, API,
  écran de proposition et absence de doublon; la recette E2E couvre validation,
  sélection, création et consultation.
