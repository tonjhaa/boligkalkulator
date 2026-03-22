import { describe, it, expect } from 'vitest'
import { parseForsvarsSlipp, calculateHolidayPay } from '../salaryCalculator'

// Representativt utdrag fra en ekte Forsvaret januar 2026-lønnsslippe.
// Norsk tallformat: punktum = tusenskille, komma = desimal, etterfølgende "-" = negativt.
const JAN_2026_SLIP = `
Lønnsavregning for Januar 2026
LTR  AB  61 SPENN
Ansattnr: 123456
1S01 Månedslønn 01.26 670.132 55.844,40
1501 Særtillegg 01.26 1.700,00
/440 Tabelltrekk 01.26 61.278,00 8010 18.478,00-
7000 Pensjonstrekk 01.26 1.150,80-
3020 Fagforeningskontingent 01.26 723,00-
3209 Husleie - Fam.bolig 01.26 7.315,93-
1620 Ekstra forskuddstrekk 01.26 1.000,00-
63.078,83 28.701,06- 34.377,77
57.544,40 6.905,33
`

describe('parseForsvarsSlipp — januar 2026', () => {
  const slip = parseForsvarsSlipp(JAN_2026_SLIP)

  it('parser periode korrekt', () => {
    expect(slip.periode.year).toBe(2026)
    expect(slip.periode.month).toBe(1)
  })

  it('parser ansattnummer', () => {
    expect(slip.ansattnummer).toBe('123456')
  })

  it('parser lønnstrinn fra LTR...SPENN', () => {
    expect(slip.loennstrinn).toBe(61)
  })

  it('parser månedslønn (1S01 — siste beløp)', () => {
    expect(slip.maanedslonn).toBeCloseTo(55844.40, 2)
  })

  it('parser skattetrekk (/440 — siste beløp, ikke tabellnummer)', () => {
    expect(slip.skattetrekk).toBeCloseTo(18478.00, 2)
  })

  it('parser pensjonstrekk (7000)', () => {
    expect(slip.pensjonstrekk).toBeCloseTo(1150.80, 2)
  })

  it('parser fagforeningskontingent (3020)', () => {
    expect(slip.fagforeningskontingent).toBeCloseTo(723.00, 2)
  })

  it('parser husleietrekk (3209)', () => {
    expect(slip.husleietrekk).toBeCloseTo(7315.93, 2)
  })

  it('parser ekstra forskuddstrekk (1620)', () => {
    expect(slip.ekstraTrekk).toBeCloseTo(1000.00, 2)
  })

  it('leser netto utbetalt fra netto-linjen (3. beløp)', () => {
    expect(slip.nettoUtbetalt).toBeCloseTo(34377.77, 2)
  })

  it('leser feriepengegrunnlag fra linjen etter netto (1. beløp)', () => {
    expect(slip.feriepengegrunnlag).toBeCloseTo(57544.40, 2)
  })

  it('alle beløp er positive (abs-verdier)', () => {
    expect(slip.maanedslonn).toBeGreaterThan(0)
    expect(slip.skattetrekk).toBeGreaterThan(0)
    expect(slip.pensjonstrekk).toBeGreaterThan(0)
    expect(slip.husleietrekk).toBeGreaterThan(0)
  })
})

describe('parseForsvarsSlipp — edge cases', () => {
  it('returnerer nullverdier ved tomt dokument', () => {
    const slip = parseForsvarsSlipp('')
    expect(slip.maanedslonn).toBe(0)
    expect(slip.skattetrekk).toBe(0)
    expect(slip.nettoUtbetalt).toBe(0)
    expect(slip.loennstrinn).toBe(0)
  })

  it('stopper ikke ved ukjente artskoder', () => {
    const text = `
Lønnsavregning for Februar 2026
1S01 Månedslønn 02.26 600.000 50.000,00
XXXX Ukjent tillegg 02.26 1.000,00
/440 Tabelltrekk 02.26 50.000,00 8010 15.000,00-
`
    expect(() => parseForsvarsSlipp(text)).not.toThrow()
  })

  it('netto beregnes fra artskoder dersom netto-linje mangler', () => {
    const text = `
Lønnsavregning for Mars 2026
1S01 Månedslønn 03.26 600.000 50.000,00
/440 Tabelltrekk 03.26 50.000,00 8010 15.000,00-
7000 Pensjonstrekk 03.26 1.000,00-
`
    const slip = parseForsvarsSlipp(text)
    // Netto = 50000 - 15000 - 1000 = 34000
    expect(slip.nettoUtbetalt).toBeCloseTo(34000, 0)
  })

  it('håndterer /441 som alternativt skattetrekk', () => {
    const text = `
Lønnsavregning for April 2026
1S01 Månedslønn 04.26 600.000 50.000,00
/441 Prosenttrekk 04.26 10.000,00-
`
    const slip = parseForsvarsSlipp(text)
    expect(slip.skattetrekk).toBeCloseTo(10000, 0)
  })
})

