import mongoose from 'mongoose'

let cached = globalThis.__mongooseH08Cache

if (!cached) {
  cached = globalThis.__mongooseH08Cache = { conn: null, promise: null }
}

export async function connectMongo() {
  if (cached.conn) return cached.conn

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI puuttuu. Lisää se Vercelin Environment Variables -asetuksiin.')
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 })
  }

  cached.conn = await cached.promise
  return cached.conn
}
