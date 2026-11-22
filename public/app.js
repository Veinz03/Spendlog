const currencyFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2
});

const form = document.getElementById('expense-form');
const dateInput = document.getElementById('date');
const descInput = document.getElementById('description');
const catInput = document.getElementById('category');
const amountInput = document.getElementById('amount');
const formStatus = document.getElementById('form-status');

const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
const applyFilterBtn = document.getElementById('apply-filter-btn');
const resetFilterBtn = document.getElementById('reset-filter-btn');

// Default date input to today's local date
function setTodayDefault() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  dateInput.value = `${yyyy}-${mm}-${dd}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatMonthLabel(ym) {
  const [year, month] = ym.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

async function loadDashboard() {
  const params = new URLSearchParams();
  if (startDateInput.value) params.set('start', startDateInput.value);
  if (endDateInput.value) params.set('end', endDateInput.value);

  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`/api/dashboard${query}`);
  const data = await res.json();

  renderExpensesTable(data.expenses);
  renderCategoryReport(data.reports.category);
  renderDailyReport(data.reports.daily);
  renderMonthlyReport(data.reports.monthly);
}

function renderExpensesTable(expenses) {
  const tbody = document.getElementById('expenses-table-body');
  if (!expenses.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-row">No expenses recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = expenses.map(item => `
    <tr>
      <td>${escapeHtml(item.date)}</td>
      <td>${escapeHtml(item.description)}</td>
      <td>${escapeHtml(item.category)}</td>
      <td class="num">${currencyFormatter.format(item.amount)}</td>
    </tr>
  `).join('');
}

function renderCategoryReport(rows) {
  const tbody = document.getElementById('category-report-body');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="2" class="empty-row">No data in range.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(row => `
    <tr>
      <td>${escapeHtml(row.category)}</td>
      <td class="num">${currencyFormatter.format(row.total)}</td>
    </tr>
  `).join('');
}

function renderDailyReport(rows) {
  const tbody = document.getElementById('daily-report-body');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="2" class="empty-row">No data in range.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(row => `
    <tr>
      <td>${escapeHtml(row.date)}</td>
      <td class="num">${currencyFormatter.format(row.total)}</td>
    </tr>
  `).join('');
}

function renderMonthlyReport(rows) {
  const tbody = document.getElementById('monthly-report-body');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="2" class="empty-row">No data in range.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(row => `
    <tr>
      <td>${escapeHtml(formatMonthLabel(row.month))}</td>
      <td class="num">${currencyFormatter.format(row.total)}</td>
    </tr>
  `).join('');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formStatus.textContent = '';

  const payload = {
    date: dateInput.value,
    description: descInput.value,
    category: catInput.value,
    amount: parseFloat(amountInput.value)
  };

  try {
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (!res.ok) {
      formStatus.textContent = result.error || 'Failed to save expense.';
      return;
    }

    descInput.value = '';
    amountInput.value = '';
    formStatus.textContent = 'Expense recorded.';
    await loadDashboard();
  } catch (err) {
    formStatus.textContent = 'Network error while saving expense.';
  }
});

applyFilterBtn.addEventListener('click', () => {
  if (startDateInput.value && endDateInput.value && startDateInput.value > endDateInput.value) {
    alert('Start Date cannot be later than End Date.');
    return;
  }
  loadDashboard();
});

resetFilterBtn.addEventListener('click', () => {
  startDateInput.value = '';
  endDateInput.value = '';
  loadDashboard();
});

// Initialize
setTodayDefault();
loadDashboard();