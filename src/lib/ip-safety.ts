// ─── Classification d'adresses et d'hôtes pour la défense SSRF (PUR) ─────────
// Source UNIQUE de vérité pour les gardes réseau sortantes (webhooks, issuer
// SSO/SAML, connecteur d'entités REST/LDAP). Audit 2026-09-30 (N02/N03) : les
// listes de blocage dupliquées laissaient passer `[::ffff:7f00:1]`, `[::]`,
// `localhost.`, 100.64.0.0/10, etc. Ici l'adresse est ANALYSÉE (pas comparée à
// des préfixes textuels) puis testée contre des plages, IPv4-mappée/NAT64/6to4
// ramenées à leur IPv4 embarquée. Fail-closed : toute entrée illisible est privée.

type V4 = [number, number, number, number]

function parseV4(s: string): V4 | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s)
  if (!m) return null
  const o = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])] as V4
  return o.every(n => n <= 255) ? o : null
}

/** IPv4 non routable publiquement (RFC 1918, loopback, link-local, CGNAT, documentation, bench, multicast, réservé). */
function isPrivateV4Octets([a, b, c]: V4): boolean {
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0 && c === 0)
    || (a === 192 && b === 0 && c === 2)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && c === 100)
    || (a === 203 && b === 0 && c === 113)
}

/** Développe une IPv6 en 8 groupes de 16 bits, ou null si invalide. Gère `::` et l'IPv4 finale. */
function parseV6(input: string): number[] | null {
  let s = input
  const pct = s.indexOf('%')
  if (pct >= 0) s = s.slice(0, pct) // zone id
  if (!s.includes(':')) return null
  const lastColon = s.lastIndexOf(':')
  const tail = s.slice(lastColon + 1)
  if (tail.includes('.')) {
    const v4 = parseV4(tail)
    if (!v4) return null
    s = s.slice(0, lastColon + 1) + ((v4[0] << 8) | v4[1]).toString(16) + ':' + ((v4[2] << 8) | v4[3]).toString(16)
  }
  const halves = s.split('::')
  if (halves.length > 2) return null
  const parse = (part: string): number[] | null => {
    if (part === '') return []
    const groups = part.split(':')
    const out: number[] = []
    for (const g of groups) {
      if (!/^[0-9a-f]{1,4}$/.test(g)) return null
      out.push(parseInt(g, 16))
    }
    return out
  }
  const head = parse(halves[0])
  const rest = halves.length === 2 ? parse(halves[1]) : []
  if (!head || !rest) return null
  if (halves.length === 1) return head.length === 8 ? head : null
  const fill = 8 - head.length - rest.length
  if (fill < 1) return null
  return [...head, ...Array<number>(fill).fill(0), ...rest]
}

const v4From = (hi: number, lo: number): V4 => [hi >> 8, hi & 255, lo >> 8, lo & 255]

/**
 * L'adresse IP (v4 ou v6, crochets/zone tolérés) est-elle NON publique ? Couvre
 * loopback, RFC 1918, CGNAT, link-local/métadonnées cloud, ULA, multicast,
 * documentation, `::`, IPv4-mappée (`::ffff:x:y`), compatible, NAT64 et 6to4.
 * Une entrée vide ou illisible est considérée privée (fail-closed).
 */
export function isPrivateIp(ip: string): boolean {
  const h = (ip ?? '').trim().toLowerCase().replace(/^\[|\]$/g, '')
  if (!h) return true
  const v4 = parseV4(h)
  if (v4) return isPrivateV4Octets(v4)
  const g = parseV6(h)
  if (!g) return true
  const zeros5 = g.slice(0, 5).every(x => x === 0)
  if (zeros5 && (g[5] === 0xffff || g[5] === 0)) return isPrivateV4Octets(v4From(g[6], g[7])) // mappée ::ffff:a.b.c.d / compatible ::a.b.c.d (incl. :: et ::1)
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every(x => x === 0)) return isPrivateV4Octets(v4From(g[6], g[7])) // NAT64 64:ff9b::/96
  if (g[0] === 0x2002) return isPrivateV4Octets(v4From(g[1], g[2])) // 6to4
  if ((g[0] & 0xfe00) === 0xfc00) return true // ULA fc00::/7
  if ((g[0] & 0xffc0) === 0xfe80) return true // link-local fe80::/10
  if ((g[0] & 0xffc0) === 0xfec0) return true // site-local déprécié fec0::/10
  if ((g[0] & 0xff00) === 0xff00) return true // multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true // documentation
  return false
}

/**
 * Nom d'hôte manifestement interne : `localhost`, suffixes `.localhost/.local/
 * .internal/.localdomain/.home.arpa/.lan/.corp`, étiquette unique (résolue par
 * le domaine de recherche interne) ; point final toléré. Une IP littérale est
 * jugée par `isPrivateIp`. Ne remplace PAS la vérification de l'IP résolue.
 */
export function isInternalHostname(hostname: string): boolean {
  const host = (hostname ?? '').trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '')
  if (!host) return true
  if (host.includes(':') || parseV4(host)) return isPrivateIp(host)
  if (!host.includes('.')) return true
  // Formes numériques ambiguës (`0x7f.1`, `2130706433`, `127.1`) : les schémas non « spéciaux » (ldaps:) ne les normalisent pas.
  if (/^[0-9a-fx.]+$/.test(host)) return true
  return /\.(localhost|local|internal|localdomain|home\.arpa|lan|corp|intranet)$/.test(host)
}
