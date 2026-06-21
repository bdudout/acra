# Multi-organisation hiérarchique — Conception

> Branche `feat/multi-organisation`. Document de conception **à valider** avant fusion.
> Aucune mise en production tant que ce n'est pas terminé / testé / validé.

## 1. Cas d'usage cibles

| Cas | Besoin structurant |
|---|---|
| **Consultant** servant plusieurs entreprises clientes | Plusieurs organisations **racines isolées** ; un même utilisateur (le consultant) est **membre de plusieurs** organisations, avec un rôle propre dans chacune. |
| **Grand groupe** avec plusieurs entités | **Hiérarchie** groupe → entités. Le RSSI d'entité a une **vision entité** ; le RSSI groupe a une **vision consolidée** du groupe (sous-arbre). |
| **Entreprise multi-sites / multi-pays** | Hiérarchie société → sites. Vision par site et vision société. |
| **Filiales et sous-filiales** | **Arbre de profondeur quelconque** (parent → filiale → sous-filiale). |

Dénominateur commun : **un arbre d'organisations** + **des appartenances multiples** + une **portée** (nœud seul vs sous-arbre) déterminant ce qu'un membre voit.

## 2. Modèle de données

### Organisation (arbre)

```prisma
model Organization {
  id        String   @id @default(cuid())
  nom       String
  slug      String   @unique
  parentId  String?
  parent    Organization?  @relation("OrgArbre", fields: [parentId], references: [id])
  enfants   Organization[] @relation("OrgArbre")
  // Chemin matérialisé "/<racineId>/…/<id>/" → requêtes de sous-arbre efficaces (startsWith)
  // sans CTE récursive (non native sous Prisma).
  path      String
  actif     Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  membres   OrgMembership[]
  analyses  Analyse[]
  config    OrganizationConfig?
  @@index([parentId])
  @@index([path])
}
```

**Chemin matérialisé** : la racine a `path = "/<id>/"`. Un enfant a `path = parent.path + "<id>/"`.
Le **sous-arbre** d'une organisation O = toutes les orgs dont `path startsWith O.path`.
Déplacer une organisation (rare) impose de réécrire le `path` du sous-arbre — opération admin dédiée.

### Appartenance (membre ↔ organisation, multi)

```prisma
model OrgMembership {
  id             String   @id @default(cuid())
  userId         String
  organizationId String
  role           UserRole              // rôle DANS cette organisation
  scope          OrgScope @default(NODE) // NODE = ce nœud · SUBTREE = nœud + descendants
  createdAt      DateTime @default(now())
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  @@unique([userId, organizationId])
  @@index([userId])
  @@index([organizationId])
}
enum OrgScope { NODE  SUBTREE }
```

- **Consultant** : une appartenance par client (rôle ADMIN ou ANALYSTE selon la mission).
- **RSSI groupe** : une appartenance au nœud groupe, `scope = SUBTREE` → voit tout le sous-arbre.
- **RSSI entité** : une appartenance au nœud entité, `scope = NODE`.

Le **rôle devient porté par l'appartenance** (par organisation). `User.role` est conservé comme
**rôle par défaut** (repli, et rôle appliqué à l'unique organisation dans le cas mono-org).

### Rôle instance

`UserRole` reçoit **`SUPER_ADMIN`** (niveau instance) : gère les organisations, peut traverser
tous les périmètres. Les rôles existants (`ADMIN`, `RSSI`, `RISK_MANAGER`, `ANALYSTE`, `LECTEUR`)
restent des rôles **au sein d'une organisation**. `ADMIN` devient « administrateur d'organisation ».

### Analyse

```prisma
model Analyse {
  // … existant …
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  @@index([organizationId])
}
```

### Configuration

`OrganizationConfig` : **une ligne par organisation** (`id = organizationId`, fin du singleton
`"global"`). Résolution `getOrgConfig(orgId)` : valeurs de l'org, sinon **héritage** en remontant
les ancêtres, sinon **défauts** (échelles/exemples/référentiels). Lot L2.

## 3. Portée et isolation (le cœur)

**Organisation active** : l'org dans laquelle l'utilisateur opère, stockée en **cookie** `acra_org`
(repli : appartenance principale). Un **sélecteur d'organisation** (en-tête) permet d'en changer.

`resolveOrgContext(userId, activeOrgId?)` → `{ membership, activeOrg, visibleOrgIds, role, isSuperAdmin }`
- `visibleOrgIds` = `[activeOrg]` si `scope = NODE` ; `activeOrg + descendants` si `scope = SUBTREE`.
- `role` = rôle de l'appartenance pour l'org active.

`analyseWhereClause(userId, role, ctx)` (centralisé, déjà traversé par **toutes** les vues) :
- `SUPER_ADMIN` → aucun filtre d'org (tout).
- sinon → `organizationId IN visibleOrgIds` **ET** la logique de rôle existante (ADMIN d'org : tout
  l'org/sous-arbre ; RM/RSSI : soumises + propres + partagées ; ANALYSTE/LECTEUR : propres + partagées).

→ **La vision consolidée du groupe est gratuite** : les tableaux de bord / risques / tiers itèrent
déjà les analyses via ce filtre ; un `scope = SUBTREE` agrège automatiquement le sous-arbre.

## 4. Provisionnement

- `SUPER_ADMIN` crée une organisation (sous un parent éventuel) et invite son premier admin ;
- ou self-service (option) : le 1ᵉʳ utilisateur d'une nouvelle org en devient l'admin.

## 5. Migration (rétrocompatible — mono-org → multi-org)

1. Créer l'organisation racine « Organisation principale » (`path = "/<id>/"`).
2. `Analyse.organizationId = racine` pour toutes les analyses existantes.
3. Pour chaque utilisateur : `OrgMembership(org = racine, role = User.role, scope = ADMIN ? SUBTREE : NODE)`.
4. `OrganizationConfig "global"` → config de la racine (réutilise la ligne, `id = racineId`).
5. (option) Promouvoir le 1ᵉʳ ADMIN en `SUPER_ADMIN`.

L'instance mono-org continue de fonctionner à l'identique (une racine, tout le monde membre).

## 6. Découpage en lots

| Lot | Contenu | État |
|---|---|---|
| **L1** | Modèle (Organization arbre + OrgMembership + Analyse.organizationId) + migration + **lib `org-context`** (sous-arbre, portée, scoping) **avec tests** + branchement de `analyseWhereClause` | en cours |
| **L2** | `getOrgConfig(orgId)` avec héritage ; remplacement des accès `OrganizationConfig['global']` | à venir |
| **L3** | Rôle `SUPER_ADMIN` + admin des organisations (CRUD arbre, invitations/appartenances) + **sélecteur d'organisation** + i18n (5 langues) | à venir |
| **L4** | Vues consolidées (dashboard/risques/tiers « groupe » avec colonne entité) + branding par org | à venir |

## 7. Points d'attention

- **Isolation** : aucune route ne doit charger une analyse hors `visibleOrgIds` (audit : tout passe
  déjà par `analyseWhereClause` + gardes `deletedAt`).
- **Analyses socles** partagées : restent **intra-organisation** (un socle n'est hérité que dans son org/sous-arbre).
- **Unicité e-mail** : **globale** (un compte = une personne, plusieurs appartenances) — plus simple et adapté au consultant.
- **Récupération (corbeille)** et **journal d'audit** : scopés par organisation (sauf SUPER_ADMIN).
- **Déplacement d'org** : réécrit le `path` du sous-arbre (opération admin atomique).
