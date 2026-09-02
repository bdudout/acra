# Univers des référentiels GRC — étude & cible d'unification

> Étude préalable au chantier **« unification des référentiels »**. Objectif : un
> seul objet « référentiel » par organisation, partagé par les **analyses de
> risques**, les **contrôles**, la **conformité** et l'**audit** — et ouvert au-delà
> du cyber (LCB-FT, gel des avoirs, déontologie, comptable, octroi de crédit…).
>
> Décisions actées (cf. session) :
> - **Cadres livrés** = catalogue **canonique**, maintenu en code, **sélectionnable**
>   par l'organisation (une seule version). L'org ne réécrit pas ISO/DORA.
> - **PSSI & référentiels internes** = **un par organisation, éditables** (table
>   `Referentiel` existante).
> - Livraison **phasée en PRs**.

---

## 1. Constat : trois notions parallèles aujourd'hui

| # | Emplacement | Forme | Exigences ? | Consommé par |
|---|---|---|---|---|
| 1 | `OrganizationConfig.referentielsActifs` (`ReferentielActif{nom,description,actif}`) | **étiquettes (noms)** | ❌ | **Analyses de risques** (Atelier 1, cadrage, PDF) |
| 2 | `FRAMEWORK_META` + contrôles (`frameworks-data.ts`) — 15 cadres cyber | code + exigences | ✅ | **Conformité / contrôles / audit** (via `referentiel.server.ts`) |
| 3 | Table `Referentiel` (CUSTOM, par org) | code + exigences | ✅ | idem |

`referentiel.server.ts` unifie déjà **#2 + #3** derrière un résolveur unique
(`listReferentiels`, `getExigencesFor`). **La rupture est #1** : la liste côté analyse
est *nominale* et déconnectée — « DORA » y est une chaîne sans rapport avec le « DORA »
porteur d'exigences côté contrôle. D'où DORA / ISO 27001 présents dans ~3 endroits avec
3 orthographes (`'DORA'` vs `'DORA'` (FRAMEWORK_META) vs `'DORA'` (catalogue) ;
`'ISO/IEC 27001:2022'` vs `'ISO/IEC 27001'` vs `'ISO27001'`).

**Deux limites structurelles :**
1. **Pas d'unification RA ↔ GRC** : les analyses ne pointent pas les mêmes objets que
   les contrôles/conformité.
2. **Verrou cyber** : le `type` d'exigence est figé aux 4 catégories ISO 27001
   (`ORGANISATIONNELLE | HUMAINE | PHYSIQUE | TECHNOLOGIQUE`) ; le référentiel n'a pas
   de **domaine** (compta, crédit, LCB-FT…) ; les catalogues de contrôle/audit ne
   proposent que ISO/DORA.

---

## 2. Cible : un référentiel = { identité, domaine, exigences } — une source unique

Un **référentiel** devient l'unité partagée par tous les métiers :

```
Référentiel
  code        slug unique par org (ISO27001, DORA, LCB-FT, PSSI-2026, OCTROI-CREDIT…)
  nom         libellé
  domaine     ← NOUVEAU : famille de risque/contrôle (§4)
  nature      NORME | REGLEMENTATION | POLITIQUE_INTERNE | PROCEDURE | STANDARD
  source      BUILTIN (canonique, code) | CUSTOM (par org, éditable)
  version     une seule par org
  exigences   points de contrôle { ref, nom, description, categorie, type? }
  missions    objectifs (politiques/stratégies)
```

- **Sélection unique par org** : `OrganizationConfig.referentielsActifs` cesse d'être
  une liste de noms → devient une **liste de codes** choisis dans le catalogue unifié
  (builtin + custom). Cette sélection pilote **à la fois** :
  les cadres proposés en atelier (RA), les référentiels évalués en conformité, les
  catalogues de contrôle/audit offerts. → *une liste, une version chacun.*
- **`referentiel.server.ts` reste le point de résolution unique** ; on y ajoute le
  `domaine` et on branche la sélection d'org.
