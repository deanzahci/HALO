const express = require('express')
const fs = require('fs')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 3000

// Increase limit for large images
app.use(express.json({ limit: '20mb' }))

// Simple CORS middleware so the dev frontend can POST
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.post('/save-capture', (req, res) => {
  try {
    const { imageData, filename } = req.body || {}
    if (!imageData) return res.status(400).json({ error: 'imageData is required' })

    // Determine output directory: project root /captured
    const outDir = path.resolve(__dirname, '..', 'captured')
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true })
    }

    // Extract base64 from data URL
    const matches = imageData.match(/^data:(image\/png|image\/jpeg);base64,(.+)$/)
    if (!matches) return res.status(400).json({ error: 'Invalid imageData format' })

    const mime = matches[1]
    const b64 = matches[2]
    const buffer = Buffer.from(b64, 'base64')

    const outName = filename || `halo_${Date.now()}.png`
    const outPath = path.join(outDir, outName)

    fs.writeFileSync(outPath, buffer)

    return res.json({ ok: true, path: outPath })
  } catch (err) {
    console.error('Failed to save capture', err)
    return res.status(500).json({ error: String(err) })
  }
})

app.get('/', (req, res) => res.send('Save-capture server running'))

app.listen(PORT, () => console.log(`Save-capture server listening on http://localhost:${PORT}`))
