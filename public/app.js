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
const filterStatus = document.getElementById('filter-status');
const expenseFields = {
  date: document.getElementById('date-error'),
  description: document.getElementById('description-error'),
  category: document.getElementById('category-error'),
  amount: document.getElementById('amount-error')
};

function localDateString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function setTodayDefault() {
  dateInput.min = localDateString();
  dateInput.value = dateInput.min;
}

function updateDateRangeConstraints() {
  endDateInput.min = startDateInput.value;
  startDateInput.max = endDateInput.value;
}

function validateExpense() {
  const amount = Number(amountInput.value);
  const errors = {
    date: !dateInput.value
      ? 'Choose an expense date.'
      : dateInput.value < dateInput.min
        ? 'Date cannot be in the past.'
        : '',
    description: !descInput.value.trim()
      ? 'Enter a description.'
      : descInput.value.trim().length > 1000
        ? 'Description must be 1,000 characters or fewer.'
        : '',
    category: !catInput.value.trim()
      ? 'Enter a category.'
      : catInput.value.trim().toLowerCase() === 'dropout'
        ? 'Dropout is not an available category.'
        : '',
    amount: !amountInput.value
      ? 'Enter an amount.'
      : !Number.isInteger(amount) || amount < 1
        ? 'Amount must be a whole number between 1 and 9,999,999,999.'
        : amount > Number(amountInput.max)
          ? 'Amount exceeds the maximum supported value.'
          : ''
  };

  Object.keys(errors).forEach(key => {
    expenseFields[key].textContent = errors[key];
    document.getElementById(key).setAttribute('aria-invalid', String(Boolean(errors[key])));
  });
  return Object.values(errors).every(error => !error);
}

function clearExpenseErrors() {
  Object.keys(expenseFields).forEach(key => {
    expenseFields[key].textContent = '';
    document.getElementById(key).setAttribute('aria-invalid', 'false');
  });
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
  if (!res.ok) throw new Error('Failed to load dashboard data.');
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
      <td><span class="description-cell">${escapeHtml(item.description)}</span></td>
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
  if (!validateExpense()) {
    formStatus.textContent = 'Please correct the highlighted fields.';
    return;
  }

  const payload = {
    date: dateInput.value,
    description: descInput.value.trim(),
    category: catInput.value.trim(),
    amount: Number(amountInput.value)
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
    catInput.value = '';
    clearExpenseErrors();
    formStatus.textContent = 'Expense recorded.';
    try {
      await loadDashboard();
    } catch (err) {
      formStatus.textContent = 'Expense recorded, but dashboard data could not be refreshed.';
    }
  } catch (err) {
    formStatus.textContent = 'Network error while saving expense.';
  }
});

form.addEventListener('input', () => {
  if (formStatus.textContent === 'Please correct the highlighted fields.') {
    validateExpense();
    if (Object.values(expenseFields).every(field => !field.textContent)) formStatus.textContent = '';
  }
});

startDateInput.addEventListener('input', () => {
  updateDateRangeConstraints();
  filterStatus.textContent = '';
});
endDateInput.addEventListener('input', () => {
  updateDateRangeConstraints();
  filterStatus.textContent = '';
});

applyFilterBtn.addEventListener('click', async () => {
  filterStatus.textContent = '';
  if (startDateInput.value && endDateInput.value && startDateInput.value > endDateInput.value) {
    filterStatus.textContent = 'Start Date cannot be later than End Date.';
    return;
  }
  try {
    await loadDashboard();
  } catch (err) {
    filterStatus.textContent = 'Unable to load reports. Please try again.';
  }
});

resetFilterBtn.addEventListener('click', async () => {
  startDateInput.value = '';
  endDateInput.value = '';
  updateDateRangeConstraints();
  filterStatus.textContent = '';
  try {
    await loadDashboard();
  } catch (err) {
    filterStatus.textContent = 'Unable to load reports. Please try again.';
  }
});

// Initialize
setTodayDefault();
updateDateRangeConstraints();
loadDashboard().catch(() => {
  filterStatus.textContent = 'Unable to load dashboard data. Please refresh the page.';
});