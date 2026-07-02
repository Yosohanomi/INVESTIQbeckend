import express from 'express'
import { readJSON, writeJSON } from '../utils/fileDb.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import bcrypt from 'bcrypt'

const router = express.Router()
const file = './data/users.json'

// ─── GET /api/users/me ─────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  const users = await readJSON(file)
  const user = users.find((u) => u.id == req.user.id)
  if (!user) return res.sendStatus(404)
  const { password, ...safeUser } = user
  res.json(safeUser)
})

// ─── PUT /api/users/me ─────────────────────────────────────────────────────────
router.put('/me', requireAuth, async (req, res) => {
  const users = await readJSON(file)
  const idx = users.findIndex((u) => u.id == req.user.id)
  if (idx === -1) return res.sendStatus(404)

  const { name, currentPassword, newPassword } = req.body

  if (newPassword) {
    if (!currentPassword) {
      return res.status(400).json({ error: 'Потрібен поточний пароль' })
    }
    const match = await bcrypt.compare(currentPassword, users[idx].password)
    if (!match) {
      return res.status(401).json({ error: 'Поточний пароль невірний' })
    }
    users[idx].password = await bcrypt.hash(newPassword, 12)
  }

  if (name) users[idx].name = name.trim()

  await writeJSON(file, users)
  const { password, ...safeUser } = users[idx]
  res.json(safeUser)
})

// ─── GET /api/users — список усіх (тільки адмін) ───────────────────────────────
router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  const users = await readJSON(file)
  const pageNum = parseInt(req.query.page) || 1
  const limitNum = parseInt(req.query.limit) || 10
  const totalItems = users.length
  const totalPages = Math.ceil(totalItems / limitNum)
  const items = users
    .slice((pageNum - 1) * limitNum, pageNum * limitNum)
    .map(({ password, ...u }) => u)

  res.json({ items, page: pageNum, limit: limitNum, totalItems, totalPages })
})

// ─── DELETE /api/users/:id — видалення користувача (тільки адмін) ──────────────
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const users = await readJSON(file)
  const idx = users.findIndex((u) => u.id == req.params.id)
  if (idx === -1) return res.sendStatus(404)

  // Не можна видалити себе
  if (users[idx].id == req.user.id) {
    return res.status(400).json({ error: 'Не можна видалити власний акаунт' })
  }

  const [deleted] = users.splice(idx, 1)
  await writeJSON(file, users)

  const { password, ...safeUser } = deleted
  res.json(safeUser)
})

export default router
