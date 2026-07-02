# Finance API

REST API для особистого обліку фінансів. Express + JWT + bcrypt, дані у JSON-файлах.

## Запуск

```bash
npm install
cp .env.example .env   # заповни JWT_SECRET і JWT_REFRESH_SECRET
npm run dev            # або npm start
```

---

## Структура проєкту

```
finance-api/
├── data/
│   ├── users.json
│   ├── transactions.json
│   └── categories.json
├── middleware/
│   ├── auth.js          # requireAuth, requireRole
│   └── delay.js         # dev-затримка 300ms
├── routes/
│   ├── auth.js          # register, login, refresh, logout
│   ├── users.js         # профіль, адмін-список
│   ├── transactions.js  # CRUD + stats
│   └── categories.js    # список категорій
├── utils/
│   └── fileDb.js
└── server.js
```

---

## Auth

### `POST /api/auth/register`

```json
{ "email": "user@example.com", "password": "secret123", "name": "Іван" }
```

Валідація: email формат, пароль ≥ 6 символів, імʼя ≥ 2 символи.
Response 201 + httpOnly cookie `refreshToken`:

```json
{ "user": { "id": 3, "email": "...", "name": "Іван", "role": "user" }, "accessToken": "..." }
```

### `POST /api/auth/login`

```json
{ "email": "user@example.com", "password": "secret123" }
```

Response 200 — аналогічно register.

### `POST /api/auth/refresh`

Читає `refreshToken` з cookie, повертає новий `accessToken`.

### `POST /api/auth/logout`

Видаляє cookie. Response 204.

---

## Users

> Потрібен `Authorization: Bearer <accessToken>`

| Метод  | URL            | Доступ | Опис                    |
| ------ | -------------- | ------ | ----------------------- |
| GET    | /api/users/me  | user   | Власний профіль         |
| PUT    | /api/users/me  | user   | Змінити імʼя або пароль |
| GET    | /api/users     | admin  | Список усіх (пагінація) |
| DELETE | /api/users/:id | admin  | Видалити користувача    |

**PUT /api/users/me body:**

```json
{ "name": "Нове імʼя", "currentPassword": "old", "newPassword": "new123" }
```

---

## Categories

| Метод  | URL                 | Доступ | Опис                                  |
| ------ | ------------------- | ------ | ------------------------------------- |
| GET    | /api/categories     | public | Всі категорії (?type=income\|expense) |
| POST   | /api/categories     | admin  | Додати категорію                      |
| DELETE | /api/categories/:id | admin  | Видалити категорію                    |

---

## Transactions

> Потрібен `Authorization: Bearer <accessToken>`
> Кожен бачить тільки свої транзакції.

### Модель

```json
{
  "id": "uuid",
  "userId": 3,
  "type": "income",
  "amount": 1500.0,
  "category": "salary",
  "description": "Аванс",
  "date": "2025-06-01T00:00:00.000Z",
  "createdAt": "...",
  "updatedAt": "..."
}
```

### `GET /api/transactions`

| Param    | Опис                            |
| -------- | ------------------------------- |
| page     | Сторінка (default: 1)           |
| limit    | Записів (default: 20, max: 100) |
| type     | `income` або `expense`          |
| category | id категорії                    |
| dateFrom | ISO дата від (включно)          |
| dateTo   | ISO дата до (включно)           |

```json
{ "items": [...], "page": 1, "limit": 20, "totalItems": 42, "totalPages": 3 }
```

### `GET /api/transactions/stats`

Параметри: `dateFrom`, `dateTo` (опціонально).

```json
{
  "totalIncome": 5000,
  "totalExpense": 3200,
  "balance": 1800,
  "categoryBreakdown": {
    "salary": { "income": 5000, "expense": 0 },
    "food": { "income": 0, "expense": 1200 }
  },
  "monthlyBreakdown": {
    "2025-06": { "income": 5000, "expense": 3200 }
  }
}
```

### `GET /api/transactions/:id`

### `POST /api/transactions`

```json
{
  "type": "expense",
  "amount": 350,
  "category": "food",
  "description": "АТБ",
  "date": "2025-06-10"
}
```

### `PUT /api/transactions/:id` — часткове оновлення

### `DELETE /api/transactions/:id`

---

## Тестові акаунти

| Email               | Password    | Role    |
| ------------------- | ----------- | ------- |
| admin@example.com   | password123 | admin   |
| manager@example.com | password123 | manager |
| user@example.com    | password123 | user    |
