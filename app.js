// H08 – app.js (testattava Express-sovellus)
import express from 'express'
import mongoose from 'mongoose'
import path from 'path'
import { fileURLToPath } from 'url'
import Album from './models/Album.js'

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

export default app
