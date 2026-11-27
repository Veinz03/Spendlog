require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// To connect sya sa Neon PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Automatically naga create ng expenses table if it doesn't exist
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        expense_date VARCHAR(10) NOT NULL,
        description TEXT NOT NULL,
        category VARCHAR(40) NOT NULL,
        amount NUMERIC(12, 2) NOT NULL
      )
    `);
    await pool.query('ALTER TABLE expenses ALTER COLUMN description TYPE TEXT');
    console.log('Connected to Neon PostgreSQL and verified expenses table.');
  } catch (err) {
    console.error('Database initialization error:', err.message);
  }
}
initDB();

// ito, ewan ko haha Helper: Build inclusive date-range WHERE clause ($1, $2)
function buildDateFilter(start, end) {
  const conditions = [];
  const params = [];

  if (start) {
    params.push(start);
    conditions.push(`expense_date >= $${params.length}`);
  }
  if (end) {
    params.push(end);
    conditions.push(`expense_date <= $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, params };
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function localDateString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

// Dito yung POST /api/expenses to record a new expense
app.post('/api/expenses', async (req, res) => {
  const { date, description, category, amount } = req.body;

  if (!isValidDate(date) || date < localDateString()) {
    return res.status(400).json({ error: 'Date must be today or a future date.' });
  }
  if (typeof description !== 'string' || !description.trim() || description.trim().length > 1000) {
    return res.status(400).json({ error: 'Description is required and must be 1,000 characters or fewer.' });
  }
  if (typeof category !== 'string' || !category.trim() || category.trim().length > 40) {
    return res.status(400).json({ error: 'Category is required and must be 40 characters or fewer.' });
  }
  if (category.trim().toLowerCase() === 'dropout') {
    return res.status(400).json({ error: 'Dropout is not an available category.' });
  }
  if (!Number.isInteger(Number(amount)) || Number(amount) < 1 || Number(amount) > 9999999999) {
    return res.status(400).json({ error: 'Amount must be a whole number between 1 and 9,999,999,999.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO expenses (expense_date, description, category, amount) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, expense_date AS date, description, category, amount::float`,
      [date, description.trim(), category.trim(), Number(amount)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dito naman GET /api/dashboard para ma fetch yung expense table + all 3 reports
app.get('/api/dashboard', async (req, res) => {
  try {
    const { start, end } = req.query;
    if ((start && !isValidDate(start)) || (end && !isValidDate(end))) {
      return res.status(400).json({ error: 'Start and end dates must be valid dates.' });
    }
    if (start && end && start > end) {
      return res.status(400).json({ error: 'Start Date cannot be later than End Date.' });
    }
    const { whereClause, params } = buildDateFilter(start, end);

    // 1. all recorded expenses
    const expensesRes = await pool.query(
      `SELECT id, expense_date AS date, description, category, amount::float 
       FROM expenses 
       ORDER BY expense_date DESC, id DESC`
    );

    // 2. category report
    const categoryRes = await pool.query(
      `SELECT category, ROUND(SUM(amount), 2)::float AS total 
       FROM expenses 
       ${whereClause} 
       GROUP BY category 
       ORDER BY total DESC`,
      params
    );

    // 3. daily report
    const dailyRes = await pool.query(
      `SELECT expense_date AS date, ROUND(SUM(amount), 2)::float AS total 
       FROM expenses 
       ${whereClause} 
       GROUP BY expense_date 
       ORDER BY expense_date DESC`,
      params
    );

    // 4. monthly report
    const monthlyRes = await pool.query(
      `SELECT SUBSTRING(expense_date, 1, 7) AS month, ROUND(SUM(amount), 2)::float AS total 
       FROM expenses 
       ${whereClause} 
       GROUP BY SUBSTRING(expense_date, 1, 7) 
       ORDER BY month DESC`,
      params
    );

    res.json({
      expenses: expensesRes.rows,
      reports: {
        category: categoryRes.rows,
        daily: dailyRes.rows,
        monthly: monthlyRes.rows
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`SpendLog server running at http://localhost:${PORT}`);
});