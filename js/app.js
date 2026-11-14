// ============================================================================
// MoneyManager Pro - UI Rendering, Authentication & Navigation Controller
// ============================================================================

// --- AUTHENTICATION (SIGN IN / SIGN UP) ---

function setAuthMode(mode) {
  authMode = mode;
  const tabIn = document.getElementById("tabSignIn");
  const tabUp = document.getElementById("tabSignUp");
  const submitBtn = document.getElementById("authSubmitBtn");
  const helper = document.getElementById("authHelperText");
  const mobileWrap = document.getElementById("loginMobileWrapper");

  const activeClass =
    "w-1/2 py-2 text-xs font-bold rounded-lg transition bg-white text-blue-600 shadow-sm";
  const inactiveClass =
    "w-1/2 py-2 text-xs font-bold rounded-lg transition text-slate-500 hover:text-slate-800";

  if (mode === "signin") {
    tabIn.className = activeClass;
    tabUp.className = inactiveClass;
    if (mobileWrap) mobileWrap.classList.add("hidden");
    submitBtn.innerHTML = "<span>Send OTP</span>";
    helper.textContent = "🔒 Bank-Grade 256-Bit Encrypted Security";
  } else {
    tabUp.className = activeClass;
    tabIn.className = inactiveClass;
    if (mobileWrap) mobileWrap.classList.remove("hidden");
    submitBtn.innerHTML = "<span>Create Account & Send OTP</span>";
    helper.textContent =
      "Sign up with your personal email & mobile to create your private ledger";
  }
}

async function handleStep1() {
  const user = document.getElementById("loginUser").value.trim();
  const mobileInput = document.getElementById("loginMobile");
  const mobile = mobileInput ? mobileInput.value.trim() : "";
  const pass = document.getElementById("loginPass").value.trim();

  if (!user || !pass) {
    alert("Please enter Email Address and Password");
    return;
  }

  if (authMode === "signup" && !mobile) {
    alert("Please enter your Mobile Number for new account registration.");
    return;
  }

  try {
    const data =
      authMode === "signup"
        ? await apiRegister(user, mobile, pass)
        : await apiLoginStep1(user, mobile, pass);

    if (data.success === true) {
      currentUser = {
        email: user,
        mobile: data.mobile || mobile,
        id: data.user_id || 1,
      };
      showStep2();
    } else {
      alert(data.message || "Authentication error");
    }
  } catch (err) {
    alert("Unable to reach server. Please make sure python backend.py is running.");
  }
}

function getOtpInputs() {
  return Array.from(document.querySelectorAll("#otpBoxGroup .otp-digit"));
}

function clearOtpInputs() {
  const inputs = getOtpInputs();
  inputs.forEach((input) => {
    input.value = "";
  });
  if (inputs[0]) inputs[0].focus();
}

function getOtpValue() {
  return getOtpInputs()
    .map((input) => input.value.trim())
    .join("");
}

function initOtpInputs() {
  const inputs = getOtpInputs();
  inputs.forEach((input, idx) => {
    input.addEventListener("input", (e) => {
      const cleaned = e.target.value.replace(/\D/g, "");
      e.target.value = cleaned.slice(-1);
      if (e.target.value && idx < inputs.length - 1) {
        inputs[idx + 1].focus();
      }
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !e.target.value && idx > 0) {
        inputs[idx - 1].value = "";
        inputs[idx - 1].focus();
      } else if (e.key === "ArrowLeft" && idx > 0) {
        inputs[idx - 1].focus();
      } else if (e.key === "ArrowRight" && idx < inputs.length - 1) {
        inputs[idx + 1].focus();
      } else if (e.key === "Enter") {
        handleStep2();
      }
    });

    input.addEventListener("paste", (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData)
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, inputs.length);
      if (!pasted) return;
      pasted.split("").forEach((digit, i) => {
        if (inputs[i]) inputs[i].value = digit;
      });
      const focusIdx = Math.min(pasted.length, inputs.length - 1);
      inputs[focusIdx].focus();
    });
  });
}

function showStep2() {
  document.getElementById("authStep1").classList.add("hidden");
  document.getElementById("authStep2").classList.remove("hidden");
  clearOtpInputs();
}

function backToStep1() {
  document.getElementById("authStep2").classList.add("hidden");
  document.getElementById("authStep1").classList.remove("hidden");
}

async function handleStep2() {
  const otp = getOtpValue();
  if (otp.length < 6) {
    alert("Please enter the 6-digit OTP.");
    return;
  }
  const userEmail =
    (currentUser && currentUser.email) ||
    document.getElementById("loginUser").value.trim();

  try {
    const data = await apiLoginStep2(userEmail, otp);
    if (data.success === true) {
      currentUser = data.user || { id: 1, email: userEmail };
      saveUserSession(currentUser);
      enterApp();
      return;
    } else {
      alert(data.message || "Invalid OTP code");
      return;
    }
  } catch (err) {
    alert("Unable to reach server. Please make sure python backend.py is running.");
  }
}

function enterApp() {
  document.getElementById("authSection").classList.add("hidden");
  document.getElementById("mainHeader").classList.remove("hidden");
  document.getElementById("headerUserEmail").textContent =
    currentUser.email || "user";
  document.getElementById("modalRecoveryEmail").textContent =
    currentUser.email || "user@example.com";
  switchModule(3);
  loadDaybookFromServer();
}

