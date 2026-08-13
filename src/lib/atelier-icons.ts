import { Target, VenetianMask, Map as MapIcon, Settings, ShieldCheck, type LucideIcon } from 'lucide-react'

// Icônes des 5 ateliers EBIOS RM (index = numéro d'atelier − 1), alignées sur
// l'ordre de ATELIERS_META (lib/ebios-data.ts). Séparé du lib de données pour
// garder ebios-data.ts pur (pas de dépendance React/lucide).
export const ATELIER_ICONS: LucideIcon[] = [Target, VenetianMask, MapIcon, Settings, ShieldCheck]
