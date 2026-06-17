-- Héritage de gravité des scénarios stratégiques (fiche méthode Club EBIOS A3) :
-- liste des ids d'événements redoutés liés à l'objectif visé d'un scénario.
-- La gravité du scénario = max des gravités de ces ER. Colonne additive, nullable.
ALTER TABLE "ScenarioStrategique" ADD COLUMN "evenementsRedoutesIds" JSONB;
