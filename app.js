// H08 – app.js (testattava Express-sovellus)
import express from 'express'
import mongoose from 'mongoose'
import path from 'path'
import { fileURLToPath } from 'url'
import Album from './models/Album.js'
import { fetchAllData, normalizeItems, buildPortfolio, fetchTimeseries } from './api/flipping.js'

const app = express()
app.use(express.json())

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const publicDir = path.join(__dirname, 'public')

app.use(express.static(publicDir))

app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'))
})

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'h08-album',
    time: new Date().toISOString(),
    node: process.version
  })
})

app.get('/api/db-status', (req, res) => {
  const readyState = mongoose.connection.readyState
  res.json({
    ok: readyState === 1,
    mongo: {
      readyState,
      name: mongoose.connection.name || null,
      host: mongoose.connection.host || null
    }
  })
})

app.get('/api/albums', async (req, res) => {
  const albums = await Album.find({})
  res.json(albums)
})

app.post('/api/albums', async (req, res) => {
  try {
    const album = await Album.create(req.body)
    res.status(201).json(album)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

app.get('/flipping', (req, res) => {
  res.sendFile(path.join(publicDir, 'flipping.html'))
})

app.get('/api/flipping/suggestions', async (req, res) => {
  try {
    const budget = Math.max(0, Number(req.query.budget) || 3_000_000)
    const targetProfit = Math.max(0, Number(req.query.target) || 10_000_000)
    const minVolume = Math.max(0, Number(req.query.minVolume) || 50)
    const maxPicks = Math.min(30, Math.max(1, Number(req.query.maxPicks) || 15))
    const membersOnly = req.query.members === 'true'
    const f2pOnly = req.query.members === 'false'
    const activeOnly = req.query.activeOnly !== 'false'

    const raw = await fetchAllData()
    let items = normalizeItems(raw)
    if (membersOnly) items = items.filter(it => it.members)
    if (f2pOnly) items = items.filter(it => !it.members)

    const portfolio = buildPortfolio(items, { budget, targetProfit, minVolume, maxPicks, activeOnly })
    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      params: { budget, targetProfit, minVolume, maxPicks, membersOnly, f2pOnly, activeOnly },
      ...portfolio
    })
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message })
  }
})

app.get('/api/flipping/timeseries', async (req, res) => {
  try {
    const data = await fetchTimeseries(req.query.id, req.query.timestep)
    res.json({ ok: true, ...data })
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message })
  }
})

export default app
