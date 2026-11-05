'use client'

// ─── « Rattacher à un axe » depuis /actions (lot S2) ─────────────────────────
// Petit menu listant les axes des stratégies actives (non archivées) non encore rattachés à l'action ; le choix
// appelle POST /api/strategies/[id]/rattachements. Stratégie VALIDEE : la justification est demandée d'abord
// (JustificationDialog, comme sur l'écran de stratégie). Affiché par la vue seulement si le serveur l'autorise
// (rôle `peutRattacherStrategie`, module Stratégie actif, organisation active).
// Accessibilité (motif « menu button ») : focus sur le premier élément à l'ouverture, Haut / Bas (en boucle), Début /
// Fin ; Échap ou un choix referment et rendent le focus au bouton ; un clic à l'extérieur referme.
// Position fixe calculée depuis le bouton : le tableau de /actions défile horizontalement (overflow-x-auto), un menu
// absolu y serait rogné sous la dernière ligne. Défilement ou redimensionnement → fermeture.
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import JustificationDialog from '@/components/strategie/JustificationDialog'
import type { AxeRattache, ActionSource } from '@/lib/action-items'

export interface AxeDisponibleVue extends AxeRattache { strategieStatut: string }

interface Props {
  action: { source: ActionSource; sourceId: string; axes?: AxeRattache[] }
  axes: AxeDisponibleVue[]
  onRattache: () => void
}

export default function RattacherAxeMenu({ action, axes, onRattache }: Props) {
  const { t } = useTranslation()
  const r = t.plansActions.rattacher
  const [ouvert, setOuvert] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const [enAttente, setEnAttente] = useState<AxeDisponibleVue | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const conteneur = useRef<HTMLDivElement>(null)
  const boutonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const menuId = useId()

  const deja = new Set((action.axes ?? []).map(a => a.axeId))
  const proposes = axes.filter(a => !deja.has(a.axeId))

  const elements = () => [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])]
  const fermer = (rendreFocus: boolean) => { setOuvert(false); if (rendreFocus) boutonRef.current?.focus() }

  // Ouverture : focus sur le premier élément du menu.
  useEffect(() => { if (ouvert) elements()[0]?.focus() }, [ouvert])

  // Fermeture au clic extérieur (focus laissé là où l'utilisateur a cliqué) et sur Échap (focus rendu au bouton).
  useEffect(() => {
    if (!ouvert) return
    const clic = (e: MouseEvent) => { if (!conteneur.current?.contains(e.target as Node)) fermer(false) }
    const touche = (e: KeyboardEvent) => { if (e.key === 'Escape') fermer(true) }
    const deplacement = (e: Event) => { if (!(e.target instanceof Node && menuRef.current?.contains(e.target))) fermer(false) }
    document.addEventListener('mousedown', clic)
    document.addEventListener('keydown', touche)
    window.addEventListener('scroll', deplacement, true)
    window.addEventListener('resize', deplacement)
    return () => {
      document.removeEventListener('mousedown', clic); document.removeEventListener('keydown', touche)
      window.removeEventListener('scroll', deplacement, true); window.removeEventListener('resize', deplacement)
    }
  }, [ouvert])

  // Le message (succès du dernier rattachement possible, ou erreur) reste visible même sans axe restant.
  if (proposes.length === 0 && !message) return null

  function onMenuKeyDown(e: React.KeyboardEvent<HTMLUListElement>) {
    const el = elements()
    if (!el.length) return
    const i = el.indexOf(document.activeElement as HTMLButtonElement)
    let cible: number | null = null
    if (e.key === 'ArrowDown') cible = (i + 1) % el.length
    else if (e.key === 'ArrowUp') cible = (i - 1 + el.length) % el.length
    else if (e.key === 'Home') cible = 0
    else if (e.key === 'End') cible = el.length - 1
    else if (e.key === 'Tab') { fermer(false); return }
    if (cible === null) return
    e.preventDefault()
    el[cible].focus()
  }

  async function envoyer(axe: AxeDisponibleVue, justification?: string) {
    setEnAttente(null); setEnvoi(true); setMessage(null)
    try {
      const res = await fetch(`/api/strategies/${encodeURIComponent(axe.strategieId)}/rattachements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ axeId: axe.axeId, sourceType: action.source, sourceId: action.sourceId, ...(justification ? { justification } : {}) }),
      })
      if (res.ok) {
        setMessage({ ok: true, texte: r.ok.replace('{axe}', axe.axeTitre) })
        onRattache()
      } else {
        const d = (await res.json().catch(() => ({}))) as { error?: string }
        setMessage({ ok: false, texte: d.error === 'deja_rattache' ? r.deja : r.erreur })
      }
    } catch {
      setMessage({ ok: false, texte: r.erreur })
    } finally {
      setEnvoi(false)
    }
  }

  function choisir(axe: AxeDisponibleVue) {
    fermer(true)
    if (axe.strategieStatut === 'VALIDEE') setEnAttente(axe)
    else void envoyer(axe)
  }

  return (
    <div ref={conteneur} className="relative inline-block">
      {proposes.length > 0 && <button ref={boutonRef} type="button" disabled={envoi} aria-haspopup="menu" aria-expanded={ouvert} aria-controls={ouvert ? menuId : undefined}
        onClick={() => {
          const b = boutonRef.current?.getBoundingClientRect()
          if (b) setPos({ top: b.bottom + 4, right: Math.max(8, window.innerWidth - b.right) })
          setOuvert(o => !o)
        }}
        className="text-xs font-medium text-gray-600 hover:text-gray-900 hover:underline disabled:opacity-50 dark:text-gray-300">
        {r.bouton}
      </button>}
      {ouvert && proposes.length > 0 && (
        <ul ref={menuRef} id={menuId} role="menu" aria-label={r.menu} onKeyDown={onMenuKeyDown}
          style={pos ? { top: pos.top, right: pos.right } : undefined}
          className="fixed z-50 max-h-64 w-72 max-w-[min(24rem,90vw)] overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {proposes.map(a => (
            <li key={a.axeId} role="none">
              <button type="button" role="menuitem" tabIndex={-1} onClick={() => choisir(a)}
                className="block w-full whitespace-normal break-words px-3 py-1.5 text-left text-xs text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700">
                <span className="text-gray-500 dark:text-gray-400">{a.strategieTitre}</span> — {a.axeTitre}
                {a.strategieStatut === 'VALIDEE' && <span className="ml-1 text-[10px] uppercase text-amber-700 dark:text-amber-300">({r.validee})</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {message && <p role={message.ok ? 'status' : 'alert'} className={`mt-1 text-xs ${message.ok ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{message.texte}</p>}
      {enAttente && <JustificationDialog onConfirm={j => void envoyer(enAttente, j)} onCancel={() => setEnAttente(null)} />}
    </div>
  )
}
