// ─── Captures de la vidéo LinkedIn (Playwright) ───────────────────────────────
// node docs/demo/scripts/capture-linkedin.cjs — identifiants : ACRA_EMAIL / ACRA_PASSWORD (jamais écrits dans un fichier).
// Images : docs/demo/linkedin/captures/<nom>.png (1440 × 900, ×2, français, thème clair).
const path = require('node:path')
const { chromium } = require(path.join(__dirname, '../../../node_modules/playwright'))
const OUT = path.join(__dirname, '../linkedin/captures')
const BASE = process.env.ACRA_BASE ?? 'http://localhost:3005'
const PAGES = (process.env.PAGES ?? 'pilotage:/pilotage,registre:/registre,projets:/projets,conformite:/conformite,controles:/controles,audit:/audit,incidents:/incidents,registre-ia:/registre-ia,tiers:/tiers,reglementaire:/reglementaire,analyses:/analyses,mcp:/mcp-propositions').split(',')

;(async () => {
  const browser = await chromium.launch({ args: ['--lang=fr-FR'] })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'light', locale: 'fr-FR' })
  const page = await ctx.newPage(); page.setDefaultTimeout(90000)
  await page.goto(BASE + '/auth/signin'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(3000)
  await page.fill('input[type=email]', process.env.ACRA_EMAIL); await page.fill('input[type=password]', process.env.ACRA_PASSWORD)
  await Promise.all([page.waitForURL(u => !u.pathname.startsWith('/auth')), page.press('input[type=password]', 'Enter')])
  for (const p of PAGES) {
    const [nom, url] = p.split(':')
    await page.goto(BASE + url, { waitUntil: 'load' }).catch(() => {})
    await page.waitForTimeout(9000)   // compilation à la demande en développement + chargement des données
    await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' }).catch(() => {})
    const b = page.getByRole('button', { name: 'Compris' }); if (await b.count()) await b.first().click().catch(() => {})
    await page.screenshot({ path: `${OUT}/${nom}.png` }); console.log('capture', nom, page.url())
  }
  await browser.close()
})().catch(e => { console.error(e); process.exit(1) })
