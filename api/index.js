import app from '../app.js'
import { connectMongo } from '../db.js'

export default async function handler(req, res) {
  await connectMongo()
  return app(req, res)
}

