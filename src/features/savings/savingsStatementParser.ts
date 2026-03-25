import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { parseBankStatement, parseBankStatementFromCSV } from '@/domain/economy/bankTransactionParser'
import type { ParsedBankStatement } from '@/domain/economy/bankTransactionParser'

export async function parseSavingsStatement(file: File): Promise<ParsedBankStatement> {
  if (file.name.endsWith('.csv') || file.type === 'text/csv') {
    return parseSavingsStatementFromCSV(file)
  }
  return parseSavingsStatementFromPDF(file)
}

async function parseSavingsStatementFromCSV(file: File): Promise<ParsedBankStatement> {
  // Prøv UTF-8 først, fall tilbake til windows-1252 (norske tegn)
  let text: string
  try {
    const buf = await file.arrayBuffer()
    text = new TextDecoder('windows-1252').decode(buf)
    // Sanity-sjekk: fins det norske tegn?
    if (!text.includes(';')) throw new Error('ikke CSV')
  } catch {
    text = await file.text()
  }
  const parsed = parseBankStatementFromCSV(text)
  ;(parsed as ParsedBankStatement & { _rawText?: string })._rawText = text.slice(0, 500)
  return parsed
}

export async function parseSavingsStatementFromPDF(file: File): Promise<ParsedBankStatement> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const allLines: string[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()

    // Grupper tekst-items etter Y-posisjon (samme som for lønnsslipper)
    const lineMap = new Map<number, { x: number; str: string }[]>()
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue
      const transform = (item as { str: string; transform: number[] }).transform
      const y = Math.round(transform[5] / 2) * 2
      const x = transform[4]
      if (!lineMap.has(y)) lineMap.set(y, [])
      lineMap.get(y)!.push({ x, str: item.str.trim() })
    }

    // Sorter linjer topp-til-bunn, og innen hver linje venstre-til-høyre
    const sortedYs = [...lineMap.keys()].sort((a, b) => b - a)
    for (const y of sortedYs) {
      const items = lineMap.get(y)!.sort((a, b) => a.x - b.x)
      allLines.push(items.map((i) => i.str).join(' '))
    }
  }

  const fullText = allLines.join('\n')
  console.log('[savingsStatementParser] Ekstrahert tekst:\n', fullText)

  const parsed = parseBankStatement(fullText)
  // Legg ved rå tekst for debugging ved feil
  ;(parsed as ParsedBankStatement & { _rawText?: string })._rawText = fullText
  return parsed
}
