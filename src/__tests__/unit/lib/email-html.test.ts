import { describe, it, expect } from 'vitest'
import { escapeHtml, emailLayout } from '@/lib/email-html'

describe('escapeHtml', () => {
  it('échappe les caractères actifs', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(escapeHtml('a & b')).toBe('a &amp; b')
    expect(escapeHtml('dit "bonjour"')).toBe('dit &quot;bonjour&quot;')
    expect(escapeHtml("l'accès")).toBe('l&#39;accès')
  })
  it('null / undefined → chaîne vide', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })
  it('conserve les accents', () => {
    expect(escapeHtml('Dérogation expirée')).toBe('Dérogation expirée')
  })
})

describe('emailLayout', () => {
  it('produit une mise en page table + styles inline', () => {
    const html = emailLayout({ heading: 'Titre', paragraphs: ['Bonjour'] })
    expect(html).toContain('<table')
    expect(html).toContain('role="presentation"')
    expect(html).toContain('Titre')
    expect(html).toContain('Bonjour')
    // pas de <style> ni de flexbox : incompatibles Outlook
    expect(html.includes('<style')).toBe(false)
    expect(html.includes('display:flex')).toBe(false)
  })
  it('échappe le titre, les paragraphes, le pied et les stats', () => {
    const html = emailLayout({
      heading: '<b>H</b>', paragraphs: ['<i>p</i>'], footer: '<u>f</u>',
      stats: [{ label: '<s>l</s>', value: '<em>v</em>' }],
    })
    expect(html.includes('<b>H</b>')).toBe(false)
    expect(html).toContain('&lt;b&gt;H&lt;/b&gt;')
    expect(html.includes('<i>p</i>')).toBe(false)
    expect(html.includes('<u>f</u>')).toBe(false)
    expect(html.includes('<s>l</s>')).toBe(false)
    expect(html.includes('<em>v</em>')).toBe(false)
  })
  it('échappe les éléments de liste (intitulés fournis par l\'utilisateur)', () => {
    const html = emailLayout({ heading: 'H', items: [{ label: '<img src=x onerror=alert(1)>', detail: '<b>5 j</b>' }] })
    expect(html.includes('<img')).toBe(false)
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html.includes('<b>5 j</b>')).toBe(false)
  })
  it('applique la couleur de ton', () => {
    expect(emailLayout({ heading: 'H', tone: 'danger' })).toContain('#DC2626')
    expect(emailLayout({ heading: 'H', tone: 'success' })).toContain('#16A34A')
    expect(emailLayout({ heading: 'H' })).toContain('#4338CA') // neutre par défaut
  })
  it('sections optionnelles absentes si non fournies', () => {
    const html = emailLayout({ heading: 'H' })
    expect(html).toContain('H')
    expect(html.includes('border-bottom:1px solid #f3f4f6')).toBe(false) // aucune liste
  })
  it('titre de liste rendu quand fourni', () => {
    const html = emailLayout({ heading: 'H', itemsTitle: 'À traiter', items: [{ label: 'x' }] })
    expect(html).toContain('À traiter')
  })

  it('bloc code : monospace, valeur et libellé présents', () => {
    const html = emailLayout({ heading: 'H', code: { value: 'A1B2C3', label: 'Votre code' } })
    expect(html).toContain('A1B2C3')
    expect(html).toContain('Votre code')
    expect(html).toContain('monospace')
    expect(html).toContain('letter-spacing')
  })
  it('bloc code : valeur échappée (secret contenant du HTML)', () => {
    const html = emailLayout({ heading: 'H', code: { value: '<b>pw&1</b>' } })
    expect(html.includes('<b>pw')).toBe(false)
    expect(html).toContain('&lt;b&gt;pw&amp;1&lt;/b&gt;')
  })
  it('bloc code absent si non fourni', () => {
    expect(emailLayout({ heading: 'H' }).includes('letter-spacing')).toBe(false)
  })
})
