// app.js — UI wiring and rendering

let state = loadState();
let chartInstance = null;

const peopleListEl = document.getElementById("people-list");
const personForm = document.getElementById("person-form");
const personNameInput = document.getElementById("person-name");

const expenseForm = document.getElementById("expense-form");
const expensePayerSelect = document.getElementById("expense-payer");
const splitAmongEl = document.getElementById("split-among");
const expenseTbody = document.getElementById("expense-tbody");
const expenseEmpty = document.getElementById("expense-empty");

const balanceListEl = document.getElementById("balance-list");
const settlementFlowEl = document.getElementById("settlement-flow");
const settlementEmpty = document.getElementById("settlement-empty");

const exportPdfBtn = document.getElementById("export-pdf");
const exportWhatsappBtn = document.getElementById("export-whatsapp");
const resetAllBtn = document.getElementById("reset-all");

function persist() {
  saveState(state);
}

// ---------- People ----------

function renderPeople() {
  peopleListEl.innerHTML = "";
  state.people.forEach(name => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${escapeHtml(name)}</span>`;
    const removeBtn = document.createElement("button");
    removeBtn.className = "chip-remove";
    removeBtn.textContent = "✕";
    removeBtn.setAttribute("aria-label", `Remove ${name}`);
    removeBtn.addEventListener("click", () => removePerson(name));
    li.appendChild(removeBtn);
    peopleListEl.appendChild(li);
  });

  renderPayerOptions();
  renderSplitChecks();
}

function addPerson(name) {
  const trimmed = name.trim();
  if (!trimmed) return;
  if (state.people.includes(trimmed)) return;
  state.people.push(trimmed);
  persist();
  renderPeople();
  renderAll();
}

function removePerson(name) {
  state.people = state.people.filter(p => p !== name);
  // Remove them from any expenses they're tied to
  state.expenses = state.expenses.filter(exp => exp.payer !== name);
  state.expenses.forEach(exp => {
    exp.splitAmong = exp.splitAmong.filter(p => p !== name);
  });
  persist();
  renderPeople();
  renderExpenses();
  renderAll();
}

personForm.addEventListener("submit", e => {
  e.preventDefault();
  addPerson(personNameInput.value);
  personNameInput.value = "";
  personNameInput.focus();
});

// ---------- Expense form helpers ----------

function renderPayerOptions() {
  const current = expensePayerSelect.value;
  expensePayerSelect.innerHTML = "";
  if (state.people.length === 0) {
    const opt = document.createElement("option");
    opt.textContent = "Add people first";
    opt.value = "";
    expensePayerSelect.appendChild(opt);
    return;
  }
  state.people.forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    expensePayerSelect.appendChild(opt);
  });
  if (state.people.includes(current)) expensePayerSelect.value = current;
}

function renderSplitChecks() {
  splitAmongEl.innerHTML = "";
  state.people.forEach(name => {
    const label = document.createElement("label");
    label.className = "split-check";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = name;
    checkbox.checked = true;
    label.appendChild(checkbox);
    const span = document.createElement("span");
    span.textContent = name;
    label.appendChild(span);
    splitAmongEl.appendChild(label);
  });
}

// ---------- Expenses ----------

function renderExpenses() {
  expenseTbody.innerHTML = "";
  if (state.expenses.length === 0) {
    expenseEmpty.style.display = "block";
  } else {
    expenseEmpty.style.display = "none";
  }

  state.expenses.forEach(exp => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(exp.desc)}</td>
      <td>₹${exp.amount.toFixed(2)}</td>
      <td>${escapeHtml(exp.payer)}</td>
      <td>${exp.splitAmong.map(escapeHtml).join(", ")}</td>
      <td></td>
    `;
    const removeBtn = document.createElement("button");
    removeBtn.className = "row-remove";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => removeExpense(exp.id));
    tr.lastElementChild.appendChild(removeBtn);
    expenseTbody.appendChild(tr);
  });
}

function addExpense(desc, amount, payer, splitAmong) {
  if (!desc.trim() || !amount || amount <= 0 || !payer || splitAmong.length === 0) return;
  state.expenses.push({
    id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    desc: desc.trim(),
    amount: parseFloat(amount),
    payer,
    splitAmong
  });
  persist();
  renderExpenses();
  renderAll();
}

function removeExpense(id) {
  state.expenses = state.expenses.filter(e => e.id !== id);
  persist();
  renderExpenses();
  renderAll();
}

