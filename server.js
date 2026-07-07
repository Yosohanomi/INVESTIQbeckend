import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import dotenv from 'dotenv'
import { delay } from './middleware/delay.js'

import authRoutes from './routes/auth.js'
import userRoutes from './routes/users.js'
import transactionRoutes from './routes/transactions.js'
import categoryRoutes from './routes/categories.js'

dotenv.config()

const app = express()

app.use(cors({
  origin: 'https://investiqpj.netlify.app',
  credentials: true
}));


app.use(express.json())
app.use(cookieParser())
app.use(delay)

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/transactions', transactionRoutes)
app.use('/api/categories', categoryRoutes)

// 404 для невідомих роутів
app.use((req, res) => {
  res.status(404).json({ error: `Роут ${req.method} ${req.path} не знайдено` })
})

// Глобальний обробник помилок
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Внутрішня помилка сервера' })
})

const PORT = process.env.PORT || 4000
app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`))
