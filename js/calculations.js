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

/**
 * Calculates total monetary value and total count of notes for a denomination map.
 */
function calcDenominationsTotal(denomMap) {
  let totalAmount = 0;
  let totalNotes = 0;
  if (!denomMap) return { totalAmount: 0, totalNotes: 0 };

  CURRENCY_DENOMINATIONS.forEach((denom) => {
    const count = parseInt(denomMap[denom] || 0, 10);
    if (!isNaN(count) && count > 0) {
      totalNotes += count;
      totalAmount += count * denom;
    }
  });

  return { totalAmount, totalNotes };
}

/**
 * Checks if a denomination map has at least one positive note count.
 */
function hasActiveDenominations(denomMap) {
  if (!denomMap) return false;
  return CURRENCY_DENOMINATIONS.some((d) => parseInt(denomMap[d] || 0, 10) > 0);
}

/**
 * Formats a denomination map into a concise readable string (e.g., "500×2, 200×1").
 */
function formatDenominationsSummary(denomMap) {
  if (!denomMap) return "";
  const parts = [];
  CURRENCY_DENOMINATIONS.forEach((d) => {
    const count = parseInt(denomMap[d] || 0, 10);
    if (count > 0) {
      parts.push(`₹${d}×${count}`);
    }
  });
  return parts.join(", ");
}
