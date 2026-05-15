import type { ParsetLonnsslipp } from '@/types/economy'
import { parseForsvarsSlipp } from '@/domain/economy/salaryCalculator'
import { parseGenericSlipp, isForsvarsSlipp } from '@/domain/economy/genericSlipParser'
// Vite løser dette til en hashed lokal URL i bundles — ingen CDN-avhengighet
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

async function extractTextFromPDF(file: File): Promise<string> {
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

  return allLines.join('\n')
}

/**
 * Ekstraherer tekst fra PDF og parser lønnsslippen.
 * Velger automatisk parser basert på format-deteksjon.
 */
export async function parseSlipFromPDF(file: File): Promise<ParsetLonnsslipp> {
  const fullText = await extractTextFromPDF(file)
  if (isForsvarsSlipp(fullText)) {
    return parseForsvarsSlipp(fullText)
  }
  return parseGenericSlipp(fullText)
}

/**
 * Parser lønnsslipp med AI via Supabase Edge Function.
 * Krever at bruker har lagt inn sin egen Anthropic API-nøkkel i Innstillinger.
 */
export async function parseSlipFromPDFWithAI(
  file: File,
  anthropicApiKey: string,
  supabaseUrl: string,
  supabaseAnonKey: string,
): Promise<ParsetLonnsslipp> {
  const fullText = await extractTextFromPDF(file)

  const response = await fetch(`${supabaseUrl}/functions/v1/parse-payslip`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'X-Anthropic-Key': anthropicApiKey,
    },
    body: JSON.stringify({ text: fullText }),
  })

  if (!response.ok) {
    const err = await response.text().catch(() => 'Ukjent feil')
    throw new Error(`AI-parsing feilet: ${err}`)
  }

  return response.json() as Promise<ParsetLonnsslipp>
}
