/**
 * Route API temporaire — dev uniquement
 * Prend un screenshot de la fenêtre Chrome via screencapture macOS
 * OU reçoit une image base64 et la sauvegarde dans docs/screenshots/
 * N'est accessible qu'en NODE_ENV=development
 */
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const body = await req.json() as { filename: string; data?: string; captureScreen?: boolean }
  const { filename, data, captureScreen } = body

  // Sécurité : nom de fichier simple uniquement
  if (!/^[\w\-]+\.(png|jpg|jpeg|gif)$/.test(filename)) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
  }

  const screenshotsDir = path.join(process.cwd(), 'docs', 'screenshots')
  fs.mkdirSync(screenshotsDir, { recursive: true })
  const outPath = path.join(screenshotsDir, filename)

  if (captureScreen) {
    // Capturer la fenêtre Chrome via screencapture macOS
    try {
      // Récupérer l'ID de la fenêtre Chrome via AppleScript
      const winId = execSync(
        `osascript -e 'tell application "Google Chrome" to id of window 1'`
      ).toString().trim()
      // -x = pas de son, -l = capture une fenêtre spécifique par ID
      execSync(`screencapture -x -t png -l ${winId} "${outPath}"`)
      return NextResponse.json({ ok: true, path: `docs/screenshots/${filename}`, method: 'screencapture' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  if (data) {
    // Mode base64 (fallback)
    const buffer = Buffer.from(data, 'base64')
    fs.writeFileSync(outPath, buffer)
    return NextResponse.json({ ok: true, path: `docs/screenshots/${filename}`, method: 'base64' })
  }

  return NextResponse.json({ error: 'Either data or captureScreen required' }, { status: 400 })
}
