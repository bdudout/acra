# Propositions d'évolution — ACRA

Deux évolutions proposées à la suite de l'audit. Chacune est **prête à être lancée** :
le périmètre, le modèle de données, la migration et le découpage en lots sont décrits.
Aucune n'est encore implémentée — elles attendent votre arbitrage.

---

## 1. 🏢 Multi-organisations (multi-tenant léger)

### Problème

Aujourd'hui, `OrganizationConfig` est un **singleton** (`id = "global"`) partagé par tous :
un seul jeu d'échelles, d'exemples, de référentiels et de paramètres pour toute l'instance.
Un **formateur ou consultant** qui sert plusieurs clients ne peut pas :
- isoler les analyses d'un client de celles d'un autre ;
- personnaliser les échelles/exemples/référentiels par client ;
- déléguer l'administration d'un client sans donner accès aux autres.

→ Aujourd'hui il faut **une instance par client**. Le multi-organisations lève cette limite.

### Cible

Plusieurs **organisations** cohabitent dans une seule instance, chacune avec sa
configuration propre, ses membres et ses analyses isolées.

### Modèle de données

```prisma
model Organization {
  id        String   @id @default(cuid())
  nom       String
  slug      String   @unique
  actif     Boolean  @default(true)
  createdAt DateTime @default(now())

  users      User[]
  analyses   Analyse[]
  config     OrganizationConfig?
}

// Ajouts :
model User      { organizationId String?  ; organization Organization? @relation(...) }   // org d'appartenance
model Analyse   { organizationId String   ; organization Organization  @relation(...) }   // + @@index([organizationId])
model OrganizationConfig { id = organizationId } // une ligne de config PAR organisation (fin du singleton "global")
```

Un nouveau rôle **`SUPER_ADMIN`** (niveau instance) gère les organisations et peut
traverser les périmètres ; l'**`ADMIN`** existant devient **administrateur d'une organisation**
(scopé à la sienne).

### Isolation (le cœur)

- **Lecture** : étendre `analyseWhereClause(userId, role, orgId)` pour ajouter
  `organizationId: orgId` (sauf `SUPER_ADMIN`). Toutes les vues passent déjà par cette
  fonction → l'isolation est centralisée.
- **Config / échelles / exemples / référentiels** : remplacer les accès à
  `OrganizationConfig['global']` par un helper `getOrgConfig(orgId)` (résolution + défauts).
- **Récupération (corbeille)** et **journal d'audit** : scopés par organisation.

### Provisionnement

- `SUPER_ADMIN` crée une organisation et invite son premier admin **ou**
- à l'inscription, le 1ᵉʳ utilisateur d'une nouvelle organisation en devient l'admin
  (option self-service activable).

### Migration (rétrocompatible)

1. Créer une organisation « Organisation principale ».
2. Rattacher **tous** les utilisateurs et analyses existants à cette organisation.
3. Migrer la config `global` → config de l'organisation principale.
4. Promouvoir le 1ᵉʳ ADMIN existant en `SUPER_ADMIN` (ou laisser ADMIN org-scopé).

### Découpage en lots

| Lot | Contenu | Effort |
|---|---|---|
| L1 | Modèle `Organization` + migration (org par défaut) + scoping de `analyseWhereClause` | Moyen |
| L2 | Config/échelles/exemples par organisation (`getOrgConfig`) | Moyen |
| L3 | Rôle `SUPER_ADMIN` + page d'admin des organisations (CRUD, invitations) | Moyen |
| L4 | (option) Multi-appartenance + sélecteur d'organisation + branding (logo/nom) | Élevé |

### Points d'attention
- Audit RBAC : vérifier qu'aucune route ne charge une analyse sans filtre d'organisation
  (l'audit a déjà centralisé via `analyseWhereClause` + gardes `deletedAt`).
- Bien tester les analyses **socles** partagées (héritées) : restent-elles intra-organisation ?
- Unicité d'e-mail : globale ou par organisation ? (recommandé : globale, plus simple).

---

## 2. 🔗 Rangs 2/3 des parties prenantes (profondeur de l'écosystème)

### Problème

La fiche méthode 5 (ANSSI) recommande, pour les **tiers critiques** (zones danger/contrôle),
d'évaluer aussi leurs **parties prenantes connexes** :
- PP en zone **danger** → évaluer les PP connexes jusqu'au **rang 3** ;
- PP en zone **contrôle** → évaluer les PP connexes de **rang 2** ;
- PP non critique → pas d'analyse plus profonde.

Aujourd'hui, ACRA ne gère que le **rang 1** (PP en lien direct avec l'objet de l'étude).

### Modèle de données

```prisma
model PartiePrenante {
  // … champs existants …
  rang     Int     @default(1)   // 1 (direct), 2, 3
  parentId String?               // PP de rang n-1 dont celle-ci dépend (auto-relation)
  parent   PartiePrenante?  @relation("PPConnexe", fields: [parentId], references: [id], onDelete: Cascade)
  enfants  PartiePrenante[] @relation("PPConnexe")
}
```

### UI (Atelier 3)

- Sur une PP **critique**, action « **+ Ajouter une PP connexe (rang 2)** » → crée une PP
  enfant (`rang = 2`, `parentId` renseigné), elle-même pouvant avoir des enfants de rang 3.
- Bandeau de **guidage** rappelant la règle de profondeur selon la zone (danger→3, contrôle→2).
- Le tableau des PP groupe/indente les connexes sous leur parent.

### Radar

- **Rang 1 affiché par défaut** (lisibilité, comme le recommande le guide).
- Bascule « **Afficher les rangs 2/3** » : points plus petits, **trait pointillé** vers le parent,
  éventuellement opacité dégressive selon le rang.

### Migration
- Ajout de `rang`/`parentId` (les PP existantes restent en rang 1, `parentId = null`).

### Effort : **Moyen** (modèle + migration + ajout/gestion des enfants + rendu des rangs sur le radar/tableau/PDF).

---

## Recommandation de priorisation

1. **Rangs 2/3** d'abord (effort moyen, complète la méthode ANSSI déjà en place, sans refonte transverse).
2. **Multi-organisations** ensuite si vous ciblez les **formateurs/consultants** (effort plus important, touche le modèle et l'isolation ; à faire par lots L1→L4).

Dites-moi lequel (ou les deux) vous voulez que je lance, et dans quel ordre.
