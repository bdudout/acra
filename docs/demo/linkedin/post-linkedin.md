# Post LinkedIn — dernières évolutions d'ACRA

Vidéos (44 s, sans son) : **`acra-linkedin-carre.mp4` (1080 × 1080, 1:1) — à utiliser sur LinkedIn**, affichée sans bandes
ni recadrage sur ordinateur comme sur téléphone ; `acra-linkedin.mp4` (1080 × 1350, 4:5) pour les autres réseaux.
Régénérer : `node docs/demo/linkedin/build-video.cjs carre` (ou `portrait`).

---

ACRA n'est plus « un outil EBIOS RM ». 🚀

Quand j'ai commencé ACRA, l'objectif était simple : rendre l'analyse de risques cyber accessible à des
non-spécialistes. Les dernières versions vont beaucoup plus loin.

🔹 **Du risque business, pas seulement cyber**
Opérationnel, métier, projet, fraude, externalisation, IT : tout le risque d'un projet (« projets 360 »),
avec sa météo, sa matrice brut / actuel / résiduel et ses plans d'action avant la mise en service.

🔹 **Pas seulement EBIOS RM**
EBIOS RM, ISO/IEC 27005, ISO 31000, NIST SP 800-30 : chaque organisation choisit sa méthode.

🔹 **Toute la GRC, module par module**
Conformité, contrôle permanent, audit interne, incidents et déclarations (DORA, NIS2, RGPD…), registres
(risques, prestataires TIC, RGPD, IA), tiers, reporting réglementaire… On active ce dont on a besoin,
et la feuille de route continue.

🔹 **Aucune IA dans ACRA… et pourtant une application IA native**
ACRA n'embarque aucun modèle : vos données restent chez vous. Mais ACRA expose un serveur MCP
(Model Context Protocol) : votre assistant, qu'il s'agisse de Claude, Codex, Mistral ou d'une IA locale
et souveraine, lit le contexte, s'appuie sur les recommandations calculées par ACRA et propose.
Rien n'est écrit sans validation humaine, et chaque appel est tracé.

Concrètement, cela permet de **migrer l'existant avec l'aide d'une IA** : reprendre une analyse
historique ou une expression de besoins, importer une PSSI comme référentiel de mesures et de
conformité, compléter le registre d'un projet. L'assistant prépare, l'humain décide.

🔹 **Gratuit et open source, sous licence MIT**
Pour les petites structures comme pour les grands groupes : vous l'installez chez vous, vous l'adaptez,
sans licence à payer.

👉 Démo : https://acra-cyber.com
👉 Code : github.com/bdudout/acra

Vos retours m'intéressent, en particulier si vous travaillez sur la GRC dans une PME, une mutuelle,
une banque ou une collectivité. 🙏

#GRC #GestionDesRisques #Cybersécurité #EBIOSRM #ISO27005 #ISO31000 #DORA #NIS2 #OpenSource #IA #MCP #IASouveraine

---

## Variante courte (si besoin)

ACRA, ce n'est plus seulement EBIOS RM ni seulement le cyber 👇
✅ Risque business : projets 360, opérationnel, fraude, externalisation
✅ Multi-méthode : EBIOS RM, ISO/IEC 27005, ISO 31000, NIST SP 800-30
✅ Toute la GRC : conformité, contrôle, audit, incidents (DORA, NIS2, RGPD), registres, tiers
✅ Aucune IA embarquée, mais IA native : serveur MCP pour migrer et compléter vos analyses avec une IA
locale ou souveraine, toujours sous validation humaine
✅ Gratuit, open source, licence MIT, des PME aux grands groupes
👉 Démo : https://acra-cyber.com
👉 Code : github.com/bdudout/acra
