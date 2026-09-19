# Spec — API publique v1 (accès machine)

> Contrat fonctionnel de l'API REST publique. La spécification OpenAPI servie par
> l'instance (`GET /api/v1/openapi.json`) est la référence d'intégration à jour ;
> ce document apporte le contexte, les exemples et les limites d'usage.

## 1. Périmètre et authentification

L'API donne à un SI tiers un accès **borné à une organisation** : une clé ne peut
lire ou écrire que les données de l'organisation à laquelle elle a été créée.

- Créer ou révoquer une clé : ADMIN, dans Configuration → « Clés d'API ».
- Format : `acra_<prefix>_<secret>`, transmis dans `Authorization: Bearer …`.
- Le secret n'est affiché qu'une fois. En base, ACRA ne conserve qu'un dérivé
  **scrypt salé** ; le préfixe public sert uniquement à retrouver la clé.
- Une clé peut expirer ou être révoquée. Les clés révoquées/expirées ne sont plus
  utilisables immédiatement.
- Scopes disponibles : `read`, `write`, `provision`. La v1 utilise `read` pour
  les lectures et `write` pour l'import ; `provision` est réservé aux flux SCIM.

```bash
curl -H 'Authorization: Bearer acra_<prefix>_<secret>' \
  https://acra.example.fr/api/v1/risks
```

Les routes `/api/v1/*` ne reposent pas sur une session navigateur. Une erreur
d'authentification renvoie `401` (clé absente, invalide, expirée ou révoquée) ;
un scope insuffisant renvoie `403`.

## 2. Endpoints de lecture

Tous exigent le scope `read` et répondent sous la forme `{ "data": [...],
"count": n }`. Les dates sont sérialisées en ISO 8601.

| Endpoint | Données retournées |
|---|---|
| `GET /api/v1/risks` | Registre de risques : identité, catégorie, propriétaire, statut, cotations et niveaux inhérent/résiduel calculés. |
| `GET /api/v1/controls` | Bibliothèque de contrôles : niveau N1/N2, périodicité, responsable, activité, dernière/prochaine échéance, état, efficacité observée. |
| `GET /api/v1/incidents` | Incidents et pertes : statut, catégorie, entité, dates, montant brut, récupérations et perte nette calculée. |
| `GET /api/v1/openapi.json` | Spécification OpenAPI 3.0.3 publique. Cette route ne requiert pas de clé. |

Exemple de risque retourné :

```json
{
  "id": "clx…",
  "intitule": "Indisponibilité du paiement en ligne",
  "description": "…",
  "categorie": "CYBER",
  "proprietaire": "DSI",
  "statut": "EVALUE",
  "niveauInherent": 16,
  "niveauResiduel": 8,
  "cotation": {
    "graviteInherente": 4,
    "vraisemblanceInherente": 4,
    "graviteResiduelle": 4,
    "vraisemblanceResiduelle": 2
  },
  "createdAt": "2026-09-17T09:30:00.000Z"
}
```

Les niveaux sont le produit gravité × vraisemblance ; ils valent `null` lorsqu'une
des deux cotations n'est pas renseignée.

## 3. Import en masse

`POST /api/v1/import` exige le scope `write`. Il accepte, dans la même requête,
un lot de risques et/ou de contrôles. Chaque ressource est plafonnée à **500
éléments** ; les éléments au-delà du plafond sont comptés comme ignorés.

```json
{
  "risks": [
    {
      "intitule": "Indisponibilité du paiement en ligne",
      "description": "Défaillance d'un prestataire critique",
      "taxonomieCode": "CYBER",
      "proprietaire": "DSI",
      "graviteInherente": 4,
      "vraisemblanceInherente": 4,
      "graviteResiduelle": 4,
      "vraisemblanceResiduelle": 2,
      "statut": "EVALUE"
    }
  ],
  "controls": [
    {
      "intitule": "Revue trimestrielle des accès privilégiés",
      "niveau": "N2",
      "periodicite": "TRIMESTRIEL",
      "responsable": "RSSI",
      "actif": true
    }
  ]
}
```

### Champs et normalisation

Un risque requiert `intitule`. Les cotations, si présentes, doivent être entre
1 et 5. Les champs facultatifs sont `description`, `taxonomieCode`,
`processusId`, `entite`, `proprietaire`, les quatre cotations et `statut`
(`IDENTIFIE`, `EVALUE`, `TRAITE`, `ACCEPTE`, `CLOTURE`). La provenance est définie
par ACRA à `API`, pour garantir la traçabilité de l'import.

Un contrôle requiert `intitule`. Ses champs facultatifs sont `description`,
`niveau` (`N1` ou `N2`), `periodicite` (`HEBDOMADAIRE`, `MENSUEL`,
`TRIMESTRIEL`, `SEMESTRIEL`, `ANNUEL`), `responsable`, `riskItemId`,
`processusId`, `tailleEchantillon`, `actif`, `referentielCode`, `exigenceRefs`,
`checklist` et `superviseIds`.

Les valeurs valides sont normalisées (espaces, longueurs et valeurs par défaut)
avant insertion. Les références `processusId` et `riskItemId` doivent être des
identifiants cohérents avec l'organisation de la clé : l'intégrateur doit les
obtenir et les maintenir depuis son référentiel ACRA.

### Résultat et erreurs partielles

L'import est volontairement **partiel** : un élément invalide ne bloque pas les
autres. La réponse indique les créations, les éléments ignorés et les erreurs
indexées dans le lot :

```json
{
  "created": { "risks": 1, "controls": 1 },
  "skipped": { "risks": 0, "controls": 0 },
  "errors": [
    { "resource": "risks", "index": 2, "error": "cotation_invalide" }
  ]
}
```

- `201` : au moins un élément a été créé, ou le lot est vide et valide.
- `400` : aucun élément n'a été créé (validation, ou module requis inactif).
- `errors[].index = -1` et `error = "module_inactif"` : le module Registre de
  risques ou Contrôle permanent est désactivé dans l'organisation.

L'import écrit un événement d'audit. La création de risques par import déclenche
également les webhooks `risk.created` configurés pour l'organisation.

## 4. Exploitation et compatibilité

- Utiliser l'OpenAPI de l'instance pour générer un client et vérifier le contrat
  avant une mise à jour ACRA.
- Prévoir le traitement des erreurs par élément et conserver l'index source pour
  pouvoir rejouer uniquement les lignes en échec.
- Ne jamais exposer une clé dans une application navigateur, un dépôt ou un
  journal. La stocker dans un coffre de secrets et la faire tourner si elle a été
  divulguée.
- La v1 ne fournit pas encore de pagination ni de filtres sur les routes de
  lecture : les connecteurs doivent donc accepter une liste complète.

Les webhooks sortants, leur signature HMAC et leur mécanisme de réessai sont
décrits dans [`webhooks-sortants.md`](webhooks-sortants.md). Le provisioning
d'identité relève de la spécification [`scim-provisioning.md`](scim-provisioning.md).
