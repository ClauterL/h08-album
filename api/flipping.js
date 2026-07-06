// OSRS Grand Exchange -flippauslogiikka.
// Käyttää OSRS Wikin ilmaista Prices API:a:
//   https://prices.runescape.wiki/api/v1/osrs/latest
//   https://prices.runescape.wiki/api/v1/osrs/1h
//   https://prices.runescape.wiki/api/v1/osrs/mapping

export const GE_TAX_RATE = 0.01
export const GE_TAX_CAP = 5_000_000
export const GE_TAX_MIN_PRICE = 100
export const CYCLES_PER_DAY = 6 // GE-ostoraja päivittyy 4 tunnin välein → 6 sykliä / 24h

const WIKI_BASE = 'https://prices.runescape.wiki/api/v1/osrs'
const USER_AGENT = 'h08-album flipping-calculator (github.com/clauterl/h08-album)'

// Yhdenoikeuden veron laskenta (1 %, katto 5M, alle 100gp verottomia).
export function calcTax(sellPrice) {
  if (!Number.isFinite(sellPrice) || sellPrice < GE_TAX_MIN_PRICE) return 0
  return Math.min(Math.floor(sellPrice * GE_TAX_RATE), GE_TAX_CAP)
}

// Nettokate per kappale (osto → myynti – vero).
export function calcMargin(buyPrice, sellPrice) {
  if (!Number.isFinite(buyPrice) || !Number.isFinite(sellPrice)) return 0
  return sellPrice - calcTax(sellPrice) - buyPrice
}

export function calcRoi(buyPrice, sellPrice) {
  if (!buyPrice || buyPrice <= 0) return 0
  return calcMargin(buyPrice, sellPrice) / buyPrice
}

// Kuinka monta kappaletta yhden 4h-syklin aikana voi realistisesti flipata.
// Rajoitteet: GE-ostoraja, budjetti / ostohinta, 50 % tunnin volyymistä × 4h.
export function unitsPerCycle({ buyPrice, hourlyVolume, buyLimit, budget }) {
  if (!buyPrice || buyPrice <= 0) return 0
  const affordable = Math.floor(budget / buyPrice)
  const volumeCap = Math.floor((hourlyVolume || 0) * 4 * 0.5)
  const limit = Number.isFinite(buyLimit) && buyLimit > 0 ? buyLimit : Infinity
  return Math.max(0, Math.min(limit, affordable, volumeCap))
}

export function scoreItem(item, { budget }) {
  const { buyPrice, sellPrice, hourlyVolume, buyLimit } = item
  const margin = calcMargin(buyPrice, sellPrice)
  if (margin <= 0 || !buyPrice) return null
  const perCycle = unitsPerCycle({ buyPrice, hourlyVolume, buyLimit, budget })
  if (perCycle <= 0) return null
  const capitalUsed = buyPrice * perCycle
  const profitPerCycle = margin * perCycle
  const dailyPotential = profitPerCycle * CYCLES_PER_DAY
  return {
    ...item,
    margin,
    roi: margin / buyPrice,
    perCycle,
    profitPerCycle,
    dailyPotential,
    capitalUsed,
    capitalEfficiency: dailyPotential / (capitalUsed || 1)
  }
}

// Yhdistää kolme API-vastausta yhdeksi normalisoiduksi listaksi.
export function normalizeItems({ latest, hourly, mapping }) {
  const mappingById = new Map()
  for (const m of mapping || []) mappingById.set(String(m.id), m)

  const latestData = latest?.data || {}
  const hourlyData = hourly?.data || {}

  const ids = new Set([...Object.keys(latestData), ...Object.keys(hourlyData)])
  const items = []
  for (const id of ids) {
    const meta = mappingById.get(String(id))
    if (!meta) continue
    const lp = latestData[id] || {}
    const hp = hourlyData[id] || {}
    const buyPrice = Number(lp.low) || 0
    const sellPrice = Number(lp.high) || 0
    const hourlyVolume = (Number(hp.highPriceVolume) || 0) + (Number(hp.lowPriceVolume) || 0)
    items.push({
      id: Number(id),
      name: meta.name,
      members: !!meta.members,
      buyLimit: Number(meta.limit) || null,
      examine: meta.examine || '',
      icon: meta.icon || null,
      buyPrice,
      sellPrice,
      hourlyVolume,
      lastBuyAt: lp.lowTime ? Number(lp.lowTime) : null,
      lastSellAt: lp.highTime ? Number(lp.highTime) : null
    })
  }
  return items
}

