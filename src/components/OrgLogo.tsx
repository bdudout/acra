import { orgInitials, orgLogoColors, hashSeed } from '@/lib/org-logo'

/**
 * OrgLogo — Logo généré automatiquement pour une organisation : dégradé déterministe
 * (dérivé de l'id) + monogramme. Aucune dépendance réseau, rendu serveur ou client.
 */
export default function OrgLogo({
  id, nom, logo, size = 24, className = '',
}: { id: string; nom: string; logo?: string | null; size?: number; className?: string }) {
  // Logo personnalisé (data URL) prioritaire sur le logo auto-généré.
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" width={size} height={size} className={`object-cover ${className}`} aria-hidden="true" />
  }
  const seed = id || nom || '?'
  const { from, to } = orgLogoColors(seed)
  const initials = orgInitials(nom)
  const gid = `orglogo-${hashSeed(seed).toString(36)}`
  const r = size * 0.24 // coins arrondis

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden="true" role="presentation">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="100" rx={r * (100 / size)} fill={`url(#${gid})`} />
      {/* Touche graphique : un cercle translucide décalé (look « logo »). */}
      <circle cx={hashSeed(seed) % 100} cy={(hashSeed(seed) >> 5) % 100} r="34" fill="#ffffff" fillOpacity="0.14" />
      <text x="50" y="54" textAnchor="middle" dominantBaseline="central"
        fontSize="42" fontWeight="700" fill="#ffffff" fontFamily="system-ui, sans-serif">
        {initials}
      </text>
    </svg>
  )
}
