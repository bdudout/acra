'use client'

import { createContext, useContext } from 'react'
import type { Branding } from '@/lib/branding'

// Identité de l'app fournie par le layout serveur (résolue depuis la config) →
// consommée par les composants client (Navbar, page de connexion…). Pas de fetch
// côté client (SSR, aucun flash). Défaut ACRA si le provider est absent.
const BrandingContext = createContext<Branding>({ nom: 'ACRA', baseline: 'Augmented Cyber Risk Analysis' })

export function BrandingProvider({ value, children }: { value: Branding; children: React.ReactNode }) {
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>
}

export function useBranding(): Branding {
  return useContext(BrandingContext)
}
