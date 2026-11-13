// ============================================================================
// MoneyManager Pro - App Configuration & Shared State
// ============================================================================

// Production + Local dynamic backend URL detection
const BACKEND_URL =
  window.location.origin === "null" || window.location.protocol === "file:"
    ? "http://127.0.0.1:5000"
    : window.location.origin;

function getLocalDateKey(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(d = new Date()) {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

let currentUser = null;
let authMode = "signin"; // 'signin' or 'signup'
let activeModule = 3;

let deletedArchiveVault = [];

let daybookData = {
  date: formatDisplayDate(),
  opening: { cash: 0.0, online: 0.0, total: 0.0 },
  transactions: [],
};

let yesterdaySummary = {
  hasData: false,
  opening: 0.0,
  deposits: 0.0,
  withdrawals: 0.0,
  netChange: 0.0,
};

let reportViewData = null;

const mockMonthLedger = [];
let selectedReportDateKey = getLocalDateKey();

// Standard RBI Currency Denominations
const CURRENCY_DENOMINATIONS = [500, 200, 100, 50, 20, 10];

// Active transaction denomination counts
let txDenominations = { 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0 };

// Dashboard physical vault/drawer denomination counts
let vaultDenominations = { 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0 };

// Aggregated live daybook denomination flow
let cashDenominationsFlow = {
  deposited: { 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0 },
  withdrawn: { 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0 },
  net: { 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0 },
};

/**
 * Formats a numeric value as Indian Rupees (INR).
 */
function formatINR(val) {
  return (
    "₹" +
    Number(val || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}
