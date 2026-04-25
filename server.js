// H08 – server.js (pilvipalveluun julkaisua varten)
import 'dotenv/config'
import mongoose from 'mongoose'
import app from './app.js'

const PORT = process.env.PORT || 3001

let memoryServer

async function connectMongo() {
  if (process.env.MONGO_URI) {
    console.log('Yhdistetään MongoDB:hen...')
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 })
    return
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('MONGO_URI puuttuu (production). Aseta ympäristömuuttuja hosting-palvelussa.')
  }

  const { MongoMemoryServer } = await import('mongodb-memory-server')
  memoryServer = await MongoMemoryServer.create()
  const uri = memoryServer.getUri()
  console.log('MONGO_URI puuttuu → käytetään paikallista mongodb-memory-serveriä.')
  await mongoose.connect(uri)
}

async function start() {
  try {
    await connectMongo()
    console.log('MongoDB connected')
    const server = app.listen(PORT, () => console.log(`Server at http://localhost:${PORT}`))

    const shutdown = async () => {
      server.close(() => {})
      if (mongoose.connection.readyState !== 0) await mongoose.disconnect()
      if (memoryServer) await memoryServer.stop()
      process.exit(0)
    }
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
  } catch (err) {
    console.error('MongoDB virhe:', err.message)
    process.exit(1)
  }
}

start()
