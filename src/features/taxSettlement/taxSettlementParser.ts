import type { TaxSettlementRecord } from '@/types/economy'
// Vite løser dette til en hashed lokal URL i bundles — ingen CDN-avhengighet
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

function parseNOK(s: string): number {
  return parseInt(s.replace(/\s+/g, ''), 10)
}

/**
 * Ekstraherer tekst fra et Skatteetaten Skatteoppgjør-PDF og parser det til TaxSettlementRecord.
 */
export async function parseTaxSettlementFromPDF(file: File): Promise<TaxSettlementRecord> {
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
  console.log('[taxSettlementParser] Rekonstruerte linjer:\n', fullText)
  return parseTaxSettlementText(fullText)
}

/**
 * Parser tekst fra et norsk Skatteetaten Skatteoppgjør-dokument.
 *
 * Konvensjon for skattTilGodeEllerRest:
 * - Positivt = til gode (du får penger tilbake)
 * - Negativt = restskatt (du skylder penger)
 */
export function parseTaxSettlementText(text: string): TaxSettlementRecord {
  // --- År ---
  const yearMatch = text.match(/Skatteoppgj[øo]r for (\d{4})/)
  if (!yearMatch) {
    throw new Error('Kunne ikke bestemme inntektsår fra dokumentet. Er dette et Skatteoppgjør fra Skatteetaten?')
  }
  const year = parseInt(yearMatch[1], 10)

  // --- Til gode / Restskatt ---
  // Prøv det fremtredende avsnittet øverst i dokumentet først
  let skattTilGodeEllerRest = 0

  const tilGodeMatch = text.match(/Til gode[:\s]+([\d\s]+)\s*kr/i)
  const restskatteMatch = text.match(/Restskatt[:\s]+([\d\s]+)\s*kr/i)

  if (tilGodeMatch) {
    skattTilGodeEllerRest = parseNOK(tilGodeMatch[1])   // positivt = til gode
  } else if (restskatteMatch) {
    skattTilGodeEllerRest = -parseNOK(restskatteMatch[1])  // negativt = restskatt
  } else {
    // Fallback: avregningstabell nederst i dokumentet
    // Søk etter linje som starter med "Til gode" etterfulgt av tall
    const avregningTilGode = text.match(/^Til gode\s+([\d\s]+)/m)
    const avregningRestskatt = text.match(/^Restskatt\s+([\d\s]+)/m)
    if (avregningTilGode) {
      skattTilGodeEllerRest = parseNOK(avregningTilGode[1])
    } else if (avregningRestskatt) {
      skattTilGodeEllerRest = -parseNOK(avregningRestskatt[1])
    }
  }

  // --- Pensjonsgivende inntekt ---
  let pensjonsgivendeInntekt: number | undefined
  const pensjonsgivendeMatch = text.match(/Pensjonsgivende inntekt\s+([\d\s]+)/)
  if (pensjonsgivendeMatch) {
    pensjonsgivendeInntekt = parseNOK(pensjonsgivendeMatch[1])
  }

  // --- Alminnelig inntekt ---
  let alminneligInntekt: number | undefined
  const alminneligMatch = text.match(/Alminnelig inntekt f[øo]r s[æa]rfradrag\s+([\d\s]+)/)
  if (alminneligMatch) {
    alminneligInntekt = parseNOK(alminneligMatch[1])
  }

  // --- Beregnet skatt ---
  let beregnetSkatt: number | undefined
  // Prøv 2024-format først
  const beregnetSkattOgAvgiftMatch = text.match(/Beregnet skatt og avgift\s+([\d\s]+)/)
  if (beregnetSkattOgAvgiftMatch) {
    beregnetSkatt = parseNOK(beregnetSkattOgAvgiftMatch[1])
  } else {
    const beregnetSkattMatch = text.match(/Beregnet skatt\s+([\d\s]+)/)
    if (beregnetSkattMatch) {
      beregnetSkatt = parseNOK(beregnetSkattMatch[1])
    }
  }

  // --- Forskuddstrekk ---
  let forskuddstrekk: number | undefined
  const forskuddstrekkMatch = text.match(/Forskuddstrekk\s+([\d\s]+)/)
  if (forskuddstrekkMatch) {
    forskuddstrekk = parseNOK(forskuddstrekkMatch[1])
  }

  return {
    year,
    pensjonsgivendeInntekt,
    alminneligInntekt,
    skattInnbetalt: forskuddstrekk,
    skattTilGodeEllerRest,
    skattBetalt: beregnetSkatt,
  }
}
