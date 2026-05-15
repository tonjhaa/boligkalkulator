const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-anthropic-key',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const apiKey = req.headers.get('x-anthropic-key')
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Mangler X-Anthropic-Key header' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let text: string
  try {
    const body = await req.json() as { text?: unknown }
    if (typeof body.text !== 'string' || !body.text.trim()) {
      throw new Error('Mangler felt: text')
    }
    text = body.text
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const prompt = `Du er en ekspert på norske lønnsslipper. Ekstraher følgende felt fra lønnsslippen under og returner KUN gyldig JSON uten forklaring.

Felt som skal ekstraheres:
- periode: { year: number, month: number }  (måned 1–12)
- maanedslonn: number  (grunnlønn / fastlønn per måned, 0 hvis ikke funnet)
- bruttoSum: number  (total bruttolønn inkl. tillegg)
- skattetrekk: number  (positivt tall)
- pensjonstrekk: number  (positivt tall)
- fagforeningskontingent: number  (positivt tall)
- nettoUtbetalt: number  (positivt tall)
- feriepengegrunnlag: number  (YTD, positivt tall)

Tall skal være norske kroner uten tusenskille og uten desimaler.
Returner JSON på formen:
{"periode":{"year":2026,"month":1},"maanedslonn":55000,"bruttoSum":60000,"skattetrekk":15000,"pensjonstrekk":2000,"fagforeningskontingent":500,"nettoUtbetalt":42500,"feriepengegrunnlag":180000}

Lønnsslipp:
${text.slice(0, 8000)}`

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text()
    return new Response(JSON.stringify({ error: `Anthropic API feil: ${errText}` }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const anthropicData = await anthropicRes.json() as {
    content: Array<{ type: string; text: string }>
  }
  const rawText = anthropicData.content?.[0]?.text ?? ''

  let parsed: Record<string, unknown>
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Ingen JSON i svar')
    parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
  } catch {
    return new Response(JSON.stringify({ error: 'Klarte ikke parse AI-svar', raw: rawText }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Bygg fullstendig ParsetLonnsslipp med nullverdier for felt som ikke finnes
  const periode = (parsed.periode as { year: number; month: number }) ?? { year: new Date().getFullYear(), month: new Date().getMonth() + 1 }
  const result = {
    periode,
    ansattnummer: '',
    loennstrinn: 0,
    maanedslonn: Number(parsed.maanedslonn) || 0,
    fasteTillegg: [],
    trekk: [],
    bruttoSum: Number(parsed.bruttoSum) || 0,
    nettoUtbetalt: Number(parsed.nettoUtbetalt) || 0,
    feriepengegrunnlag: Number(parsed.feriepengegrunnlag) || 0,
    opptjentFerie: 0,
    skattetrekk: Number(parsed.skattetrekk) || 0,
    ekstraTrekk: 0,
    husleietrekk: 0,
    pensjonstrekk: Number(parsed.pensjonstrekk) || 0,
    fagforeningskontingent: Number(parsed.fagforeningskontingent) || 0,
    ouFond: 0,
    gruppelivspremie: 0,
    hittilBrutto: 0,
    hittilPensjon: 0,
    hittilForskuddstrekk: 0,
    tabelltrekkGrunnlag: 0,
    tabelltrekkBelop: Number(parsed.skattetrekk) || 0,
    tabellnummer: undefined,
  }

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