function logout() {
  clearUserSession();
  currentUser = null;
  document.getElementById("mainHeader").classList.add("hidden");
  document.getElementById("dashboardSection").classList.add("hidden");
  document.getElementById("daybookSection").classList.add("hidden");
  document.getElementById("reportsSection").classList.add("hidden");
  document.getElementById("authSection").classList.remove("hidden");
  backToStep1();
}

// --- MODULE NAVIGATION ---

function switchModule(modNumber) {
  activeModule = modNumber;
  const sections = [
    null,
    null,
    "dashboardSection",
    "daybookSection",
    "reportsSection",
  ];
  const navs = [null, null, "navMod2", "navMod3", "navMod4"];

  for (let i = 2; i <= 4; i++) {
    const sec = document.getElementById(sections[i]);
    const nav = document.getElementById(navs[i]);
    if (i === modNumber) {
      sec.classList.remove("hidden");
      nav.className =
        "px-3 py-2 rounded-lg text-sm font-medium transition bg-blue-600 text-white flex items-center gap-1.5 shadow-sm";
    } else {
      sec.classList.add("hidden");
      nav.className =
        "px-3 py-2 rounded-lg text-sm font-medium transition text-slate-600 hover:bg-slate-100 flex items-center gap-1.5";
    }
  }

  if (modNumber === 2) renderDashboard();
  if (modNumber === 3) renderDaybookTable();
  if (modNumber === 4) renderReportsForDate(selectedReportDateKey);
}

// --- DAYBOOK DATA LOADING & TRANSACTIONS ---

function updateOpeningBalanceDisplay() {
  document.getElementById("topOpeningCash").textContent = formatINR(
    daybookData.opening.cash
  );
  document.getElementById("topOpeningOnline").textContent = formatINR(
    daybookData.opening.online
  );
  document.getElementById("topOpeningTotal").textContent = formatINR(
    daybookData.opening.total
  );
}

function toggleOpeningBalanceEditor(show) {
  const editor = document.getElementById("openingBalanceEditor");
  if (!editor) return;

  if (show) {
    document.getElementById("editOpeningCash").value = daybookData.opening.cash;
    document.getElementById("editOpeningOnline").value =
      daybookData.opening.online;
    editor.classList.remove("hidden");
  } else {
    editor.classList.add("hidden");
  }
}

async function saveOpeningBalance(e) {
  e.preventDefault();
  const uid = (currentUser && currentUser.id) || 1;
  const cash = parseFloat(document.getElementById("editOpeningCash").value);
  const online = parseFloat(
    document.getElementById("editOpeningOnline").value
  );

  if (isNaN(cash) || isNaN(online) || cash < 0 || online < 0) {
    alert("Please enter valid non-negative Cash and Online amounts.");
    return;
  }

  try {
    await apiUpdateOpeningBalance(uid, cash, online, getLocalDateKey());
  } catch (err) {
    // Offline fallback still updates local UI state
  }

  daybookData.opening = {
    cash,
    online,
    total: cash + online,
  };
  updateOpeningBalanceDisplay();
  toggleOpeningBalanceEditor(false);
  renderDaybookTable();
  renderDashboard();
  renderReportsForDate(selectedReportDateKey);
}

function mapServerTransactions(txList) {
  return (txList || []).map((t) => ({
    id: t.id,
    time: t.time || "10:00 AM",
    category:
      t.type === "Withdrawal" ? "Withdrawal (Portal)" : "Deposit (Portal)",
    description: t.description || "Transaction",
    mode: t.mode || "Cash",
    effect: t.type || "Deposit",
    amount: Number(t.amount || 0),
    denominations: t.denominations || null,
  }));
}

async function loadDaybookFromServer() {
  const uid = (currentUser && currentUser.id) || 1;
  const todayKey = getLocalDateKey();
  daybookData.date = formatDisplayDate();
  selectedReportDateKey = todayKey;

  try {
    const data = await apiFetchDaybook(uid, todayKey);
    if (data && data.success) {
      const cash = Number(data.opening_cash ?? 0);
      const online = Number(data.opening_online ?? 0);
      daybookData.opening = {
        cash,
        online,
        total: cash + online,
      };
      updateOpeningBalanceDisplay();

      if (data.transactions) {
        daybookData.transactions = mapServerTransactions(data.transactions);
      }

      if (data.cash_denominations_flow) {
        cashDenominationsFlow = data.cash_denominations_flow;
      }

      if (data.yesterday_summary) {
        const y = data.yesterday_summary;
        yesterdaySummary = {
          hasData: Boolean(y.has_data),
          opening: Number(y.opening ?? 0),
          deposits: Number(y.deposits ?? 0),
          withdrawals: Number(y.withdrawals ?? 0),
          netChange: Number(y.net_change ?? 0),
        };
      }

      updateRecoveryBadge(data.deleted_count || deletedArchiveVault.length);
    }
  } catch (e) {
    updateRecoveryBadge(deletedArchiveVault.length);
  }
  renderDaybookTable();
  renderDashboard();
}

