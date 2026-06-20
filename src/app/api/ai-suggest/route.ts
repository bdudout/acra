import { NextRequest, NextResponse } from 'next/server'

// [IA — retiré] Le module de suggestions IA (Anthropic Claude) a été retiré.
// ACRA n'appelle aucune API d'IA externe et ne lit aucune clé API. Cet endpoint
// répond systématiquement « fonctionnalité indisponible ».
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: 'Fonctionnalité IA indisponible' },
    { status: 404 }
  )
}
