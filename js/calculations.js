// ============================================================================
// MoneyManager Pro - Financial Calculations & Formatting Helpers
// ============================================================================

/**
 * Syncs the Type Effect dropdown when the user picks a service category.
 */
function syncTypeEffect() {
  const cat = document.getElementById("txCategory").value;
  const effectEl = document.getElementById("txEffect");
  if (cat.includes("Withdrawal") || cat === "Expenses") {
    effectEl.value = "Withdrawal";
  } else {
    effectEl.value = "Deposit";
  }
}

/**
 * Computes running totals, cash/online split, and net daily change.
 */
function calculateDatasetBalances(dataset) {
  let running = dataset.opening.total;
  let cashBalance = dataset.opening.cash;
  let onlineBalance = dataset.opening.online;
  let totalDeposits = 0;
  let totalWithdrawals = 0;

  const rows = (dataset.transactions || []).map((tx, idx) => {
    const isDep = tx.effect === "Deposit" || tx.type === "Deposit";
    const amt = Number(tx.amount || 0);

    if (isDep) {
      running += amt;
      totalDeposits += amt;
      if (tx.mode === "Cash") cashBalance += amt;
      else onlineBalance += amt;
    } else {
      running -= amt;
      totalWithdrawals += amt;
      if (tx.mode === "Cash") cashBalance -= amt;
      else onlineBalance -= amt;
    }

    return {
      ...tx,
      displayIndex: idx + 1,
      descText: tx.description || tx.desc || "Transaction",
      isDep: isDep,
      runningTotal: running,
    };
  });

  return {
    rows,
    running,
    cashBalance,
    onlineBalance,
    totalDeposits,
    totalWithdrawals,
    netChange: totalDeposits - totalWithdrawals,
  };
}
