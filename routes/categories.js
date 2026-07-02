import express from 'express'
import { readJSON, writeJSON } from '../utils/fileDb.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { v4 as uuid } from 'uuid'

const router = express.Router()
const file = './data/categories.json'

// ─── GET /api/categories ────────────────────────────────────────────────────────
// ?type=income|expense — опціональний фільтр
router.get('/', async (req, res) => {
  const { type } = req.query
  let categories = await readJSON(file)
  if (type) {
    categories = categories.filter((c) => c.type === type)
  }
  res.json(categories)
})

// ─── POST /api/categories — тільки адмін ───────────────────────────────────────
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { label, type, icon } = req.body

  if (!label || !label.trim()) {
    return res.status(400).json({ error: 'Поле label обовʼязкове' })
  }
  if (!type || !['income', 'expense'].includes(type)) {
    return res.status(400).json({ error: 'Поле type має бути "income" або "expense"' })
  }

  const categories = await readJSON(file)
  const newCategory = {
    id: uuid(),
    label: label.trim(),
    type,
    icon: icon || '📋',
  }

  categories.push(newCategory)
  await writeJSON(file, categories)
  res.status(201).json(newCategory)
})

// ─── DELETE /api/categories/:id — тільки адмін ─────────────────────────────────
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const categories = await readJSON(file)
  const idx = categories.findIndex((c) => c.id === req.params.id)
  if (idx === -1) return res.sendStatus(404)

  const [deleted] = categories.splice(idx, 1)
  await writeJSON(file, categories)
  res.json(deleted)
})

export default router
