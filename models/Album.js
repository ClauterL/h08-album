import mongoose from 'mongoose'

const albumSchema = new mongoose.Schema({
  artist: { type: String, required: true },
  title:  { type: String, required: true },
  year:   { type: Number },
  genre:  { type: String },
  tracks: { type: Number }
}, { timestamps: true })

export default mongoose.model('Album', albumSchema)
