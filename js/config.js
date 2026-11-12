// ============================================================================
// MoneyManager Pro - App Configuration & Shared State
// ============================================================================

// Production + Local dynamic backend URL detection
const BACKEND_URL =
  window.location.origin === "null" || window.location.protocol === "file:"
    ? "http://127.0.0.1:5000"
    : window.location.origin;

let currentUser = null;
let authMode = "signin"; // 'signin' or 'signup'
let activeModule = 3;

let deletedArchiveVault = [];

let daybookData = {
  date: "Wednesday, Nov 11, 2026",
  opening: { cash: 0.0, online: 0.0, total: 0.0 },
  transactions: [],
};

const mockMonthLedger = [];
let selectedReportDateKey = "2026-11-11";

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