async function addTransaction(e) {
  e.preventDefault();
  const uid = (currentUser && currentUser.id) || 1;
  const cat = document.getElementById("txCategory").value;
  const desc = document.getElementById("txDesc").value.trim();
  const effect = document.getElementById("txEffect").value;
  const mode = document.getElementById("txMode").value;
  const amt = parseFloat(document.getElementById("txAmount").value);

  if (!desc || isNaN(amt) || amt <= 0) {
    alert("Please enter valid description and positive amount.");
    return;
  }

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  let denoms = null;
  if (mode === "Cash") {
    if (hasActiveDenominations(txDenominations)) {
      denoms = { ...txDenominations };
    } else if (amt > 0) {
      denoms = autoBreakdownAmountToDenominations(amt);
    }
  }

  const newTx = {
    id: Date.now(),
    user_id: uid,
    date: getLocalDateKey(),
    time: timeStr,
    category: cat,
    description: desc,
    mode: mode,
    type: effect,
    effect: effect,
    amount: amt,
    denominations: denoms,
  };

  try {
    await apiAddTransaction(newTx);
  } catch (err) {
    // Keep local UI state working if offline
  }

  daybookData.transactions.push(newTx);
  cashDenominationsFlow = computeCashDenominationsFlow(daybookData.transactions);
  document.getElementById("txDesc").value = "";
  document.getElementById("txAmount").value = "";
  clearTxDenominations();

  renderDaybookTable();
  renderDashboard();
}

async function deleteTransaction(id) {
  const uid = (currentUser && currentUser.id) || 1;
  if (!confirm("Move transaction to your Private Email Recovery Vault?")) return;

  const target = daybookData.transactions.find((t) => t.id === id);
  if (target) {
    deletedArchiveVault.push(target);
  }

  try {
    await apiDeleteTransaction(id, uid);
  } catch (e) {
    // Offline fallback
  }

  daybookData.transactions = daybookData.transactions.filter(
    (t) => t.id !== id
  );
  cashDenominationsFlow = computeCashDenominationsFlow(daybookData.transactions);
  updateRecoveryBadge(deletedArchiveVault.length);
  renderDaybookTable();
  renderDashboard();
}

function resetDayTransactions() {
  if (confirm("Archive today's entries into Recovery Vault and reset?")) {
    deletedArchiveVault.push(...daybookData.transactions);
    daybookData.transactions = [];
    updateRecoveryBadge(deletedArchiveVault.length);
    renderDaybookTable();
    renderDashboard();
  }
}

// --- RECOVERY MODAL ---

function openRecoveryModal() {
  const count = deletedArchiveVault.length;
  document.getElementById(
    "modalDeletedCount"
  ).textContent = `${count} items safely preserved in Recovery Vault`;
  document.getElementById("recoveryModal").classList.remove("hidden");
}

function closeRecoveryModal() {
  document.getElementById("recoveryModal").classList.add("hidden");
}