describe('parseForsvarsSlipp — tabelltrekk-grunnlag', () => {
  it('ekstraherer /440-grunnlag og -beløp korrekt', () => {
    const slip = parseForsvarsSlipp(JAN_2026_SLIP)
    // /440 Tabelltrekk 01.26 61.278,00 8010 18.478,00-
    expect(slip.tabelltrekkGrunnlag).toBeCloseTo(61278, 0)
    expect(slip.tabelltrekkBelop).toBeCloseTo(18478, 0)
  })

  it('effektiv trekkprosent = belop / grunnlag', () => {
    const slip = parseForsvarsSlipp(JAN_2026_SLIP)
    const pct = (slip.tabelltrekkBelop / slip.tabelltrekkGrunnlag) * 100
    expect(pct).toBeCloseTo(30.15, 1)
  })

  it('returnerer 0 ved manglende /440-linje', () => {
    const text = `
Lønnsavregning for Februar 2026
1S01 Månedslønn 02.26 600.000 50.000,00
7000 Pensjonstrekk 02.26 1.000,00-
`
    const slip = parseForsvarsSlipp(text)
    expect(slip.tabelltrekkGrunnlag).toBe(0)
    expect(slip.tabelltrekkBelop).toBe(0)
  })
})

describe('parseForsvarsSlipp — ATF-satser', () => {
  it('ekstraherer sats for 2230 når antall=1 (sats=beløp)', () => {
    const text = `
Lønnsavregning for April 2025
1S01 Månedslønn 04.25 627.110 52.259,17
2230 Øvelse døgn Ma-Fr 04.25 1 5.709,40 5.709,40
63.968,57 28.000,00- 35.968,57
181.974,45 21.836,94
`
    const slip = parseForsvarsSlipp(text)
    expect(slip.atfRater?.['2230']).toBeCloseTo(5709.40, 2)
  })

  it('ekstraherer sats korrekt når antall=2 (to forskjellige NOK-beløp)', () => {
    const text = `
Lønnsavregning for April 2025
1S01 Månedslønn 04.25 627.110 52.259,17
2230 Øvelse døgn Ma-Fr 04.25 2 5.709,40 11.418,80
63.968,57 28.000,00- 35.968,57
181.974,45 21.836,94
`
    const slip = parseForsvarsSlipp(text)
    expect(slip.atfRater?.['2230']).toBeCloseTo(5709.40, 2)
  })

  it('beholder høyeste sats ved to forekomster av 2230 (lønnsoppgjør)', () => {
    const text = `
Lønnsavregning for Desember 2025
1S01 Månedslønn 12.25 670.132 55.844,40
2230 Øvelse døgn Ma-Fr 11.25 1 6.476,20 6.476,20
2230 Øvelse døgn Ma-Fr 12.25 1 6.764,20 6.764,20
63.078,83 28.000,00- 35.078,83
688.548,00 82.625,76
`
    const slip = parseForsvarsSlipp(text)
    expect(slip.atfRater?.['2230']).toBeCloseTo(6764.20, 2)
  })

  it('returnerer undefined atfRater når ingen øvelse-artskoder finnes', () => {
    const text = `
Lønnsavregning for Januar 2026
1S01 Månedslønn 01.26 670.132 55.844,40
/440 Tabelltrekk 01.26 61.278,00 8010 18.478,00-
63.078,83 28.000,00- 35.078,83
57.544,40 6.905,33
`
    const slip = parseForsvarsSlipp(text)
    expect(slip.atfRater).toBeUndefined()
  })

  it('ekstraherer 2236 timesats korrekt', () => {
    const text = `
Lønnsavregning for April 2025
1S01 Månedslønn 04.25 627.110 52.259,17
2236 Øvelse pr t Ma-Fr 04.25 4 356,80 1.427,20
63.968,57 28.000,00- 35.968,57
181.974,45 21.836,94
`
    const slip = parseForsvarsSlipp(text)
    expect(slip.atfRater?.['2236']).toBeCloseTo(356.80, 2)
  })
})

describe('calculateHolidayPay', () => {
  it('beregner korrekt feriepengeprosent (12%)', () => {
    const basis = 670_128
    const result = calculateHolidayPay(basis, 670_128)
    expect(result.holidayPay).toBeCloseTo(basis * 0.12, 0)
  })

  it('beregner ferietrekk = årslønn / 260 × 25', () => {
    const annualSalary = 600_000
    const result = calculateHolidayPay(annualSalary, annualSalary)
    expect(result.holidayLeaveDeduction).toBeCloseTo((annualSalary / 260) * 25, 0)
  })

  it('netto juni = månedslønn + feriepenger − ferietrekk', () => {
    const annualSalary = 600_000
    const result = calculateHolidayPay(annualSalary, annualSalary)
    const expected = annualSalary / 12 + result.holidayPay - result.holidayLeaveDeduction
    expect(result.netJune).toBeCloseTo(expected, 0)
  })

  it('netto juni er positiv for normalarbeidstaker', () => {
    const result = calculateHolidayPay(700_000, 700_000)
    expect(result.netJune).toBeGreaterThan(0)
  })
})
