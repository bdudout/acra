// ─── Lecture d'un fichier choisi par l'utilisateur, encodé en base64 (imports) ─
/** Lecture d'un fichier ou d'un fragment : `arrayBuffer()` si disponible, sinon FileReader (anciens navigateurs). */
export function readBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer().then(b => new Uint8Array(b))
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer)); reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
}

export async function toBase64(file: Blob): Promise<string> {
  const bytes = await readBytes(file)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}