expenseForm.addEventListener("submit", e => {
  e.preventDefault();
  const desc = document.getElementById("expense-desc").value;
  const amount = document.getElementById("expense-amount").value;
  const payer = expensePayerSelect.value;
  const splitAmong = Array.from(splitAmongEl.querySelectorAll("input[type=checkbox]:checked")).map(cb => cb.value);

  if (state.people.length === 0) {
    alert("Add at least one person first.");
    return;
  }
  if (!payer) {
    alert("Choose who paid.");
    return;
  }
  if (splitAmong.length === 0) {
    alert("Select at least one person to split among.");
    return;
  }

  addExpense(desc, amount, payer, splitAmong);
  expenseForm.reset();
  renderSplitChecks(); // re-check all boxes by default
});

// ---------- Balances + chart ----------

function renderBalances() {
  const balances = computeBalances(state.people, state.expenses);
  balanceListEl.innerHTML = "";

  state.people.forEach(name => {
    const amt = balances[name] || 0;
    const li = document.createElement("li");
    const sign = amt > 0 ? "+" : "";
    const cls = amt >= 0 ? "bal-pos" : "bal-neg";
    li.innerHTML = `<span>${escapeHtml(name)}</span><span class="bal-amount ${cls}">${sign}₹${amt.toFixed(2)}</span>`;
    balanceListEl.appendChild(li);
  });

  renderChart(balances);
  return balances;
}

function renderChart(balances) {
  const ctx = document.getElementById("balance-chart");
  const labels = Object.keys(balances);
  const data = labels.map(l => balances[l]);
  const colors = data.map(v => v >= 0 ? "#3D6B4A" : "#A6441F");

  if (chartInstance) chartInstance.destroy();

  if (labels.length === 0) return;

  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Net balance (₹)",
        data,
        backgroundColor: colors,
        borderRadius: 3
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { grid: { color: "#DCD5C4" } },
        x: { grid: { display: false } }
      }
    }
  });
}

// ---------- Settlement (signature visual) ----------

function arrowSvg() {
  return `
  <svg viewBox="0 0 100 22" preserveAspectRatio="none">
    <line x1="2" y1="11" x2="90" y2="11" stroke="#9C7A2E" stroke-width="1.5" stroke-dasharray="4 3"/>
    <path d="M84 5 L94 11 L84 17" fill="none" stroke="#9C7A2E" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function renderSettlements(balances) {
  const settlements = simplifyDebts(balances);
  settlementFlowEl.innerHTML = "";

  if (settlements.length === 0) {
    settlementEmpty.style.display = "block";
    exportPdfBtn.disabled = true;
    exportWhatsappBtn.disabled = true;
    return settlements;
  }

  settlementEmpty.style.display = "none";
  exportPdfBtn.disabled = false;
  exportWhatsappBtn.disabled = false;

  settlements.forEach(s => {
    const row = document.createElement("div");
    row.className = "settle-row";
    row.innerHTML = `
      <div class="settle-name debtor">${escapeHtml(s.from)}</div>
      <div class="settle-arrow">
        ${arrowSvg()}
        <div class="settle-amount">₹${s.amount.toFixed(2)}</div>
      </div>
      <div class="settle-name creditor">${escapeHtml(s.to)}</div>
    `;
    settlementFlowEl.appendChild(row);
  });

  return settlements;
}

// ---------- Export ----------

function buildSummaryText(settlements) {
  if (settlements.length === 0) return "Everyone is settled up — no payments needed.";
  return settlements.map(s => `${s.from} pays ${s.to} ₹${s.amount.toFixed(2)}`).join("\n");
}

exportPdfBtn.addEventListener("click", () => {
  const balances = computeBalances(state.people, state.expenses);
  const settlements = simplifyDebts(balances);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text("Ledger — Settlement Summary", 14, 20);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Generated ${new Date().toLocaleDateString()}`, 14, 27);

  let y = 40;
  doc.setFontSize(13);
  doc.setTextColor(20);
  if (settlements.length === 0) {
    doc.text("Everyone is settled up — no payments needed.", 14, y);
  } else {
    settlements.forEach(s => {
      doc.text(`${s.from}  ->  ${s.to}      Rs. ${s.amount.toFixed(2)}`, 14, y);
      y += 9;
    });
  }

  doc.save("ledger-settlement-summary.pdf");
});

exportWhatsappBtn.addEventListener("click", () => {
  const balances = computeBalances(state.people, state.expenses);
  const settlements = simplifyDebts(balances);
  const text = encodeURIComponent("Ledger settlement summary:\n" + buildSummaryText(settlements));
  window.open(`https://wa.me/?text=${text}`, "_blank");
});

resetAllBtn.addEventListener("click", () => {
  if (!confirm("Clear all people and expenses? This can't be undone.")) return;
  state = { people: [], expenses: [] };
  clearState();
  renderPeople();
  renderExpenses();
  renderAll();
});

// ---------- Utility ----------

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderAll() {
  const balances = renderBalances();
  renderSettlements(balances);
}

// ---------- Init ----------

renderPeople();
renderExpenses();
renderAll();
