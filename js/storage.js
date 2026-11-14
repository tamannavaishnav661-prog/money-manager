// ============================================================================
// MoneyManager Pro - Backend API & Data Storage Layer
// ============================================================================

const SESSION_STORAGE_KEY = "moneymanager_pro_session";

function saveUserSession(user) {
  if (!user) return;
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
  } catch (e) {
    console.warn("Could not save user session", e);
  }
}

function getUserSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function clearUserSession() {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (e) {
    console.warn("Could not clear user session", e);
  }
}

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

async function apiVerifySession(user) {
  return apiRequest("/api/auth/verify-session", {
    method: "POST",
    body: JSON.stringify(user),
  });
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

async function apiFetchDaybook(userId, dateStr = "") {
  const query = dateStr
    ? `user_id=${userId}&date=${encodeURIComponent(dateStr)}`
    : `user_id=${userId}`;
  return apiRequest(`/api/daybook?${query}`);
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

async function apiUpdateOpeningBalance(userId, openingCash, openingOnline, dateStr = "") {
  return apiRequest("/api/opening-balance", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      date: dateStr || getLocalDateKey(),
      opening_cash: openingCash,
      opening_online: openingOnline,
    }),
  });
}
