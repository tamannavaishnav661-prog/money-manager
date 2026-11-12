// ============================================================================
// MoneyManager Pro - Excel & PDF Import / Export Utilities
// ============================================================================

/**
 * Exports current daybook transactions to an Excel (.xlsx) file.
 */
function exportExcel(type) {
  const calcs = calculateDatasetBalances(daybookData);
  const fileName =
    type === "daybook"
      ? "Daybook_Daily_Records.xlsx"
      : `Report_${selectedReportDateKey}.xlsx`;

  const data = calcs.rows.map((r) => ({
    Index: r.displayIndex,
    Time: r.time,
    Category: r.category,
    Description: r.descText,
    Mode: r.mode,
    "Deposit (INR)": r.isDep ? r.amount : 0,
    "Withdrawal (INR)": !r.isDep ? r.amount : 0,
    "Running Total (INR)": r.runningTotal,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Statement");
  XLSX.writeFile(wb, fileName);
}

/**
 * Exports current daybook transactions to a formatted PDF file.
 */
function exportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const calcs = calculateDatasetBalances(daybookData);

  doc.setFontSize(16);
  doc.text("MoneyManager Pro - Private Daybook Register", 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    `User: ${currentUser ? currentUser.email : "Personal"} | Starting: ${formatINR(
      daybookData.opening.total
    )}`,
    14,
    25
  );

  const tableData = calcs.rows.map((r) => [
    r.displayIndex,
    r.time,
    r.category,
    r.descText,
    r.mode,
    r.isDep ? "+" + formatINR(r.amount) : "-",
    !r.isDep ? "-" + formatINR(r.amount) : "-",
    formatINR(r.runningTotal),
  ]);

  doc.autoTable({
    startY: 30,
    head: [
      [
        "#",
        "Time",
        "Category",
        "Description",
        "Mode",
        "Deposit",
        "Withdrawal",
        "Running Total",
      ],
    ],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [37, 99, 235] },
  });

  doc.save("Private_Daybook_Report.pdf");
}

/**
 * Imports transactions from an uploaded Excel (.xlsx / .xls) file.
 */
function handleExcelUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet);

      if (jsonData && jsonData.length > 0) {
        jsonData.forEach((row, idx) => {
          const newTx = {
            id: Date.now() + idx,
            user_id: (currentUser && currentUser.id) || 1,
            time: row["Time"] || "11:00 AM",
            category: row["Category"] || "Deposit (Portal)",
            description: row["Description"] || "Excel Bulk Entry",
            mode: row["Mode"] || "Cash",
            effect:
              row["Deposit"] && Number(row["Deposit"]) > 0
                ? "Deposit"
                : "Withdrawal",
            amount: Number(
              row["Deposit"] || row["Withdrawal"] || row["Amount"] || 0
            ),
          };
          if (newTx.amount > 0) {
            daybookData.transactions.push(newTx);
          }
        });
        alert(
          `Successfully imported ${jsonData.length} transactions into your private ledger!`
        );
        renderDaybookTable();
        renderDashboard();
      }
    } catch (err) {
      alert("Error parsing Excel file.");
    }
  };
  reader.readAsArrayBuffer(file);
}

/**
 * Downloads a sample Excel import template.
 */
function downloadExcelTemplate() {
  const template = [
    {
      Time: "09:30 AM",
      Category: "Deposit (Portal)",
      Description: "Client Collection",
      Mode: "Cash",
      Deposit: 5000,
      Withdrawal: 0,
    },
  ];
  const ws = XLSX.utils.json_to_sheet(template);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  XLSX.writeFile(wb, "MoneyManager_Template.xlsx");
}