- **Exigence `type`** : garder les 4 catégories ISO comme défaut **du domaine cyber**,
  mais rendre le champ **optionnel/libre** pour les autres domaines (une exigence
  comptable ou LCB-FT n'est pas « physique/technologique »).

---

## 3. Le référentiel réglementaire n'est pas toujours une check-list

Point de conception important : beaucoup de textes (CMF LCB-FT, arrêté du 3 nov. 2014,
règlement gel des avoirs) **ne sont pas** des listes d'exigences prêtes à cocher comme
ISO 27001. Le modèle doit accepter deux régimes :

- **Référentiel « à exigences »** (ISO, DORA, PCI-DSS, SOC 2) → exigences numérotées
  livrées → conformité/contrôle par exigence, immédiat.
- **Référentiel « cadre »** (une réglementation) → on livre l'**ossature** (articles /
  thèmes / obligations clés) comme exigences de haut niveau, et l'organisation
  **rattache ses propres points de contrôle** (custom) sous ce cadre. C'est déjà ce que
  permet la table `Referentiel` — on l'étend aux domaines non-cyber.

→ Conséquence : on **seed les en-têtes canoniques** (code, nom, domaine, nature, base
réglementaire) + un **jeu d'exigences de départ** quand c'est pertinent, et l'org
enrichit. Pas besoin de retranscrire un code entier pour être utile.

---

## 4. Taxonomie de DOMAINE proposée (univers de contrôle & audit)

