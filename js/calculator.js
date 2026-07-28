// calculator.js — balance computation + debt simplification

/**
 * Compute net balance per person.
 * expenses: [{ id, desc, amount, payer, splitAmong: [names] }]
 * Returns: { name: netBalance } where positive = owed money, negative = owes money
 */
function computeBalances(people, expenses) {
  const balances = {};
  people.forEach(p => { balances[p] = 0; });

  expenses.forEach(exp => {
    const participants = exp.splitAmong.filter(p => balances.hasOwnProperty(p));
    if (participants.length === 0) return;
    const share = exp.amount / participants.length;

    // Payer gets credited the full amount
    if (balances.hasOwnProperty(exp.payer)) {
      balances[exp.payer] += exp.amount;
    }
    // Each participant (including payer, if included) is debited their share
    participants.forEach(p => {
      balances[p] -= share;
    });
  });

  // Round to 2 decimals to avoid floating point noise
  Object.keys(balances).forEach(k => {
    balances[k] = Math.round(balances[k] * 100) / 100;
  });

  return balances;
}

/**
 * Greedy debt simplification.
 * Repeatedly match the largest creditor with the largest debtor,
 * settle the smaller of the two amounts, and repeat.
 * Produces at most (n-1) transactions instead of the naive O(n^2).
 *
 * balances: { name: netAmount }
 * Returns: [{ from, to, amount }]
 */
function simplifyDebts(balances) {
  const EPSILON = 0.01;

  // Build working lists of creditors (owed money) and debtors (owe money)
  let creditors = [];
  let debtors = [];

  Object.entries(balances).forEach(([name, amount]) => {
    if (amount > EPSILON) creditors.push({ name, amount });
    else if (amount < -EPSILON) debtors.push({ name, amount: -amount });
  });

  const settlements = [];

  while (creditors.length > 0 && debtors.length > 0) {
    // Sort so the largest creditor and largest debtor are at the front
    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    const creditor = creditors[0];
    const debtor = debtors[0];

    const settledAmount = Math.min(creditor.amount, debtor.amount);
    const rounded = Math.round(settledAmount * 100) / 100;

    if (rounded > 0) {
      settlements.push({ from: debtor.name, to: creditor.name, amount: rounded });
    }

    creditor.amount -= settledAmount;
    debtor.amount -= settledAmount;

    if (creditor.amount <= EPSILON) creditors.shift();
    if (debtor.amount <= EPSILON) debtors.shift();
  }

  return settlements;
}
