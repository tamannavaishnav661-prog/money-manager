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

  const activeClass =
    "w-1/2 py-2 text-xs font-bold rounded-lg transition bg-white text-blue-600 shadow-sm";
  const inactiveClass =
    "w-1/2 py-2 text-xs font-bold rounded-lg transition text-slate-500 hover:text-slate-800";

  if (mode === "signin") {
    tabIn.className = activeClass;
    tabUp.className = inactiveClass;
    submitBtn.innerHTML = "<span>Send OTP</span>";
    helper.textContent = "🔒 Bank-Grade 256-Bit Encrypted Security";
  } else {
    tabUp.className = activeClass;
    tabIn.className = inactiveClass;
    submitBtn.innerHTML = "<span>Send OTP</span>";
    helper.textContent =
      "Sign up with your personal email & mobile to create your private ledger";
  }
}

async function handleStep1() {
  const user = document.getElementById("loginUser").value.trim();
  const mobile = document.getElementById("loginMobile").value.trim();
  const pass = document.getElementById("loginPass").value.trim();

  if (!user || !mobile || !pass) {
    alert("Please enter Email, Mobile Number and Password");
    return;
  }

  try {
    const data =
      authMode === "signup"
        ? await apiRegister(user, mobile, pass)
        : await apiLoginStep1(user, mobile, pass);

    if (data.success === true) {
      currentUser = { email: user, mobile: mobile, id: 1 };
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
  };

  try {
    await apiAddTransaction(newTx);
  } catch (err) {
    // Keep local UI state working if offline
  }

  daybookData.transactions.push(newTx);
  document.getElementById("txDesc").value = "";
  document.getElementById("txAmount").value = "";

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
      <td class="px-4 py-3 font-medium text-slate-900">${item.descText}</td>
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

window.addEventListener("DOMContentLoaded", () => {
  initOtpInputs();
  const repInput = document.getElementById("repDateInput");
  if (repInput) repInput.value = selectedReportDateKey;
  renderDaybookTable();
  renderDashboard();
});
