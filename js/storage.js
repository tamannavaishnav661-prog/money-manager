// ============================================================================
// MoneyManager Pro - Backend API & Data Storage Layer
// ============================================================================

/**
 * Helper for JSON fetch requests to the Flask backend.
 */
async function apiRequest(path, options = {}) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  return res.json();
}

async function apiRegister(email, mobile, password) {
  return apiRequest("/api/register", {
    method: "POST",
    body: JSON.stringify({ email, mobile, password }),
  });
}

async function apiLoginStep1(email, mobile, password) {
  return apiRequest("/api/login/step1", {
    method: "POST",
    body: JSON.stringify({ email, mobile, password }),
  });
}

async function apiLoginStep2(email, otp) {
  return apiRequest("/api/login/step2", {
    method: "POST",
    body: JSON.stringify({ email, otp }),
  });
}

async function apiFetchDaybook(userId) {
  return apiRequest(`/api/daybook?user_id=${userId}`);
}

async function apiAddTransaction(tx) {
  return apiRequest("/api/transactions", {
    method: "POST",
    body: JSON.stringify(tx),
  });
}

async function apiDeleteTransaction(txId, userId) {
  return apiRequest(`/api/transactions/${txId}?user_id=${userId}`, {
    method: "DELETE",
  });
}

async function apiRestoreDeleted(userId) {
  return apiRequest("/api/recover/restore", {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

async function apiSendEmailBackup(userId, email) {
  return apiRequest("/api/recover/email-backup", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, email }),
  });
}

async function apiUpdateOpeningBalance(userId, openingCash, openingOnline) {
  return apiRequest("/api/opening-balance", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      opening_cash: openingCash,
      opening_online: openingOnline,
    }),
  });
}
