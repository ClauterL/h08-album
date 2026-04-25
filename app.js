// H08 – app.js (testattava Express-sovellus)
import express from 'express'
import Album from './models/Album.js'

const app = express()
app.use(express.json())

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
