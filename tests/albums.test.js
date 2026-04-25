// H08T01 & H08T02 – Integraatiotestit albumeille
// Käytetään mongodb-memory-serveriä, jotta testit toimivat ilman Atlas-kirjautumista.
// Atlas-integraatio: aseta JEST_USE_ATLAS=1 ja kelvollinen MONGO_URI (H08/.env).
import 'dotenv/config'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import request from 'supertest'
import app from '../app.js'
import Album from '../models/Album.js'

let mongoServer
let useAtlas = process.env.JEST_USE_ATLAS === '1' || process.env.JEST_USE_ATLAS === 'true'

if (useAtlas && !process.env.MONGO_URI) {
  throw new Error('JEST_USE_ATLAS on päällä mutta MONGO_URI puuttuu (.env).')
}

// Testitietokanta
const TEST_ALBUMS = [
  { artist: 'Toto', title: 'Toto IV', year: 1982, genre: 'Pop', tracks: 10 },
  { artist: 'Steely Dan', title: 'Aja', year: 1977, genre: 'Jazz', tracks: 7 },
  { artist: 'Miles Davis', title: 'Kind of Blue', year: 1959, genre: 'Jazz', tracks: 5 }
]

beforeAll(async () => {
  if (useAtlas) {
    await mongoose.connect(process.env.MONGO_URI)
  } else {
    mongoServer = await MongoMemoryServer.create()
    await mongoose.connect(mongoServer.getUri())
  }
}, 120000)

beforeEach(async () => {
  await Album.deleteMany({})
  await Album.insertMany(TEST_ALBUMS)
})

afterAll(async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect()
    }
  } catch {
    try {
      await mongoose.disconnect()
    } catch {
      /* ignore */
    }
  }
  if (mongoServer) await mongoServer.stop()
}, 60000)

describe('GET /api/albums', () => {
  test('palauttaa kaikki albumit (3 kpl)', async () => {
    const res = await request(app).get('/api/albums')
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBe(TEST_ALBUMS.length)
  })
})

describe('GET /api/health', () => {
  test('palauttaa ok + aikaleima', async () => {
    const res = await request(app).get('/api/health')
    expect(res.statusCode).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.service).toBe('h08-album')
    expect(typeof res.body.time).toBe('string')
    expect(res.body.time.length).toBeGreaterThan(10)
  })
})

describe('GET /api/db-status', () => {
  test('palauttaa Mongo-yhteyden tilan', async () => {
    const res = await request(app).get('/api/db-status')
    expect(res.statusCode).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.mongo.readyState).toBe(1)
  })
})

describe('GET /', () => {
  test('palauttaa pienen status-UI:n (HTML)', async () => {
    const res = await request(app).get('/')
    expect(res.statusCode).toBe(200)
    expect(String(res.headers['content-type'] || '')).toContain('text/html')
    expect(res.text).toContain('H08 – Album API')
  })
})

describe('POST /api/albums', () => {
  test('lisää uuden albumin ja albumien määrä kasvaa yhdellä', async () => {
    const initial = await Album.countDocuments({})
    const newAlbum = { artist: 'Pink Floyd', title: 'The Wall', year: 1979, genre: 'Rock', tracks: 26 }
    const res = await request(app).post('/api/albums').send(newAlbum)

    expect(res.statusCode).toBe(201)
    expect(res.body.artist).toBe(newAlbum.artist)
    expect(res.body.title).toBe(newAlbum.title)

    const after = await Album.countDocuments({})
    expect(after).toBe(initial + 1)

    const created = await Album.findOne({ artist: newAlbum.artist, title: newAlbum.title })
    expect(created).toBeTruthy()
    expect(created.year).toBe(newAlbum.year)
    expect(created.genre).toBe(newAlbum.genre)
    expect(created.tracks).toBe(newAlbum.tracks)
  })
})
