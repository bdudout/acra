import { describe, it, expect } from 'vitest'
import { resolvePublicContent, type PublicContentConfig } from '@/lib/public-content'

const DEFAULTS = { notice: 'Défaut notice', contactUrl: '/deployer', contactLabel: 'Déployer' }

describe('resolvePublicContent', () => {
  it('renvoie les défauts quand la config est absente', () => {
    expect(resolvePublicContent(null, DEFAULTS)).toEqual(DEFAULTS)
    expect(resolvePublicContent(undefined, DEFAULTS)).toEqual(DEFAULTS)
    expect(resolvePublicContent({}, DEFAULTS)).toEqual(DEFAULTS)
  })

  it('applique les surcharges non vides', () => {
    const cfg: PublicContentConfig = {
      publicNotice: 'Bienvenue sur notre instance',
      publicContactUrl: 'https://exemple.fr/contact',
      publicContactLabel: 'Nous contacter',
    }
    expect(resolvePublicContent(cfg, DEFAULTS)).toEqual({
      notice: 'Bienvenue sur notre instance',
      contactUrl: 'https://exemple.fr/contact',
      contactLabel: 'Nous contacter',
    })
  })

  it('ignore les surcharges vides / blanches (repli défaut) et trim', () => {
    expect(resolvePublicContent({ publicNotice: '   ', publicContactLabel: '' }, DEFAULTS)).toEqual(DEFAULTS)
    expect(resolvePublicContent({ publicContactLabel: '  Contact  ' }, DEFAULTS).contactLabel).toBe('Contact')
  })

  it('accepte les URLs sûres (http/https/mailto/relatif) et rejette le reste', () => {
    expect(resolvePublicContent({ publicContactUrl: 'https://x.fr' }, DEFAULTS).contactUrl).toBe('https://x.fr')
    expect(resolvePublicContent({ publicContactUrl: 'http://x.fr' }, DEFAULTS).contactUrl).toBe('http://x.fr')
    expect(resolvePublicContent({ publicContactUrl: 'mailto:a@x.fr' }, DEFAULTS).contactUrl).toBe('mailto:a@x.fr')
    expect(resolvePublicContent({ publicContactUrl: '/on-premises' }, DEFAULTS).contactUrl).toBe('/on-premises')
    // schémas dangereux → repli sur le défaut (défense anti-XSS href)
    expect(resolvePublicContent({ publicContactUrl: 'javascript:alert(1)' }, DEFAULTS).contactUrl).toBe('/deployer')
    expect(resolvePublicContent({ publicContactUrl: 'data:text/html,x' }, DEFAULTS).contactUrl).toBe('/deployer')
    expect(resolvePublicContent({ publicContactUrl: 'ftp://x' }, DEFAULTS).contactUrl).toBe('/deployer')
  })
})
