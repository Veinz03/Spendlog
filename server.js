require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to Neon PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Automatically create the expenses table if it doesn't exist
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        expense_date VARCHAR(10) NOT NULL,
        description VARCHAR(100) NOT NULL,
        category VARCHAR(40) NOT NULL,
        amount NUMERIC(12, 2) NOT NULL
      )
    `);
    console.log('Connected to Neon PostgreSQL and verified expenses table.');
  } catch (err) {
    console.error('Database initialization error:', err.message);
  }
}
initDB();

// Helper: Build inclusive date-range WHERE clause ($1, $2)
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

// POST /api/expenses - Record a new expense
app.post('/api/expenses', async (req, res) => {
  const { date, description, category, amount } = req.body;

  if (!date || !description || !category || amount === undefined || isNaN(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({ error: 'All fields are required and amount must be greater than 0.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO expenses (expense_date, description, category, amount) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, expense_date AS date, description, category, amount::float`,
      [date.trim(), description.trim(), category.trim(), Number(amount)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard - Fetch expense table + all 3 reports
app.get('/api/dashboard', async (req, res) => {
  try {
    const { start, end } = req.query;
    const { whereClause, params } = buildDateFilter(start, end);

    // 1. All recorded expenses
    const expensesRes = await pool.query(
      `SELECT id, expense_date AS date, description, category, amount::float 
       FROM expenses 
       ORDER BY expense_date DESC, id DESC`
    );

    // 2. Category Report
    const categoryRes = await pool.query(
      `SELECT category, ROUND(SUM(amount), 2)::float AS total 
       FROM expenses 
       ${whereClause} 
       GROUP BY category 
       ORDER BY total DESC`,
      params
    );

    // 3. Daily Report
    const dailyRes = await pool.query(
      `SELECT expense_date AS date, ROUND(SUM(amount), 2)::float AS total 
       FROM expenses 
       ${whereClause} 
       GROUP BY expense_date 
       ORDER BY expense_date DESC`,
      params
    );

    // 4. Monthly Report
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