// Portfolion rakennus: greedy pääoman tehokkuuden mukaan kunnes budjetti / tavoite täyttyy.
export function buildPortfolio(items, { budget, targetProfit, minVolume = 50, maxPicks = 15 }) {
  const scored = items
    .filter(it => it.buyPrice > 0 && it.sellPrice > 0)
    .filter(it => it.hourlyVolume >= minVolume)
    .filter(it => it.buyPrice <= budget)
    .map(it => scoreItem(it, { budget }))
    .filter(Boolean)

  scored.sort((a, b) =>
    b.capitalEfficiency - a.capitalEfficiency ||
    b.dailyPotential - a.dailyPotential
  )

  const picks = []
  let usedCapital = 0
  let projectedProfit = 0
  for (const it of scored) {
    if (picks.length >= maxPicks) break
    const remaining = budget - usedCapital
    if (remaining <= 0) break
    const units = Math.min(it.perCycle, Math.floor(remaining / it.buyPrice))
    if (units <= 0) continue
    const allocatedCapital = units * it.buyPrice
    const profitPerCycle = units * it.margin
    const profitPerDay = profitPerCycle * CYCLES_PER_DAY
    picks.push({
      id: it.id,
      name: it.name,
      buyPrice: it.buyPrice,
      sellPrice: it.sellPrice,
      margin: it.margin,
      roi: it.roi,
      hourlyVolume: it.hourlyVolume,
      buyLimit: it.buyLimit,
      allocatedUnits: units,
      allocatedCapital,
      projectedProfitPerCycle: profitPerCycle,
      projectedProfitPerDay: profitPerDay
    })
    usedCapital += allocatedCapital
    projectedProfit += profitPerDay
    if (projectedProfit >= targetProfit && usedCapital >= budget * 0.9) break
  }

  return {
    budget,
    targetProfit,
    usedCapital,
    projectedProfit,
    targetMet: projectedProfit >= targetProfit,
    cyclesPerDay: CYCLES_PER_DAY,
    picks,
    topCandidates: scored.slice(0, 30).map(({
      id, name, buyPrice, sellPrice, margin, roi, hourlyVolume, buyLimit,
      perCycle, profitPerCycle, dailyPotential, capitalUsed, capitalEfficiency
    }) => ({
      id, name, buyPrice, sellPrice, margin, roi, hourlyVolume, buyLimit,
      perCycle, profitPerCycle, dailyPotential, capitalUsed, capitalEfficiency
    }))
  }
}

// --- HTTP-haku ja välimuisti (tuotannolle) ---

const cache = { latest: null, hourly: null, mapping: null }
const TTL = {
  latest: 60_000,       // 1 min
  hourly: 5 * 60_000,   // 5 min
  mapping: 24 * 3600_000 // 24 h
}

async function fetchJson(path) {
  const res = await fetch(`${WIKI_BASE}${path}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }
  })
  if (!res.ok) throw new Error(`OSRS Wiki ${path} → HTTP ${res.status}`)
  return res.json()
}

async function cachedFetch(key, path) {
  const entry = cache[key]
  const now = Date.now()
  if (entry && now - entry.at < TTL[key]) return entry.value
  const value = await fetchJson(path)
  cache[key] = { value, at: now }
  return value
}

export async function fetchAllData({ force = false } = {}) {
  if (force) {
    cache.latest = cache.hourly = cache.mapping = null
  }
  const [latest, hourly, mapping] = await Promise.all([
    cachedFetch('latest', '/latest'),
    cachedFetch('hourly', '/1h'),
    cachedFetch('mapping', '/mapping')
  ])
  return { latest, hourly, mapping }
}

export function _resetCacheForTests() {
  cache.latest = cache.hourly = cache.mapping = null
}
