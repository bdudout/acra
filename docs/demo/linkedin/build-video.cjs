// ─── Vidéo LinkedIn « ACRA — dernières évolutions » ───────────────────────────
// node docs/demo/linkedin/build-video.cjs  →  docs/demo/linkedin/acra-linkedin.mp4 (1080 × 1350, 4:5, sans son)
// Chaque scène : bandeau de texte (rendu par Chromium, net) au-dessus d'une capture de l'application animée par un
// léger zoom (ffmpeg zoompan), puis fondus enchaînés. Prérequis : ffmpeg ; captures dans ../captures et ./captures.
const path = require('node:path')
const fs = require('node:fs')
const { execFileSync } = require('node:child_process')
const { chromium } = require(path.join(__dirname, '../../../node_modules/playwright'))

const DIR = __dirname
const TMP = path.join(DIR, '.build')
const W = 1080, H = 1350, BAND = 430, FPS = 30, FONDU = 0.5
const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(DIR, '../../../public/logo-mark.png')).toString('base64')
const C = n => path.join(DIR, 'captures', n), D = n => path.join(DIR, '../captures', n)

// focus : position horizontale du cadrage dans la capture (0 = gauche, 1 = droite) ; y : idem en vertical.
const SCENES = [
  { carte: true, d: 3.6, kicker: 'Nouveautés', titre: 'ACRA', sous: 'La gestion des risques,<br>pas seulement cyber.' },
  { img: C('pilotage.png'), d: 4.2, focus: 0.12, y: 0.12, kicker: 'Risque business', titre: 'Pas seulement cyber', sous: 'Opérationnel, métier, projet, fraude, externalisation, IT : une seule vue consolidée.' },
  { img: D('06-page-projet.png'), d: 4.2, focus: 0.12, y: 0.08, kicker: 'Projets 360', titre: 'Tout le risque d’un projet', sous: 'Météo, matrice brut / actuel / résiduel, plans d’action avant la mise en service.' },
  { img: D('17-analyse-reprise.png'), d: 4.2, focus: 0.12, y: 0.005, zoom: 0.75, kicker: 'Multi-méthode', titre: 'Pas seulement EBIOS RM', sous: 'EBIOS RM · ISO/IEC 27005 · ISO 31000 · NIST SP 800-30' },
  { img: C('conformite.png'), d: 4.2, focus: 0.12, y: 0.06, zoom: 0.8, kicker: 'GRC', titre: 'Toute la GRC, module par module', sous: 'Conformité, contrôle permanent, audit interne, incidents, réglementaire… à activer selon vos besoins.' },
  { img: C('incidents.png'), d: 3.6, focus: 0.12, y: 0.2, zoom: 0.8, kicker: 'Incidents', titre: 'Déclarer sans stress', sous: 'DORA, NIS2, RGPD et autres régimes : délais, relances, exports.' },
  { img: C('registre-ia.png'), d: 3.6, focus: 0.12, y: 0.25, zoom: 0.8, kicker: 'Registres', titre: 'Risques, TIC, RGPD, IA, tiers', sous: 'Classement indicatif au regard du règlement (UE) 2024/1689 sur l’IA.' },
  { carte: true, d: 4.2, kicker: 'IA native', titre: 'Aucune IA dans ACRA.', sous: 'Vos données restent chez vous.<br><b>Mais ACRA est faite pour travailler avec la vôtre.</b>' },
  { img: D('04-propositions-risques.png'), d: 4.4, focus: 0.5, y: 0.03, zoom: 0.9, kicker: 'Serveur MCP', titre: 'L’assistant propose, l’humain valide', sous: 'Claude, Codex, Mistral… ou une IA locale et souveraine. Rien n’est écrit sans validation.' },
  { img: D('13-propositions-analyse-pssi.png'), d: 4.4, focus: 0.5, y: 0.1, zoom: 0.9, kicker: 'Migration assistée', titre: 'Reprenez l’existant avec une IA', sous: 'Analyses historiques, expressions de besoins, PSSI → référentiel de mesures et conformité.' },
  { img: D('17-analyse-reprise.png'), d: 3.8, focus: 0.2, y: 0.72, zoom: 0.75, kicker: 'Résultat', titre: 'Prête à piloter', sous: 'Risques cotés, matrice, plan d’action : l’analyse reprise vit dans ACRA.' },
  { carte: true, d: 5.0, kicker: 'Open source', titre: 'Gratuit. Licence MIT.', sous: 'Pour les PME comme pour les grands groupes.<br><b>github.com/bdudout/acra</b>' },
]

const css = `*{margin:0;box-sizing:border-box}body{width:${W}px;font-family:-apple-system,"SF Pro Display","Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased}
.bg{background:radial-gradient(120% 90% at 0% 0%,#4338ca 0%,#312e81 45%,#1e1b4b 100%);color:#fff;position:relative;overflow:hidden}
.kicker{display:inline-block;font-size:24px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#c7d2fe;background:rgba(255,255,255,.1);border:1px solid rgba(199,210,254,.35);padding:8px 18px;border-radius:999px}
.logo{position:absolute;top:44px;right:56px;width:64px;height:64px;opacity:.95}
.glow{position:absolute;right:-180px;bottom:-220px;width:560px;height:560px;border-radius:50%;background:radial-gradient(circle,rgba(129,140,248,.45),transparent 65%)}`