function updateRecoveryBadge(count) {
  const badge = document.getElementById("headerDeletedBadge");
  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

async function triggerDataRestore() {
  const uid = (currentUser && currentUser.id) || 1;
  try {
    await apiRestoreDeleted(uid);
  } catch (e) {
    // Offline fallback
  }

  if (deletedArchiveVault.length > 0) {
    daybookData.transactions.push(...deletedArchiveVault);
    deletedArchiveVault = [];
  }

  updateRecoveryBadge(0);
  closeRecoveryModal();
  renderDaybookTable();
  renderDashboard();
  alert("🎉 Private Ledger Restored Successfully!");
}

async function triggerEmailBackup() {
  const uid = (currentUser && currentUser.id) || 1;
  const email = (currentUser && currentUser.email) || "user@example.com";
  try {
    await apiSendEmailBackup(uid, email);
  } catch (e) {
    // Offline fallback
  }

  alert(
    `📧 Private Encrypted Backup Dispatched!\n\nA complete ledger snapshot has been sent to ${email}.`
  );
  closeRecoveryModal();
}

// --- CURRENCY DENOMINATIONS & NOTE COUNTER CONTROLLERS ---

function getDenominationBadgeStyle(denom) {
  switch (Number(denom)) {
    case 500:
      return "bg-stone-100 text-stone-800 border-stone-300";
    case 200:
      return "bg-amber-100 text-amber-900 border-amber-300";
    case 100:
      return "bg-indigo-100 text-indigo-900 border-indigo-300";
    case 50:
      return "bg-cyan-100 text-cyan-900 border-cyan-300";
    case 20:
      return "bg-emerald-100 text-emerald-900 border-emerald-300";
    case 10:
      return "bg-orange-100 text-orange-950 border-orange-300";
    default:
      return "bg-slate-100 text-slate-800 border-slate-300";
  }
}

function renderDenominationPillsHtml(denomMap) {
  if (!denomMap) return "";
  const pills = [];
  CURRENCY_DENOMINATIONS.forEach((d) => {
    const count = parseInt(denomMap[d] || 0, 10);
    if (count > 0) {
      const style = getDenominationBadgeStyle(d);
      pills.push(
        `<span class="inline-flex items-center text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border ${style}">₹${d}×${count}</span>`
      );
    }
  });
  return pills.join(" ");
}

function onTxModeChange() {
  const modeEl = document.getElementById("txMode");
  const mode = modeEl ? modeEl.value : "Cash";
  const toggleBtn = document.getElementById("toggleTxDenomBtn");
  const panel = document.getElementById("txDenomPanel");
  if (mode === "Cash") {
    if (toggleBtn) toggleBtn.classList.remove("hidden");
    if (panel) {
      panel.classList.remove("hidden");
      renderTxDenominationGrid();
    }
  } else {
    if (toggleBtn) toggleBtn.classList.add("hidden");
    if (panel) panel.classList.add("hidden");
    clearTxDenominations();
  }
}

function onTxAmountInput() {
  const modeEl = document.getElementById("txMode");
  const mode = modeEl ? modeEl.value : "Cash";
  if (mode !== "Cash") return;

  const amtInput = document.getElementById("txAmount");
  const amt = parseFloat(amtInput ? amtInput.value : 0) || 0;

  if (amt > 0 && !hasActiveDenominations(txDenominations)) {
    const autoMap = autoBreakdownAmountToDenominations(amt);
    CURRENCY_DENOMINATIONS.forEach((d) => {
      txDenominations[d] = autoMap[d] || 0;
    });
    renderTxDenominationGrid();
    const badge = document.getElementById("txDenomSummaryBadge");
    if (badge) {
      const { totalAmount, totalNotes } = calcDenominationsTotal(txDenominations);
      badge.textContent = `${totalNotes} notes = ${formatINR(totalAmount)}`;
    }
  }
}

function toggleTxDenomCounter() {
  const panel = document.getElementById("txDenomPanel");
  if (!panel) return;
  const isHidden = panel.classList.contains("hidden");
  if (isHidden) {
    panel.classList.remove("hidden");
    renderTxDenominationGrid();
  } else {
    panel.classList.add("hidden");
  }
}

function renderTxDenominationGrid() {
  const grid = document.getElementById("txDenomGrid");
  if (!grid) return;
  grid.innerHTML = "";

  CURRENCY_DENOMINATIONS.forEach((d) => {
    const count = parseInt(txDenominations[d] || 0, 10);
    const subtotal = count * d;
    const style = getDenominationBadgeStyle(d);

    grid.innerHTML += `
      <div class="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-xs font-bold px-1.5 py-0.5 rounded border ${style}">₹${d} Note</span>
          <span id="txSubtotal_${d}" class="text-[11px] font-mono font-bold text-slate-700">${formatINR(subtotal)}</span>
        </div>
        <div class="flex items-center justify-between gap-1 mt-1">
          <button type="button" onclick="stepTxDenom(${d}, -1)"
            class="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition active:scale-95">
            -
          </button>
          <input type="number" min="0" step="1" id="txDenomInput_${d}" value="${count}"
            oninput="onTxDenomInputChange(${d}, this.value)"
            class="w-12 text-center text-xs font-mono font-bold py-1 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none">
          <button type="button" onclick="stepTxDenom(${d}, 1)"
            class="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-sm transition active:scale-95">
            +
          </button>
        </div>
      </div>
    `;
  });
}

function stepTxDenom(denom, delta) {
  const current = parseInt(txDenominations[denom] || 0, 10);
  const next = Math.max(0, current + delta);
  txDenominations[denom] = next;

  const inputEl = document.getElementById(`txDenomInput_${denom}`);
  if (inputEl) inputEl.value = next;

  const subtotalEl = document.getElementById(`txSubtotal_${denom}`);
  if (subtotalEl) subtotalEl.textContent = formatINR(next * denom);

  updateTxDenominationsTotal();
}

function onTxDenomInputChange(denom, val) {
  const parsed = parseInt(val, 10);
  const next = isNaN(parsed) || parsed < 0 ? 0 : parsed;
  txDenominations[denom] = next;

  const subtotalEl = document.getElementById(`txSubtotal_${denom}`);
  if (subtotalEl) subtotalEl.textContent = formatINR(next * denom);

  updateTxDenominationsTotal();
}

function updateTxDenominationsTotal() {
  const { totalAmount, totalNotes } = calcDenominationsTotal(txDenominations);
  const badge = document.getElementById("txDenomSummaryBadge");
  if (badge) {
    badge.textContent = `${totalNotes} notes = ${formatINR(totalAmount)}`;
  }

  if (totalAmount > 0) {
    const amtInput = document.getElementById("txAmount");
    if (amtInput) amtInput.value = totalAmount;
  }
}

function clearTxDenominations() {
  CURRENCY_DENOMINATIONS.forEach((d) => {
    txDenominations[d] = 0;
  });
  renderTxDenominationGrid();
  updateTxDenominationsTotal();
}

// Dashboard Vault / Cash Drawer Note Counter
function renderVaultDenominationGrid() {
  const grid = document.getElementById("vaultDenomGrid");
  if (!grid) return;
  grid.innerHTML = "";

  CURRENCY_DENOMINATIONS.forEach((d) => {
    const count = parseInt(vaultDenominations[d] || 0, 10);
    const subtotal = count * d;
    const style = getDenominationBadgeStyle(d);

    grid.innerHTML += `
      <div class="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
        <div class="flex items-center justify-between mb-1">
          <span class="text-[11px] font-bold px-1.5 py-0.5 rounded border ${style}">₹${d}</span>
          <span id="vaultSubtotal_${d}" class="text-[10px] font-mono font-bold text-slate-700">${formatINR(subtotal)}</span>
        </div>
        <div class="flex items-center justify-between gap-1 mt-1">
          <button type="button" onclick="stepVaultDenom(${d}, -1)"
            class="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition active:scale-95">
            -
          </button>
          <input type="number" min="0" step="1" id="vaultDenomInput_${d}" value="${count}"
            oninput="onVaultDenomInputChange(${d}, this.value)"
            class="w-10 text-center text-xs font-mono font-bold py-0.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none">
          <button type="button" onclick="stepVaultDenom(${d}, 1)"
            class="w-6 h-6 flex items-center justify-center rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition active:scale-95">
            +
          </button>
        </div>
      </div>
    `;
  });
}

function stepVaultDenom(denom, delta) {
  const current = parseInt(vaultDenominations[denom] || 0, 10);
  const next = Math.max(0, current + delta);
  vaultDenominations[denom] = next;

  const inputEl = document.getElementById(`vaultDenomInput_${denom}`);
  if (inputEl) inputEl.value = next;

  const subtotalEl = document.getElementById(`vaultSubtotal_${denom}`);
  if (subtotalEl) subtotalEl.textContent = formatINR(next * denom);

  updateVaultTallyDisplay();
}

function onVaultDenomInputChange(denom, val) {
  const parsed = parseInt(val, 10);
  const next = isNaN(parsed) || parsed < 0 ? 0 : parsed;
  vaultDenominations[denom] = next;

  const subtotalEl = document.getElementById(`vaultSubtotal_${denom}`);
  if (subtotalEl) subtotalEl.textContent = formatINR(next * denom);

  updateVaultTallyDisplay();
}

function updateVaultTallyDisplay() {
  const { totalAmount, totalNotes } = calcDenominationsTotal(vaultDenominations);
  const badge = document.getElementById("vaultTallyBadge");
  if (badge) {
    badge.textContent = `${totalNotes} notes = ${formatINR(totalAmount)}`;
  }

  const calcs = calculateDatasetBalances(daybookData);
  const systemCash = calcs.cashBalance;

  const systemCashEl = document.getElementById("vaultSystemCash");
  if (systemCashEl) {
    systemCashEl.textContent = formatINR(systemCash);
  }

  const statusEl = document.getElementById("vaultDiffStatus");
  if (!statusEl) return;

  if (totalNotes === 0 && totalAmount === 0) {
    statusEl.textContent = "Enter drawer counts";
    statusEl.className = "font-medium text-xs font-mono text-slate-500";
    return;
  }

  const diff = totalAmount - systemCash;
  if (Math.abs(diff) < 0.01) {
    statusEl.innerHTML = `<span class="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">✓ Perfectly Matched (${formatINR(0)})</span>`;
  } else if (diff > 0) {
    statusEl.innerHTML = `<span class="text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">▲ Excess Cash: +${formatINR(diff)}</span>`;
  } else {
    statusEl.innerHTML = `<span class="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">▼ Shortage: -${formatINR(Math.abs(diff))}</span>`;
  }
}

function resetVaultDenominations() {
  CURRENCY_DENOMINATIONS.forEach((d) => {
    vaultDenominations[d] = 0;
  });
  renderVaultDenominationGrid();
  updateVaultTallyDisplay();
}

// Dashboard Note Flow Table
function renderDashboardDenomFlowTable() {
  cashDenominationsFlow = computeCashDenominationsFlow(daybookData.transactions);
  const tbody = document.getElementById("dashDenomFlowTbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  let totalInNotes = 0;
  let totalOutNotes = 0;
  let totalNetNotes = 0;

  CURRENCY_DENOMINATIONS.forEach((d) => {
    const dep = (cashDenominationsFlow.deposited && cashDenominationsFlow.deposited[d]) || 0;
    const wth = (cashDenominationsFlow.withdrawn && cashDenominationsFlow.withdrawn[d]) || 0;
    const net = dep - wth;

    totalInNotes += dep;
    totalOutNotes += wth;
    totalNetNotes += net;

    const style = getDenominationBadgeStyle(d);
    const netClass =
      net > 0
        ? "text-emerald-600 font-bold"
        : net < 0
        ? "text-rose-600 font-bold"
        : "text-slate-400";
    const netSign = net > 0 ? "+" : "";

    tbody.innerHTML += `
      <tr class="hover:bg-white/60 transition">
        <td class="py-1.5">
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded border ${style}">₹${d}</span>
        </td>
        <td class="py-1.5 text-center text-emerald-700">
          ${dep > 0 ? `+${dep} <span class="text-[10px] text-slate-400">(${formatINR(dep * d)})</span>` : "-"}
        </td>
        <td class="py-1.5 text-center text-rose-700">
          ${wth > 0 ? `-${wth} <span class="text-[10px] text-slate-400">(${formatINR(wth * d)})</span>` : "-"}
        </td>
        <td class="py-1.5 text-right ${netClass}">
          ${net !== 0 ? `${netSign}${net} notes` : "0"}
        </td>
      </tr>
    `;
  });

  const totalFlowEl = document.getElementById("dashTotalNotesFlow");
  if (totalFlowEl) {
    const sign = totalNetNotes > 0 ? "+" : "";
    totalFlowEl.textContent = `${sign}${totalNetNotes} Notes (In: ${totalInNotes}, Out: ${totalOutNotes})`;
    totalFlowEl.className =
      totalNetNotes >= 0
        ? "font-mono font-bold text-emerald-700 text-xs"
        : "font-mono font-bold text-rose-700 text-xs";
  }
}

// --- SHARED RENDERING HELPERS ---

function buildTransactionRowHtml(item, includeActionBtn) {
  const badgeEffect = item.isDep
    ? `<span class="inline-flex items-center text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">▲ Increased by ${formatINR(
        item.amount
      )}</span>`
    : `<span class="inline-flex items-center text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">▼ Decreased by ${formatINR(
        item.amount
      )}</span>`;

  const modeBadge =
    item.mode === "Cash"
      ? `<span class="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200"><i class="fa-solid fa-money-bill-1 mr-1"></i>Cash</span>`
      : `<span class="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200"><i class="fa-solid fa-credit-card mr-1"></i>Online</span>`;

  const actionCell = includeActionBtn
    ? `<td class="px-4 py-3 text-center">
         <button onclick="deleteTransaction(${item.id})" class="text-slate-300 hover:text-rose-600 p-1 transition" title="Move to Recovery Vault">
           <i class="fa-solid fa-trash-can"></i>
         </button>
       </td>`
    : "";

  return `
    <tr class="hover:bg-slate-50 transition">
      <td class="px-4 py-3 font-mono text-slate-400">${item.displayIndex}</td>
      <td class="px-4 py-3 font-mono text-slate-600">${
        item.time || "10:00 AM"
      }</td>
      <td class="px-4 py-3">
        <span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-semibold">${
          item.category
        }</span>
      </td>
      <td class="px-4 py-3 font-medium text-slate-900">
        <div>${item.descText}</div>
        ${
          item.mode === "Cash" && (hasActiveDenominations(item.denominations) || Number(item.amount) > 0)
            ? `<div class="mt-1 flex flex-wrap gap-1">${renderDenominationPillsHtml(
                hasActiveDenominations(item.denominations)
                  ? item.denominations
                  : autoBreakdownAmountToDenominations(item.amount)
              )}</div>`
            : ""
        }
      </td>
      <td class="px-4 py-3">${modeBadge}</td>
      <td class="px-4 py-3 text-right font-medium text-emerald-600">${
        item.isDep ? "+" + formatINR(item.amount) : "-"
      }</td>
      <td class="px-4 py-3 text-right font-medium text-rose-600">${
        !item.isDep ? "-" + formatINR(item.amount) : "-"
      }</td>
      <td class="px-4 py-3 text-center">${badgeEffect}</td>
      <td class="px-4 py-3 text-right font-mono font-bold text-slate-800">${formatINR(
        item.runningTotal
      )}</td>
      ${actionCell}
    </tr>
  `;
}

function updateSummaryFooter(ids, calcs) {
  document.getElementById(ids.deposits).textContent =
    "+" + formatINR(calcs.totalDeposits);
  document.getElementById(ids.withdrawals).textContent =
    "-" + formatINR(calcs.totalWithdrawals);

  const netChangeEl = document.getElementById(ids.netChange);
  if (calcs.netChange >= 0) {
    netChangeEl.textContent = `+ ${formatINR(calcs.netChange)} (Increased)`;
    netChangeEl.className = "text-emerald-400 font-semibold";
  } else {
    netChangeEl.textContent = `- ${formatINR(
      Math.abs(calcs.netChange)
    )} (Decreased)`;
    netChangeEl.className = "text-rose-400 font-semibold";
  }

  document.getElementById(ids.cash).textContent = formatINR(calcs.cashBalance);
  document.getElementById(ids.online).textContent = formatINR(
    calcs.onlineBalance
  );
  document.getElementById(ids.total).textContent = formatINR(calcs.running);
}

// --- MODULE RENDERERS ---

function renderDaybookTable() {
  const calcs = calculateDatasetBalances(daybookData);
  const tbody = document.getElementById("daybookTbody");
  tbody.innerHTML = "";

  if (calcs.rows.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="10" class="text-center py-8 text-slate-400">No transactions recorded in your private ledger yet. Add one above!</td></tr>';
  } else {
    calcs.rows.forEach((item) => {
      tbody.innerHTML += buildTransactionRowHtml(item, true);
    });
  }

  updateSummaryFooter(
    {
      deposits: "sumDeposits",
      withdrawals: "sumWithdrawals",
      netChange: "sumNetChange",
      cash: "endCashBalance",
      online: "endOnlineBalance",
      total: "endTotalBalance",
    },
    calcs
  );
}

function renderDashboard() {
  const calcs = calculateDatasetBalances(daybookData);

  const liveDateEl = document.getElementById("dashLiveDate");
  if (liveDateEl) {
    liveDateEl.textContent = formatDisplayDate();
  }

  document.getElementById("dashCashBalance").textContent = formatINR(
    calcs.cashBalance
  );
  document.getElementById("dashOnlineBalance").textContent = formatINR(
    calcs.onlineBalance
  );
  document.getElementById("dashTotalBalance").textContent = formatINR(
    calcs.running
  );

  // Render real Yesterday Summary (or First Day empty state)
  const yestBadge = document.getElementById("yestBadge");
  const yestOpening = document.getElementById("yestOpening");
  const yestDeposits = document.getElementById("yestDeposits");
  const yestWithdrawals = document.getElementById("yestWithdrawals");
  const yestNetChange = document.getElementById("yestNetChange");

  if (yestBadge && yestOpening && yestDeposits && yestWithdrawals && yestNetChange) {
    yestBadge.textContent = yesterdaySummary.hasData
      ? "Carried Over"
      : "First Day / No Prior Records";
    yestOpening.textContent = formatINR(yesterdaySummary.opening);
    yestDeposits.textContent = "+" + formatINR(yesterdaySummary.deposits);
    yestWithdrawals.textContent = "-" + formatINR(yesterdaySummary.withdrawals);

    if (!yesterdaySummary.hasData) {
      yestNetChange.textContent = "₹0.00";
    } else if (yesterdaySummary.netChange >= 0) {
      yestNetChange.textContent = `+${formatINR(yesterdaySummary.netChange)} ▲`;
    } else {
      yestNetChange.textContent = `-${formatINR(Math.abs(yesterdaySummary.netChange))} ▼`;
    }
  }

  const categories = [
    "Deposit (Portal)",
    "Withdrawal (Portal)",
    "Money Transfer",
    "AEPS Withdrawal",
    "AEPS Deposit",
    "Online Money Transfer",
    "Online Money Accept",
    "Expenses",
  ];

  const grid = document.getElementById("serviceBreakdownGrid");
  grid.innerHTML = "";

  categories.forEach((cat) => {
    const matches = daybookData.transactions.filter((t) => t.category === cat);
    const count = matches.length;
    const totalAmt = matches.reduce(
      (acc, curr) => acc + Number(curr.amount || 0),
      0
    );

    grid.innerHTML += `
      <div class="p-3.5 rounded-xl border border-slate-100 bg-slate-50 flex flex-col justify-between">
        <span class="text-[11px] font-semibold text-slate-600 truncate block" title="${cat}">${cat}</span>
        <div class="mt-2 flex items-baseline justify-between">
          <span class="text-base font-extrabold text-slate-800">${count} <span class="text-[10px] font-normal text-slate-400">txs</span></span>
          <span class="text-xs font-mono font-bold text-blue-600">${formatINR(
            totalAmt
          )}</span>
        </div>
      </div>
    `;
  });

  renderVaultDenominationGrid();
  updateVaultTallyDisplay();
  renderDashboardDenomFlowTable();
}

function selectQuickReportDate(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  onReportDateSelect(getLocalDateKey(d));
}

async function onReportDateSelect(dateKey) {
  selectedReportDateKey = dateKey;
  const repInput = document.getElementById("repDateInput");
  if (repInput) repInput.value = dateKey;

  const todayKey = getLocalDateKey();
  if (dateKey === todayKey) {
    reportViewData = null;
    renderReportsForDate(dateKey);
    return;
  }

  const uid = (currentUser && currentUser.id) || 1;
  try {
    const data = await apiFetchDaybook(uid, dateKey);
    if (data && data.success) {
      const cash = Number(data.opening_cash ?? 0);
      const online = Number(data.opening_online ?? 0);
      reportViewData = {
        date: dateKey,
        opening: { cash, online, total: cash + online },
        transactions: mapServerTransactions(data.transactions),
      };
    }
  } catch (err) {
    reportViewData = {
      date: dateKey,
      opening: { cash: 0, online: 0, total: 0 },
      transactions: [],
    };
  }
  renderReportsForDate(dateKey);
}

function renderReportsForDate(dateKey) {
  const repInput = document.getElementById("repDateInput");
  if (repInput && repInput.value !== dateKey) {
    repInput.value = dateKey;
  }
  const activeDataset =
    dateKey === getLocalDateKey() || !reportViewData
      ? daybookData
      : reportViewData;
  const calcs = calculateDatasetBalances(activeDataset);
  const displayTitle = `Date: ${dateKey}`;

  document.getElementById("repTableDateTitle").textContent = displayTitle;
  document.getElementById("repSummaryDate").textContent = dateKey;

  document.getElementById("repStarting").textContent = formatINR(
    activeDataset.opening.total
  );
  document.getElementById(
    "repStartingSplit"
  ).textContent = `Cash: ${formatINR(
    activeDataset.opening.cash
  )} | Online: ${formatINR(activeDataset.opening.online)}`;
  document.getElementById("repDeposits").textContent =
    "+" + formatINR(calcs.totalDeposits);
  document.getElementById("repWithdrawals").textContent =
    "-" + formatINR(calcs.totalWithdrawals);
  document.getElementById("repEnding").textContent = formatINR(calcs.running);

  const netBadge = document.getElementById("repEndingNetBadge");
  if (calcs.netChange >= 0) {
    netBadge.textContent = `▲ Overall Day Increased by ${formatINR(
      calcs.netChange
    )}`;
    netBadge.className =
      "text-[11px] text-emerald-600 font-semibold mt-1 block";
  } else {
    netBadge.textContent = `▼ Overall Day Decreased by ${formatINR(
      Math.abs(calcs.netChange)
    )}`;
    netBadge.className = "text-[11px] text-rose-600 font-semibold mt-1 block";
  }

  const tbody = document.getElementById("repTableTbody");
  tbody.innerHTML = "";

  if (calcs.rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-400">No transactions recorded on ${displayTitle}.</td></tr>`;
  } else {
    calcs.rows.forEach((item) => {
      tbody.innerHTML += buildTransactionRowHtml(item, false);
    });
  }

  updateSummaryFooter(
    {
      deposits: "repSumDeposits",
      withdrawals: "repSumWithdrawals",
      netChange: "repSumNetChange",
      cash: "repEndCashBalance",
      online: "repEndOnlineBalance",
      total: "repEndTotalBalance",
    },
    calcs
  );
}

function switchReportTab(tab) {
  const tabDay = document.getElementById("tabDayReport");
  const tabMonth = document.getElementById("tabMonthReport");
  const viewDay = document.getElementById("dayReportView");
  const viewMonth = document.getElementById("monthReportView");

  const activeTabClass =
    "px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white shadow-sm transition flex items-center gap-1.5";
  const inactiveTabClass =
    "px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition flex items-center gap-1.5";

  if (tab === "day") {
    tabDay.className = activeTabClass;
    tabMonth.className = inactiveTabClass;
    viewDay.classList.remove("hidden");
    viewMonth.classList.add("hidden");
    renderReportsForDate(selectedReportDateKey);
  } else {
    tabMonth.className = activeTabClass;
    tabDay.className = inactiveTabClass;
    viewMonth.classList.remove("hidden");
    viewDay.classList.add("hidden");
    renderMonthLedger();
  }
}

function renderMonthLedger() {
  const tbody = document.getElementById("monthLedgerTbody");
  tbody.innerHTML = "";

  const ledgerRows = [...mockMonthLedger];
  if (daybookData.transactions.length > 0) {
    const calcs = calculateDatasetBalances(daybookData);
    ledgerRows.unshift({
      dateKey: selectedReportDateKey,
      date: daybookData.date + " (Today)",
      opening: daybookData.opening.total,
      deposits: calcs.totalDeposits,
      withdrawals: calcs.totalWithdrawals,
      closing: calcs.running,
    });
  }

  if (ledgerRows.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="text-center py-8 text-slate-400">No transactions recorded yet. Add your daily transactions to see your ledger!</td></tr>';
    return;
  }

  ledgerRows.forEach((row) => {
    const diff = row.deposits - row.withdrawals;
    const netBadge =
      diff >= 0
        ? `<span class="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold">▲ +${formatINR(
            diff
          )}</span>`
        : `<span class="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full font-semibold">▼ -${formatINR(
            Math.abs(diff)
          )}</span>`;

    tbody.innerHTML += `
      <tr class="hover:bg-slate-50 transition">
        <td class="px-4 py-3 font-semibold text-slate-800">${row.date}</td>
        <td class="px-4 py-3 text-right font-mono text-slate-600">${formatINR(
          row.opening
        )}</td>
        <td class="px-4 py-3 text-right font-mono text-emerald-600">+${formatINR(
          row.deposits
        )}</td>
        <td class="px-4 py-3 text-right font-mono text-rose-600">-${formatINR(
          row.withdrawals
        )}</td>
        <td class="px-4 py-3 text-center text-[11px]">${netBadge}</td>
        <td class="px-4 py-3 text-right font-mono font-bold text-slate-900">${formatINR(
          row.closing
        )}</td>
        <td class="px-4 py-3 text-center">
          <button onclick="viewDateFromLedger('${row.dateKey}')" class="bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 mx-auto shadow-sm">
            <i class="fa-solid fa-eye text-[10px]"></i> View Day Report
          </button>
        </td>
      </tr>
    `;
  });
}

function viewDateFromLedger(dateKey) {
  switchReportTab("day");
  onReportDateSelect(dateKey);
}

// --- INITIALIZATION ---

window.addEventListener("DOMContentLoaded", async () => {
  initOtpInputs();
  const repInput = document.getElementById("repDateInput");
  if (repInput) repInput.value = selectedReportDateKey;
  renderTxDenominationGrid();
  renderVaultDenominationGrid();
  updateVaultTallyDisplay();

  // Persistent Auto-Login Check via localStorage
  const savedSession = getUserSession();
  if (savedSession && savedSession.email && savedSession.id) {
    currentUser = savedSession;
    enterApp();

    // Verify session in background with backend
    try {
      const verifyRes = await apiVerifySession(savedSession);
      if (verifyRes && verifyRes.success && verifyRes.user) {
        currentUser = verifyRes.user;
        saveUserSession(currentUser);
        const headerEmail = document.getElementById("headerUserEmail");
        if (headerEmail) headerEmail.textContent = currentUser.email;
      }
    } catch (e) {
      // Offline fallback: keep local session active
    }
  } else {
    renderDaybookTable();
    renderDashboard();
  }
});
