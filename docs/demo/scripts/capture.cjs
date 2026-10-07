// ─── Captures de la démo MCP « projet 360 » (Playwright) ──────────────────────
// node docs/demo/scripts/capture.cjs <étape>   — étapes : projet | risques | projet-page | export
// Identifiants de l'humain qui valide : variables ACRA_EMAIL et ACRA_PASSWORD (jamais écrits dans un fichier).
// Images : docs/demo/captures/*.png (1440 × 900, ×2). Instance : ACRA_BASE (défaut http://localhost:3005).
const path = require('node:path')
const { chromium } = require(path.join(__dirname, '../../../node_modules/playwright'))
const OUT = path.join(__dirname, '../captures')
const BASE = process.env.ACRA_BASE ?? 'http://localhost:3005'
const PROJET = 'Espace adhérent 2027'

;(async () => {
  const etape = process.argv[2]
  const browser = await chromium.launch({ args: ['--lang=fr-FR'] })   // champs de date au format français
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'light', locale: 'fr-FR', acceptDownloads: true })
  const page = await ctx.newPage()
  page.setDefaultTimeout(90000)
  await page.goto(BASE + '/auth/signin'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(3000)
  await page.fill('input[type=email]', process.env.ACRA_EMAIL)
  await page.fill('input[type=password]', process.env.ACRA_PASSWORD)
  await Promise.all([page.waitForURL(u => !u.pathname.startsWith('/auth')), page.press('input[type=password]', 'Enter')])

  // Indicateur de développement Next.js et bandeau cookies : hors champ de la démo.
  const propre = async () => {
    await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' }).catch(() => {})
    const b = page.getByRole('button', { name: 'Compris' }); if (await b.count()) await b.first().click().catch(() => {})
  }
  const shot = async (nom, opts = {}) => { await propre(); await page.waitForTimeout(1200); await page.screenshot({ path: `${OUT}/${nom}.png`, ...opts }); console.log('capture', nom) }
  const file = async () => { await page.goto(BASE + '/mcp-propositions'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(2000) }
  const ouvrirProjet = async () => {
    await page.goto(BASE + '/projets'); await page.waitForLoadState('networkidle')
    await page.getByRole('link', { name: PROJET }).first().click()
    await page.waitForURL(/\/projets\/[^/]+$/); await page.waitForLoadState('networkidle'); await page.waitForTimeout(3000)
  }

  if (etape === 'projet') {
    await file(); await shot('01-proposition-projet')
    const carte = page.locator('li', { hasText: PROJET }).filter({ hasText: 'Projet 360 proposé' }).first()
    await carte.getByRole('button', { name: 'Accepter' }).click()
    await carte.waitFor({ state: 'detached' })            // la proposition quitte la file une fois le projet créé
    await shot('02-projet-accepte')
    await ouvrirProjet(); await shot('03-projet-cree')
  }
  if (etape === 'risques') {
    await file(); await shot('04-propositions-risques', { fullPage: true })
    // Validation humaine : chaque proposition est acceptée une à une ; on attend qu'elle quitte la file.
    const cartes = page.locator('li', { hasText: 'Risque proposé' })
    for (let n = await cartes.count(); n > 0; n = await cartes.count()) {
      await cartes.first().getByRole('button', { name: 'Accepter' }).click()
      await page.waitForFunction(([sel, avant]) => document.querySelectorAll(sel).length < avant, ['li', await page.locator('li').count()], { timeout: 60000 })
    }
    await shot('05-file-vide')
  }
  if (etape === 'rejet') {
    // Contrôle humain : une proposition hors périmètre est refusée ; elle reste tracée (statut REJETEE).
    await file(); await shot('11-proposition-hors-perimetre')
    const carte = page.locator('li', { hasText: 'Risque proposé' }).first()
    await carte.getByRole('button', { name: 'Rejeter' }).click()
    await page.waitForFunction(() => !document.body.innerText.includes('Risque proposé'), null, { timeout: 60000 })
    await shot('12-proposition-rejetee')
  }
  if (etape === 'projet-page') {
    await ouvrirProjet()
    // Le chef de projet renseigne la météo (une seule valeur, sur le projet de démo).
    const meteo = page.locator('section[aria-label="Indicateurs du projet"] select').first()
    if (await meteo.count()) { await meteo.selectOption({ index: 2 }).catch(() => {}); await page.waitForTimeout(2500) }
    await shot('06-page-projet')
    const matrice = page.locator('section', { has: page.getByRole('heading', { name: /Matrice/ }) }).first()
    await matrice.scrollIntoViewIfNeeded(); await shot('07-matrice-des-risques')
    await page.locator('section[aria-label="Plans d’action par priorité"]').scrollIntoViewIfNeeded()
    await page.mouse.wheel(0, -80); await shot('08-plans-par-priorite')
    await shot('09-page-projet-complete', { fullPage: true })
  }
  if (etape === 'export') {
    await ouvrirProjet()
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /PowerPoint/ }).first().click()])
    const dest = `${OUT}/revue-projet-espace-adherent-2027.pptx`; await dl.saveAs(dest); console.log('export', dest)
  }
  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