Alignée sur les **filières de risques** du contrôle interne bancaire
(arrêté du 3 novembre 2014 **modifié**, notamment par l'arrêté du 25 février 2021) et
élargie assurance/entreprise. Enum stable, extensible.

> ℹ️ Référence : « arrêté du 3 nov. 2014 » ci-dessous désigne le texte **dans sa version
> consolidée** (amendé en 2021). Les libellés de référentiels seedés porteront la
> version consolidée.

| Code domaine | Intitulé | Couvre |
|---|---|---|
| `SECURITE_SI` | Sécurité SI & résilience numérique | Cyber, SSI, DORA, continuité TIC *(cadres actuels)* |
| `PROTECTION_DONNEES` | Protection des données | RGPD, secret bancaire, données de santé |
| `LCB_FT` | Lutte anti-blanchiment & financement du terrorisme | KYC, vigilance, déclarations de soupçon |
| `SANCTIONS_GEL` | Sanctions & gel des avoirs | Mesures restrictives UE/OFAC, gel, embargos |
| `PROTECTION_CLIENTELE` | Protection de la clientèle & commercialisation | MIF 2, DSP2, IDD (assurance), information client |
| `DEONTOLOGIE` | Déontologie, conflits d'intérêts, anticorruption | Sapin II, abus de marché, cadeaux, transactions perso |
| `COMPTABLE_FINANCIER` | Fiabilité comptable & financière | Piste d'audit, arrêté 3 nov. 2014, IFRS, reporting |
| `CREDIT_CONTREPARTIE` | Octroi & suivi des crédits | Procédures d'octroi, notation, EBA LOM, provisionnement |
| `RISQUE_OPERATIONNEL` | Risque opérationnel & externalisation | PCA, pertes op., prestataires critiques, Bâle |
| `GOUVERNANCE_CONTROLE` | Gouvernance & dispositif de contrôle interne | Arrêté 3 nov. 2014, CRD/CRR, Solvabilité II |
| `AUTRE` | Autre / interne non classé | Référentiels internes hors catégories |

> Les domaines `LCB_FT`, `SANCTIONS_GEL`, `DEONTOLOGIE`, `PROTECTION_CLIENTELE` sont
> volontairement distincts (et non un seul « conformité ») car ce sont des **filières
> de contrôle permanent séparées**, avec responsables, plans de contrôle et reporting
> distincts en banque/assurance.

---

## 5. Catalogue des référentiels/réglementations à intégrer

Priorité : **P1** = à seeder en canonique (en-tête + exigences de départ) ;
**P2** = en-tête canonique seul (org enrichit) ; **P3** = laissé en custom/plus tard.
« Livré ? » = déjà présent dans `frameworks-data.ts`.

### 5.1 `SECURITE_SI` — déjà couvert (rebrancher, pas recréer)
| Réf. | Base | Livré ? | Prio |
|---|---|---|---|
| ISO/IEC 27001:2022 | Norme SMSI | ✅ | — |
| ISO/IEC 27002:2022 | Mesures | ✅ (via 27001) | — |
| DORA | Règl. UE 2022/2554 | ✅ | — |
| NIS2 / ReCyF | Dir. UE 2022/2555 ; ANSSI | ✅ | — |
| PCI-DSS v4, HDS, RGS, ANSSI hygiène, CIS v8, NIST CSF/800-53/SSDF, IEC 62443, TISAX, SOC 2 | divers | ✅ | — |

→ **Aucun contenu à créer** : juste rattacher `domaine = SECURITE_SI` et faire pointer
la sélection d'org dessus.

### 5.2 `PROTECTION_DONNEES`
| Réf. | Base réglementaire | Livré ? | Prio |
|---|---|---|---|
| RGPD | Règl. UE 2016/679 | ⚠️ (RoPA existe, pas en référentiel d'exigences) | **P1** |
| Recommandations CNIL (sécurité) | CNIL | ❌ | P2 |

### 5.3 `LCB_FT`
| Réf. | Base | Prio |
|---|---|---|
| Dispositif LCB-FT (CMF art. L.561-1 s.) | Code monétaire et financier | **P1** |
| Lignes directrices ACPR LCB-FT | ACPR | P2 |
| Orientations EBA LCB-FT (ML/TF risk factors) | EBA/2021/02 | P2 |
| Recommandations GAFI (40 recommandations) | GAFI/FATF | P2 |

*Exigences de départ P1* : approche par les risques, KYC/entrée en relation, vigilance
constante, personnes politiquement exposées, déclaration de soupçon (Tracfin),
conservation des documents, formation, gel interne.

### 5.4 `SANCTIONS_GEL`
| Réf. | Base | Prio |
|---|---|---|
| Gel des avoirs / mesures restrictives | Règl. UE + Direction générale du Trésor | **P1** |
| Sanctions OFAC | US Treasury | P2 |

*Exigences de départ* : filtrage des listes (UE/ONU/OFAC), filtrage des transactions,
détection des correspondances, procédure de gel sans délai, déclaration DG Trésor.

### 5.5 `PROTECTION_CLIENTELE`
| Réf. | Base | Prio |
|---|---|---|
| DSP2 (services de paiement) | Dir. UE 2015/2366 | **P1** |
| MIF 2 / MiFID II | Dir. UE 2014/65 | P2 |
| IDD (distribution assurance) | Dir. UE 2016/97 | P2 |
| Abus de marché (MAR) | Règl. UE 596/2014 | P3 |

### 5.6 `DEONTOLOGIE`
| Réf. | Base | Prio |
|---|---|---|
| Anticorruption (Sapin II) | Loi 2016-1691 | **P1** |
| Déontologie / conflits d'intérêts (interne) | Politique interne | P2 (custom) |

*Exigences Sapin II* : code de conduite, dispositif d'alerte, cartographie des risques
de corruption, évaluation des tiers, contrôles comptables, formation, régime
disciplinaire, dispositif de contrôle/évaluation.

### 5.7 `COMPTABLE_FINANCIER`
| Réf. | Base | Prio |
|---|---|---|
| Contrôle interne comptable | Arrêté 3 nov. 2014 (titre comptabilité) | **P1** |
| Piste d'audit fiable | — | P2 |

### 5.8 `CREDIT_CONTREPARTIE`
| Réf. | Base | Prio |
|---|---|---|
| Octroi & suivi des crédits | Procédures internes + EBA LOM (EBA/GL/2020/06) | **P1** |
| Dispositif de notation / provisionnement | Bâle / IFRS 9 | P3 |

*Exigences octroi* : analyse de solvabilité, respect des délégations, complétude du
dossier, garanties, revue périodique, détection des impayés, comité des engagements.

### 5.9 `RISQUE_OPERATIONNEL`
| Réf. | Base | Prio |
|---|---|---|
| Externalisation / prestataires | EBA/GL/2019/02 + DORA art. 28 | **P1** (croise le registre TIC existant) |
| PCA / continuité d'activité | Arrêté 3 nov. 2014 | P2 |
| Risque opérationnel (Bâle) | CRR / Bâle | P3 |

### 5.10 `GOUVERNANCE_CONTROLE`
| Réf. | Base | Prio |
|---|---|---|
| Dispositif de contrôle interne | Arrêté 3 nov. 2014 | **P1** |
| Solvabilité II (assurance) | Dir. UE 2009/138 | P3 |

---

## 6. Impact modèle de données

### 6.1 Migration `Referentiel` (custom, par org)
- **+ `domaine String @default("SECURITE_SI")`** (borné applicativement à l'enum §4).
- `type` (`PSSI|POLITIQUE|REGLEMENTAIRE|STANDARD|CUSTOM`) devient la **`nature`** ;
  conserver la colonne, élargir le libellé si besoin. Rétrocompatible.
- Exigence `type` : rendre optionnel côté validation pour domaines ≠ `SECURITE_SI`.

### 6.2 Cadres livrés (`frameworks-data.ts`)
- **+ `domaine`** dans `FRAMEWORK_META` (tous les cadres actuels = `SECURITE_SI`).
- Ajouter les **en-têtes canoniques non-cyber P1** (RGPD, LCB-FT, SANCTIONS_GEL, DSP2,
  Sapin II, comptable, octroi crédit, externalisation, contrôle interne) avec un jeu
  d'exigences de départ. Restent en code = « une version canonique ».

### 6.3 Config org
- `referentielsActifs` : `ReferentielActif[]` (noms) → **`string[]` de codes** résolus
  par `referentiel.server.ts`. Migration des noms existants → codes (table de
  correspondance ; noms inconnus → référentiel custom conservé).

### 6.4 Consommateurs à rebrancher (phase 2/3)
Analyses (Atelier 1, cadrage, `socle-etat`, PDF), conformité, `controles-catalogue`,
`audit-programmes-catalogue` (aujourd'hui ISO/DORA seuls → ouvrir par domaine),
`ReferentielsManager` (filtre + colonne domaine), i18n ×5.

---

## 7. Découpage en PRs

- **Phase 1 — socle unifié (non cassant)**
  - Migration : `Referentiel.domaine` (+ nature).
  - `DOMAINES` enum (lib pure + tests) ; `domaine` sur `FRAMEWORK_META`.
  - `referentiel.server.ts` : exposer `domaine`, filtrer par domaine.
  - Exigence `type` optionnel hors cyber (validation).
  - **Aucun consommateur cassé** : la sélection d'org et les catalogues restent tels
    quels ; on ajoute la dimension.
- **Phase 2 — unification RA ↔ GRC**
  - `referentielsActifs` = codes ; migration des noms ; Atelier 1 / cadrage / PDF lisent
    la sélection unifiée. Conformité évalue la même sélection.
- **Phase 3 — ouverture non-cyber**
  - Seed des en-têtes + exigences P1 (RGPD, LCB-FT, SANCTIONS_GEL, DSP2, Sapin II,
    comptable, octroi crédit, externalisation, contrôle interne).
  - `controles-catalogue` / `audit-programmes-catalogue` ouverts par domaine + catalogues
    de départ non-cyber.
  - UI : filtre par domaine dans `ReferentielsManager`, contrôles, audit ; i18n ×5.

---

## 8. Points ouverts / à valider

1. **Enum domaine** (§4) : le jeu de 11 convient-il, ou faut-il fusionner/scinder
   (ex. regrouper `PROTECTION_CLIENTELE` + `DEONTOLOGIE`) ?
2. **Profondeur du seed P1** : en-têtes seuls d'abord (org enrichit) vs en-têtes +
   exigences de départ dès la phase 3 ?
3. **Assurance vs banque** : cibler d'abord la banque (arrêté 3 nov. 2014) puis
   Solvabilité II, ou les deux d'emblée ?
