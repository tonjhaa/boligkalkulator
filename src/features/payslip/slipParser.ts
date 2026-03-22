import type { ParsetLonnsslipp } from '@/types/economy'
import { parseForsvarsSlipp } from '@/domain/economy/salaryCalculator'
// Vite løser dette til en hashed lokal URL i bundles — ingen CDN-avhengighet
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

/**
 * Ekstraherer tekst fra PDF ved hjelp av pdfjs-dist og parser lønnsslippen.
 */
export async function parseSlipFromPDF(file: File): Promise<ParsetLonnsslipp> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const allLines: string[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()

    // Grupper items etter Y-posisjon (transform[5]).
    // PDF-koordinater øker oppover, så vi sorterer synkende (øverst = størst Y).
    // Runder til nærmeste 2pt for å slå sammen items som er minimalt vertikalt forskjøvet.
    const lineMap = new Map<number, string[]>()
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue
      const y = Math.round((item as { str: string; transform: number[] }).transform[5] / 2) * 2
      if (!lineMap.has(y)) lineMap.set(y, [])
      lineMap.get(y)!.push(item.str.trim())
    }

    const sortedYs = [...lineMap.keys()].sort((a, b) => b - a)
    for (const y of sortedYs) {
      allLines.push(lineMap.get(y)!.join(' '))
    }
  }

  const fullText = allLines.join('\n')
  console.log('[slipParser] Rekonstruerte linjer:\n', fullText)
  return parseForsvarsSlipp(fullText)
}
