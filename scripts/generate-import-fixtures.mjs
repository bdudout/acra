import ExcelJS from 'exceljs'
import { mkdir } from 'node:fs/promises'

const out = new URL('../fixtures/imports/', import.meta.url)
await mkdir(out, { recursive: true })
async function save(name, sheets) {
  const book = new ExcelJS.Workbook()
  for (const [title, rows] of sheets) { const sheet = book.addWorksheet(title); rows.forEach(row => sheet.addRow(row)); sheet.getRow(1).font = { bold: true }; sheet.columns.forEach(column => { column.width = 24 }) }
  await book.xlsx.writeFile(new URL(name, out))
}
await save('test-import-minimal-risques.xlsx', [['Registre risques', [['Code risque', 'Libellé risque', 'Impact', 'Probabilité', 'Contexte'], ['R-01', 'Indisponibilité portail', 3, 2, 'Services clients'], ['R-02', 'Fuite de données', 4, 2, 'Données personnelles']]]])
await save('test-import-mesures-consultant.xlsx', [['Dispositifs', [['ID', 'Mesure', 'État cabinet', 'Pilote', 'Date cible'], ['M-01', 'Tester le PRA', 'Terminé', 'RSSI', '15/10/2026'], ['M-02', 'Revue des accès', 'En cours', 'DSI', '2026-11-01'], ['M-03', 'Inventaire actifs', 'Abandonné', 'RSSI', '01-12-2026']]]])
await save('test-import-multi-feuilles.xlsx', [['Risques', [['Référence risque', 'Intitulé', 'Gravité', 'Vraisemblance', 'Contexte', 'Objectif'], ['R-10', 'Rançongiciel', 4, 3, 'SI industriel', 'Assurer la continuité']]], ['Plans actions', [['Action ID', 'Référence risque', 'Intitulé action', 'Échéance', 'Responsable'], ['A-10', 'R-10', 'Segmenter les réseaux', '20/12/2026', 'DSI']]], ['Liens risque action', [['Référence risque', 'Référence action'], ['R-10', 'A-10']]]])
