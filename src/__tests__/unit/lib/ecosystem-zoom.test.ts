import { describe, it, expect } from 'vitest'
import {
  clampZoom, viewBox, clampPan, zoomAtCursor, panByPixels,
  ZOOM_MIN, ZOOM_MAX, type Box,
} from '@/lib/ecosystem-zoom'

const BASE: Box = { x: -58, y: 0, w: 596, h: 480 }

describe('ecosystem-zoom', () => {
  it('clampZoom borne dans [MIN, MAX]', () => {
    expect(clampZoom(0.2)).toBe(ZOOM_MIN)
    expect(clampZoom(99)).toBe(ZOOM_MAX)
    expect(clampZoom(2)).toBe(2)
  })

  it('viewBox à zoom 1 / pan 0 = cadre de base', () => {
    expect(viewBox(BASE, 1, 0, 0)).toEqual(BASE)
  })

  it('viewBox à zoom 2 = moitié de taille, recentré', () => {
    const vb = viewBox(BASE, 2, 0, 0)
    expect(vb.w).toBe(BASE.w / 2)
    expect(vb.h).toBe(BASE.h / 2)
    // même centre que le cadre de base
    expect(vb.x + vb.w / 2).toBeCloseTo(BASE.x + BASE.w / 2, 6)
    expect(vb.y + vb.h / 2).toBeCloseTo(BASE.y + BASE.h / 2, 6)
  })

  it('clampPan empêche le centre de sortir du cadre', () => {
    expect(clampPan(BASE, 10000, -10000)).toEqual({ panX: BASE.w / 2, panY: -BASE.h / 2 })
    expect(clampPan(BASE, 5, -7)).toEqual({ panX: 5, panY: -7 })
  })

  it('zoomAtCursor garde le point sous le curseur fixe', () => {
    const px = 0.25, py = 0.5
    const before = viewBox(BASE, 1, 0, 0)
    const ux = before.x + px * before.w
    const uy = before.y + py * before.h
    const next = zoomAtCursor(BASE, 1, 0, 0, 2, px, py)
    expect(next.zoom).toBe(2)
    const after = viewBox(BASE, next.zoom, next.panX, next.panY)
    // le point invariant retombe sous le même curseur
    expect(after.x + px * after.w).toBeCloseTo(ux, 4)
    expect(after.y + py * after.h).toBeCloseTo(uy, 4)
  })

  it('zoomAtCursor respecte les bornes de zoom', () => {
    expect(zoomAtCursor(BASE, ZOOM_MAX, 0, 0, ZOOM_MAX * 2, 0.5, 0.5).zoom).toBe(ZOOM_MAX)
    expect(zoomAtCursor(BASE, 1, 0, 0, 0.1, 0.5, 0.5).zoom).toBe(ZOOM_MIN)
  })

  it('panByPixels convertit un glisser pixels en delta viewBox (zoom pris en compte)', () => {
    // À zoom 2, la vue fait la moitié de la largeur base : glisser d'un quart de
    // la largeur pixel déplace d'un quart de la largeur viewBox visible.
    const rectW = 800, rectH = 640
    const res = panByPixels(BASE, 2, 0, 0, rectW / 4, 0, rectW, rectH)
    const vb = viewBox(BASE, 2, 0, 0)
    expect(res.panX).toBeCloseTo(-(0.25) * vb.w, 6)
  })
})
