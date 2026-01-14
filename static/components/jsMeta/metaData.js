// ================= EXPORT BUTTON LOGIC =================
const exportBtn = document.getElementById("exportBtn");
const checkboxes = document.querySelectorAll(".row-selector");
 
checkboxes.forEach(box => {
  box.addEventListener("change", () => {
    const selected = [...checkboxes].some(cb => cb.checked);
    exportBtn.dataset.hasSelection = selected ? "true" : "false";
  });
});
 
exportBtn.addEventListener("click", () => {
  const selectedRows = document.querySelectorAll(".row-selector:checked");
 
  if (selectedRows.length === 0) {
    alert("At least select one row to proceed.");
    exportBtn.dataset.hasSelection = "false";
    return;
  }
 
  let csv = "Platform,Status,ID,Environment,Cost Center,IT Owner\n";
 
  selectedRows.forEach(row => {
    const tr = row.closest("tr");
    const cells = tr.querySelectorAll("td");
    csv += [
      cells[1].innerText,
      cells[2].innerText,
      cells[3].innerText,
      cells[4].innerText,
      cells[5].innerText,
      cells[6].innerText
    ].join(",") + "\n";
  });
 
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "selected_assets.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});
 
 
// ================= URL PLATFORM FILTER =================
window.onload = function () {
  const params = new URLSearchParams(window.location.search);
  const selectedPlatform = params.get("platform");
 
  document.querySelectorAll(".data-row").forEach(row => {
    const platformCell = row.querySelector(".platform");
    row.style.display =
      selectedPlatform &&
      platformCell.textContent.trim().toLowerCase() !== selectedPlatform.toLowerCase()
        ? "none"
        : "";
  });
};
 
 
// ================= FILTER SYSTEM =================
function initializeFilters() {
  const rows = document.querySelectorAll("#assetBody .data-row");
 
  document.querySelectorAll(".filter-dropdown").forEach(dropdown => {
    const filterIcon = dropdown.parentElement.querySelector(".filter-icon");
    const input = dropdown.querySelector(".filter-input");
    const clearBtn = dropdown.querySelector(".clear-filter");
 
    const newIcon = filterIcon.cloneNode(true);
    const newInput = input.cloneNode(true);
    filterIcon.replaceWith(newIcon);
    input.replaceWith(newInput);
    if (clearBtn) clearBtn.replaceWith(clearBtn.cloneNode(true));
 
    const columnKey = dropdown.closest("th")
      .querySelector(".header-title")
      .textContent.trim().toLowerCase().replace(/\s+/g, '');
 
    newIcon.addEventListener("click", e => {
      e.stopPropagation();
      document.querySelectorAll(".filter-dropdown").forEach(d => d.style.display = "none");
      dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
    });
 
    dropdown.addEventListener("change", () => {
      const checked = [...dropdown.querySelectorAll(".filter-check:checked")]
        .map(cb => cb.value.toLowerCase());
 
      rows.forEach(row => {
        const cell = row.querySelector(`td.${columnKey}`);
        row.style.display = checked.length === 0 || checked.includes(cell.textContent.trim().toLowerCase())
          ? ""
          : "none";
      });
    });
 
    dropdown.querySelector(".clear-filter")?.addEventListener("click", () => {
      dropdown.querySelectorAll(".filter-check").forEach(cb => cb.checked = false);
      rows.forEach(row => row.style.display = "");
      dropdown.style.display = "none";
    });
  });
}
 
function updateFilterOptions() {
  const rows = document.querySelectorAll(".data-row");
 
  document.querySelectorAll(".filter-dropdown").forEach(dropdown => {
    const columnClass = dropdown.closest("th")
      .querySelector(".header-title")
      .textContent.trim().toLowerCase().replace(/\s+/g, '');
 
    const values = new Set();
    rows.forEach(row => {
      const cell = row.querySelector(`td.${columnClass}`);
      if (cell) values.add(cell.textContent.trim());
    });
 
    const ul = dropdown.querySelector(".filter-options");
    ul.innerHTML = "";
 
    [...values].sort().forEach(v => {
      ul.innerHTML += `<li><label><input type="checkbox" class="filter-check" value="${v}"/> ${v}</label></li>`;
    });
  });
 
  initializeFilters();
}
 
 
// ================= SELECT ALL / UNSELECT ALL (FIXED) =================
document.addEventListener("DOMContentLoaded", function () {
  updateFilterOptions();
 
  const selectAllBar = document.getElementById("selectAllBar");
  const selectAllBtn = document.getElementById("selectAllBtn");
  const rowSelectors = document.querySelectorAll(".row-selector");
 
  function updateSelectAllUI() {
    const checkedCount = [...rowSelectors].filter(cb => cb.checked).length;
 
    selectAllBar.style.display = checkedCount > 0 ? "flex" : "none";
    selectAllBtn.textContent =
      checkedCount === rowSelectors.length ? "Unselect All" : "Select All";
  }
 
  rowSelectors.forEach(cb => {
    cb.addEventListener("change", updateSelectAllUI);
  });
 
  selectAllBtn.addEventListener("click", () => {
    const allChecked = [...rowSelectors].every(cb => cb.checked);
    rowSelectors.forEach(cb => cb.checked = !allChecked);
    updateSelectAllUI();
  });
 
  document.addEventListener("click", e => {
    if (!e.target.closest(".filter-wrapper")) {
      document.querySelectorAll(".filter-dropdown").forEach(d => d.style.display = "none");
    }
  });
});
 
 
// ================= SEARCH =================
document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.querySelector('.table-action-bar input');
  const rows = document.querySelectorAll('tbody tr.data-row');
 
  searchInput.addEventListener('keyup', e => {
    if (e.key === 'Enter') filter();
  });
 
  searchInput.addEventListener('input', () => {
    if (!searchInput.value.trim()) rows.forEach(r => r.style.display = "");
  });
 
  function filter() {
    const term = searchInput.value.toLowerCase();
    rows.forEach(row => {
      row.style.display = [...row.children]
        .slice(1, -1)
        .some(td => td.textContent.toLowerCase().includes(term))
        ? ""
        : "none";
    });
  }
});
 
 
// ================= STATUS COLORS =================
function applyStatusColor(cell) {
  const t = cell.textContent.trim().toLowerCase();
  cell.className = "status";
 
  if (t === "check") cell.classList.add("check");
  else if (t === "overdue") cell.classList.add("overdue");
  else if (t === "in-progress") cell.classList.add("inprogress");
  else if (t.includes("up")) cell.classList.add("upToDate");
}
 
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".status").forEach(cell => {
    applyStatusColor(cell);
    new MutationObserver(() => applyStatusColor(cell))
      .observe(cell, { childList: true, subtree: true });
  });
});
 
 