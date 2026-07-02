import express from 'express'
import { readJSON, writeJSON } from '../utils/fileDb.js'
import { requireAuth } from '../middleware/auth.js'
import { v4 as uuid } from 'uuid'

const router = express.Router()
const file = './data/transactions.json'

// ─── Допоміжні функції ──────────────────────────────────────────────────────────
function applyDateFilter(list, dateFrom, dateTo) {
  if (dateFrom) {
    const from = new Date(dateFrom)
    list = list.filter((t) => new Date(t.date) >= from)
  }
  if (dateTo) {
    const to = new Date(dateTo)
    to.setHours(23, 59, 59, 999)
    list = list.filter((t) => new Date(t.date) <= to)
  }
  return list
}

// ─── GET /api/transactions/stats ───────────────────────────────────────────────
// ВАЖЛИВО: цей роут має бути вище /:id, інакше Express прочитає "stats" як id
router.get('/stats', requireAuth, async (req, res) => {
  const { dateFrom, dateTo } = req.query

  let transactions = await readJSON(file)
  transactions = transactions.filter((t) => t.userId == req.user.id)
  transactions = applyDateFilter(transactions, dateFrom, dateTo)

  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)

  // Розбивка по категоріях
  const categoryBreakdown = transactions.reduce((acc, t) => {
    const key = t.category || 'інше'
    if (!acc[key]) acc[key] = { income: 0, expense: 0 }
    if (t.type === 'income') acc[key].income += t.amount
    else acc[key].expense += t.amount
    return acc
  }, {})

  // Динаміка по місяцях (для графіків)
  const monthlyBreakdown = transactions.reduce((acc, t) => {
    const month = t.date.slice(0, 7) // 'YYYY-MM'
    if (!acc[month]) acc[month] = { income: 0, expense: 0 }
    if (t.type === 'income') acc[month].income += t.amount
    else acc[month].expense += t.amount
    return acc
  }, {})

  res.json({
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    categoryBreakdown,
    monthlyBreakdown,
  })
})

// ─── GET /api/transactions ──────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  const { page = 1, limit = 20, type, category, dateFrom, dateTo } = req.query

  let transactions = await readJSON(file)
  transactions = transactions.filter((t) => t.userId == req.user.id)

  if (type) {
    transactions = transactions.filter((t) => t.type === type)
  }
  if (category) {
    transactions = transactions.filter(
      (t) => t.category?.toLowerCase() === category.toLowerCase()
    )
  }
  transactions = applyDateFilter(transactions, dateFrom, dateTo)

  // Сортування — найновіші першими
  transactions.sort((a, b) => new Date(b.date) - new Date(a.date))

  const pageNum = Math.max(1, parseInt(page, 10))
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)))
  const totalItems = transactions.length
  const totalPages = Math.ceil(totalItems / limitNum) || 1

  const items = transactions.slice(
    (pageNum - 1) * limitNum,
    pageNum * limitNum
  )

  res.json({ items, page: pageNum, limit: limitNum, totalItems, totalPages })
})

// ─── GET /api/transactions/:id ─────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  const transactions = await readJSON(file)
  const transaction = transactions.find(
    (t) => t.id === req.params.id && t.userId == req.user.id
  )
  if (!transaction) return res.sendStatus(404)
  res.json(transaction)
})

// ─── POST /api/transactions ─────────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const { type, amount, category, description, date } = req.body

  if (!type || !['income', 'expense'].includes(type)) {
    return res.status(400).json({ error: 'Поле type має бути "income" або "expense"' })
  }
  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Поле amount має бути додатнім числом' })
  }
  if (!category || !String(category).trim()) {
    return res.status(400).json({ error: 'Поле category обовʼязкове' })
  }

  const transactions = await readJSON(file)
  const newTransaction = {
    id: uuid(),
    userId: req.user.id,
    type,
    amount: Math.round(Number(amount) * 100) / 100, // округлення до копійок
    category: String(category).trim(),
    description: description ? String(description).trim() : '',
    date: date ? new Date(date).toISOString() : new Date().toISOString(),
    createdAt: new Date().toISOString(),
  }

  transactions.push(newTransaction)
  await writeJSON(file, transactions)
  res.status(201).json(newTransaction)
})

// ─── PUT /api/transactions/:id ─────────────────────────────────────────────────
router.put('/:id', requireAuth, async (req, res) => {
  const transactions = await readJSON(file)
  const idx = transactions.findIndex(
    (t) => t.id === req.params.id && t.userId == req.user.id
  )
  if (idx === -1) return res.sendStatus(404)

  const { type, amount, category, description, date } = req.body

  if (type && !['income', 'expense'].includes(type)) {
    return res.status(400).json({ error: 'Поле type має бути "income" або "expense"' })
  }
  if (amount !== undefined && (isNaN(amount) || Number(amount) <= 0)) {
    return res.status(400).json({ error: 'Поле amount має бути додатнім числом' })
  }

  transactions[idx] = {
    ...transactions[idx],
    ...(type && { type }),
    ...(amount !== undefined && { amount: Math.round(Number(amount) * 100) / 100 }),
    ...(category && { category: String(category).trim() }),
    ...(description !== undefined && { description: String(description).trim() }),
    ...(date && { date: new Date(date).toISOString() }),
    updatedAt: new Date().toISOString(),
  }

  await writeJSON(file, transactions)
  res.json(transactions[idx])
})

// ─── DELETE /api/transactions/:id ──────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  const transactions = await readJSON(file)
  const idx = transactions.findIndex(
    (t) => t.id === req.params.id && t.userId == req.user.id
  )
  if (idx === -1) return res.sendStatus(404)

  const [deleted] = transactions.splice(idx, 1)
  await writeJSON(file, transactions)
  res.json(deleted)
})

export default router
