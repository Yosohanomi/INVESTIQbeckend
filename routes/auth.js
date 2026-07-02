import express from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { readJSON, writeJSON } from '../utils/fileDb.js'
import dotenv from 'dotenv'

dotenv.config()

const router = express.Router()
const usersFile = './data/users.json'

function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.ACCESS_EXPIRES }
  )
}

function generateRefreshToken(user) {
  return jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.REFRESH_EXPIRES,
  })
}

// ─── Реєстрація ────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Поля email, password та name обовʼязкові' })
  }

  // Базова валідація email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Невалідний формат email' })
  }

  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Пароль має містити мінімум 6 символів' })
  }

  if (String(name).trim().length < 2) {
    return res.status(400).json({ error: 'Імʼя має містити мінімум 2 символи' })
  }

  const users = await readJSON(usersFile)

  const exists = users.find((u) => u.email === email)
  if (exists) {
    return res.status(409).json({ error: 'Користувач з таким email вже існує' })
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  const newUser = {
    id: users.length > 0 ? Math.max(...users.map((u) => u.id)) + 1 : 1,
    email,
    name,
    role: 'user',
    password: hashedPassword,
  }

  users.push(newUser)
  await writeJSON(usersFile, users)

  const accessToken = generateAccessToken(newUser)
  const refreshToken = generateRefreshToken(newUser)

  res
    .cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .status(201)
    .json({
      user: { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role },
      accessToken,
    })
})

// ─── Логін ─────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Поля email та password обовʼязкові' })
  }

  const users = await readJSON(usersFile)
  const user = users.find((u) => u.email === email)

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Невірний email або пароль' })
  }

  const accessToken = generateAccessToken(user)
  const refreshToken = generateRefreshToken(user)

  res
    .cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      accessToken,
    })
})

// ─── Refresh токена ─────────────────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const token = req.cookies.refreshToken
  if (!token) return res.sendStatus(401)
  try {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET)
    const users = await readJSON(usersFile)
    const user = users.find((u) => u.id == payload.id)
    if (!user) return res.sendStatus(401)

    const accessToken = generateAccessToken(user)
    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      accessToken,
    })
  } catch {
    return res.sendStatus(403)
  }
})

// ─── Логаут ─────────────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken')
  res.sendStatus(204)
})

export default router
