// Yksikkötestit puhtaille flippauslaskuille (ei verkkoa).
import {
  calcTax,
  calcMargin,
  calcRoi,
  unitsPerCycle,
  scoreItem,
  normalizeItems,
  buildPortfolio,
  GE_TAX_CAP,
  CYCLES_PER_DAY
} from '../api/flipping.js'

describe('calcTax', () => {
  test('alle 100gp on veroton', () => {
    expect(calcTax(99)).toBe(0)
    expect(calcTax(0)).toBe(0)
  })
  test('1% pyöristettynä alaspäin', () => {
    expect(calcTax(100)).toBe(1)
    expect(calcTax(199)).toBe(1)
    expect(calcTax(10_000)).toBe(100)
  })
  test('katto 5M', () => {
    expect(calcTax(1_000_000_000)).toBe(GE_TAX_CAP)
  })
  test('epäluvut → 0', () => {
    expect(calcTax(NaN)).toBe(0)
    expect(calcTax(undefined)).toBe(0)
  })
})

describe('calcMargin & calcRoi', () => {
  test('kate = myynti - vero - osto', () => {
    // Osta 1000, myy 1200, vero 12 → 188
    expect(calcMargin(1000, 1200)).toBe(188)
  })
  test('ROI = margin / buy', () => {
    expect(calcRoi(1000, 1200)).toBeCloseTo(0.188, 3)
    expect(calcRoi(0, 1200)).toBe(0)
  })
})

describe('unitsPerCycle', () => {
  test('rajoittuu budjettiin', () => {
    // 10k gp budjetti, 1000 hinta → korkeintaan 10 kpl
    const u = unitsPerCycle({ buyPrice: 1000, hourlyVolume: 1000, buyLimit: 10000, budget: 10000 })
    expect(u).toBe(10)
  })
  test('rajoittuu ostorajaan', () => {
    const u = unitsPerCycle({ buyPrice: 100, hourlyVolume: 100000, buyLimit: 25, budget: 10_000_000 })
    expect(u).toBe(25)
  })
  test('rajoittuu volyymiin (50% * 4h)', () => {
    const u = unitsPerCycle({ buyPrice: 100, hourlyVolume: 30, buyLimit: 10000, budget: 10_000_000 })
    // floor(30 * 4 * 0.5) = 60
    expect(u).toBe(60)
  })
  test('nolla-osto → 0', () => {
    expect(unitsPerCycle({ buyPrice: 0, hourlyVolume: 100, buyLimit: 10, budget: 10000 })).toBe(0)
  })
})

describe('scoreItem', () => {
  test('positiivinen kate tuottaa arvion', () => {
    const s = scoreItem(
      { id: 1, name: 'X', buyPrice: 1000, sellPrice: 1200, hourlyVolume: 500, buyLimit: 100 },
      { budget: 100_000 }
    )
    expect(s).not.toBeNull()
    expect(s.margin).toBe(188)
    expect(s.perCycle).toBeGreaterThan(0)
    expect(s.dailyPotential).toBe(s.profitPerCycle * CYCLES_PER_DAY)
  })
  test('negatiivinen kate → null', () => {
    const s = scoreItem(
      { id: 1, name: 'X', buyPrice: 1200, sellPrice: 1000, hourlyVolume: 500, buyLimit: 100 },
      { budget: 100_000 }
    )
    expect(s).toBeNull()
  })
})

describe('normalizeItems', () => {
  test('yhdistää latest + 5m + 1h + mapping', () => {
    const items = normalizeItems({
      latest: { data: { 4151: { low: 15_000_000, lowTime: 1, high: 15_500_000, highTime: 2 } } },
      fiveMin: { data: { 4151: { highPriceVolume: 3, lowPriceVolume: 2 } } },
      hourly: { data: { 4151: { avgHighPrice: 15_500_000, highPriceVolume: 30, avgLowPrice: 15_000_000, lowPriceVolume: 20 } } },
      mapping: [{ id: 4151, name: 'Abyssal whip', members: true, limit: 70 }]
    })
    expect(items).toHaveLength(1)
    expect(items[0].name).toBe('Abyssal whip')
    expect(items[0].hourlyVolume).toBe(50)
    expect(items[0].fiveMinVolume).toBe(5)
    expect(items[0].buyLimit).toBe(70)
  })
  test('ohittaa tuntemattomat idt (ei mappingissa)', () => {
    const items = normalizeItems({
      latest: { data: { 999: { low: 1, high: 2 } } },
      hourly: { data: {} },
      fiveMin: { data: {} },
      mapping: []
    })
    expect(items).toEqual([])
  })
})

describe('buildPortfolio', () => {
  const items = [
    { id: 1, name: 'Halpa nopea', buyPrice: 100,   sellPrice: 130,   hourlyVolume: 5000, buyLimit: 10000 },
    { id: 2, name: 'Keski',       buyPrice: 5000,  sellPrice: 5600,  hourlyVolume: 500,  buyLimit: 1000 },
    { id: 3, name: 'Kallis',      buyPrice: 100000, sellPrice: 108000, hourlyVolume: 100, buyLimit: 100 },
    { id: 4, name: 'Tappiollinen', buyPrice: 1000, sellPrice: 900,   hourlyVolume: 1000, buyLimit: 1000 },
    { id: 5, name: 'Alavolyymi',  buyPrice: 200,  sellPrice: 260,   hourlyVolume: 5,    buyLimit: 10000 }
  ]

  test('rakentaa suositukset budjetin sisällä', () => {
    const p = buildPortfolio(items, { budget: 3_000_000, targetProfit: 10_000_000, minVolume: 50, activeOnly: false })
    expect(p.picks.length).toBeGreaterThan(0)
    expect(p.usedCapital).toBeLessThanOrEqual(3_000_000)
    // Tappiollinen ja alavolyymi eivät saa päätyä listaan
    for (const pk of p.picks) {
      expect(pk.name).not.toBe('Tappiollinen')
      expect(pk.name).not.toBe('Alavolyymi')
    }
  })

  test('projected profit ja target-lippu ovat konsistentteja', () => {
    const p = buildPortfolio(items, { budget: 3_000_000, targetProfit: 10_000_000, minVolume: 50, activeOnly: false })
    const sum = p.picks.reduce((a, x) => a + x.projectedProfitPerDay, 0)
    expect(p.projectedProfit).toBe(sum)
    expect(p.targetMet).toBe(sum >= 10_000_000)
  })

  test('kunnioittaa minVolume-suodatinta', () => {
    const p = buildPortfolio(items, { budget: 3_000_000, targetProfit: 1, minVolume: 1000, activeOnly: false })
    for (const pk of p.picks) {
      expect(pk.hourlyVolume).toBeGreaterThanOrEqual(1000)
    }
  })

  test('activeOnly poissulkee itemit joiden 5min volyymi on 0', () => {
    const withActivity = [
      { id: 10, name: 'Aktiivinen', buyPrice: 1000, sellPrice: 1200, hourlyVolume: 1000, fiveMinVolume: 40, buyLimit: 100 },
      { id: 11, name: 'Uninen',     buyPrice: 1000, sellPrice: 1200, hourlyVolume: 1000, fiveMinVolume: 0,  buyLimit: 100 }
    ]
    const p = buildPortfolio(withActivity, { budget: 100_000, targetProfit: 1, minVolume: 50, activeOnly: true })
    expect(p.picks.map(x => x.name)).toEqual(['Aktiivinen'])
  })
})