function bandeHtml(s) {
  return `<html><head><style>${css}
  .b{height:${BAND}px;padding:52px 64px 0}.t{font-size:62px;font-weight:800;line-height:1.08;margin-top:26px;letter-spacing:-.01em}
  .s{font-size:30px;line-height:1.35;color:#e0e7ff;margin-top:18px;max-width:900px}
  .fade{position:absolute;left:0;right:0;bottom:0;height:6px;background:linear-gradient(90deg,#818cf8,#c084fc,#22d3ee)}</style></head>
  <body><div class="bg b"><div class="glow"></div><img class="logo" src="${logo}"><span class="kicker">${s.kicker}</span>
  <div class="t">${s.titre}</div><div class="s">${s.sous}</div><div class="fade"></div></div></body></html>`
}
function carteHtml(s) {
  return `<html><head><style>${css}
  .c{height:${H}px;display:flex;flex-direction:column;justify-content:center;padding:0 90px}
  .big{width:150px;height:150px;margin-bottom:48px}.t{font-size:${s.titre.length < 8 ? 150 : 84}px;font-weight:800;line-height:1.05;margin-top:30px;letter-spacing:-.02em}
  .s{font-size:44px;line-height:1.3;color:#e0e7ff;margin-top:34px}.s b{color:#fff}
  .bar{position:absolute;left:90px;bottom:120px;width:180px;height:8px;border-radius:4px;background:linear-gradient(90deg,#818cf8,#c084fc,#22d3ee)}</style></head>
  <body><div class="bg c"><div class="glow"></div><img class="big" src="${logo}"><div><span class="kicker">${s.kicker}</span></div>
  <div class="t">${s.titre}</div><div class="s">${s.sous}</div><div class="bar"></div></div></body></html>`
}

const ff = args => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...args], { stdio: 'inherit' })
const dims = f => execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f]).toString().trim().split(',').map(Number)

;(async () => {
  fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
  const clips = []
  for (const [i, s] of SCENES.entries()) {
    const png = path.join(TMP, `txt-${i}.png`), out = path.join(TMP, `clip-${i}.mp4`)
    await page.setViewportSize({ width: W, height: s.carte ? H : BAND })
    await page.setContent(s.carte ? carteHtml(s) : bandeHtml(s)); await page.waitForTimeout(150)
    await page.screenshot({ path: png })
    const n = Math.round(s.d * FPS)
    if (s.carte) {
      // Carte plein écran : léger zoom lent pour éviter un plan figé.
      ff(['-loop', '1', '-i', png, '-vf', `scale=${W * 2}:-1,zoompan=z='1+0.04*on/${n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${n}:s=${W}x${H}:fps=${FPS},format=yuv420p`, '-frames:v', String(n), '-c:v', 'libx264', '-crf', '16', out])
    } else {
      // Capture : cadrage au ratio de la zone sous le bandeau, puis zoom lent de 1 à 1,07.
      const [iw, ih] = dims(s.img), zh = H - BAND, ratio = W / zh
      // Cadrage resserré (zoom = part de la hauteur d'un écran 1440 × 900 conservée) pour rester lisible sur mobile.
      const ch2 = Math.min(ih, Math.round(1800 * (s.zoom ?? 0.6))), cw = Math.min(iw, Math.round(ch2 * ratio))
      const cx = Math.round((iw - cw) * (s.focus ?? 0)), cy2 = Math.round((ih - ch2) * (s.y ?? 0))
      const vf = `[0:v]crop=${cw}:${ch2}:${cx}:${cy2},scale=${W * 2}:${zh * 2},zoompan=z='1+0.07*on/${n}':x='iw/2-(iw/zoom/2)':y='ih/3-(ih/zoom/3)':d=${n}:s=${W}x${zh}:fps=${FPS},pad=${W}:${H}:0:${BAND}:white[v];[v][1:v]overlay=0:0,format=yuv420p`
      ff(['-loop', '1', '-i', s.img, '-loop', '1', '-i', png, '-filter_complex', vf, '-frames:v', String(n), '-c:v', 'libx264', '-crf', '16', out])
    }
    clips.push({ out, d: s.d }); console.log('scène', i + 1, '/', SCENES.length)
  }
  await browser.close()
  // Fondus enchaînés.
  let graph = '', prev = '[0:v]', t = clips[0].d
  for (let i = 1; i < clips.length; i++) {
    const lab = i === clips.length - 1 ? '[vout]' : `[x${i}]`
    graph += `${prev}[${i}:v]xfade=transition=fade:duration=${FONDU}:offset=${(t - FONDU).toFixed(3)}${lab};`
    prev = lab; t += clips[i].d - FONDU
  }
  const final = path.join(DIR, 'acra-linkedin.mp4')
  ff([...clips.flatMap(c => ['-i', c.out]), '-filter_complex', graph.replace(/;$/, ''), '-map', '[vout]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(FPS), final])
  ff(['-ss', '14', '-i', final, '-frames:v', '1', path.join(DIR, 'apercu.png')])
  fs.rmSync(TMP, { recursive: true, force: true })
  console.log('vidéo', final, `${t.toFixed(1)} s`)
})().catch(e => { console.error(e); process.exit(1) })
