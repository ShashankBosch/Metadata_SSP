// Enable export only if at least one row is selected
const exportBtn = document.getElementById("exportBtn");
const checkboxes = document.querySelectorAll(".row-selector");

checkboxes.forEach(box => {
  box.addEventListener("change", () => {
    const selected = [...checkboxes].some(cb => cb.checked);
    exportBtn.disabled = !selected;
  });
});

// Export selected rows to CSV
exportBtn.addEventListener("click", () => {
  const selectedRows = document.querySelectorAll(".row-selector:checked");
  if (selectedRows.length === 0){
    alert("At least select one row to proceed.");
    return;
  }

  let csv = "Platform,Status,ID,Environment,Cost Center,IT Owner\n";

  selectedRows.forEach(row => {
    const tr = row.closest("tr");
    const cells = tr.querySelectorAll("td");
    const rowData = [
      cells[1].innerText,
      cells[2].innerText,
      cells[3].innerText,
      cells[4].innerText,
      cells[5].innerText,
      cells[6].innerText
    ].join(",");
    csv += rowData + "\n";
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

window.onload = function () {
  const params = new URLSearchParams(window.location.search);
  const selectedPlatform = params.get("platform");

  const rows = document.querySelectorAll(".data-row");
  rows.forEach(row => {
    const platformCell = row.querySelector(".platform");
    if (
      selectedPlatform &&
      platformCell.textContent.trim().toLowerCase() !== selectedPlatform.trim().toLowerCase()
    ) {
      row.style.display = "none";
    } else {
      row.style.display = "";
    }
  });
};

// Function to initialize filters with proper event delegation
function initializeFilters() {
  const rows = document.querySelectorAll("#assetBody .data-row");
 
  document.querySelectorAll(".filter-dropdown").forEach(dropdown => {
    // Remove existing event listeners to prevent duplicates
    const filterIcon = dropdown.parentElement.querySelector(".filter-icon");
    const input = dropdown.querySelector(".filter-input");
    const clearBtn = dropdown.querySelector(".clear-filter");
   
    // Clone the elements to remove old event listeners
    const newFilterIcon = filterIcon.cloneNode(true);
    const newInput = input.cloneNode(true);
    let newClearBtn = null;
    if (clearBtn) {
      newClearBtn = clearBtn.cloneNode(true);
    }
   
    // Replace elements
    filterIcon.parentNode.replaceChild(newFilterIcon, filterIcon);
    input.parentNode.replaceChild(newInput, input);
    if (clearBtn && newClearBtn) {
      clearBtn.parentNode.replaceChild(newClearBtn, clearBtn);
    }
 
    // Get fresh references
    const currentDropdown = dropdown;
    const currentOptions = currentDropdown.querySelectorAll("li");
    const currentInput = currentDropdown.querySelector(".filter-input");
    const currentClearBtn = currentDropdown.querySelector(".clear-filter");
    const columnKey = currentDropdown.closest("th").querySelector(".header-title").textContent.trim().toLowerCase().replace(/\s+/g, '');
 
    // Turn list items into checkboxes if not already done
    currentOptions.forEach(option => {
      if (!option.querySelector('input.filter-check')) {
        const value = option.textContent.trim();
        option.innerHTML = `<label><input type="checkbox" value="${value}" class="filter-check"/> ${value}</label>`;
      }
    });
 
    // Show/hide dropdown on click
    newFilterIcon.addEventListener("click", (e) => {
      e.stopPropagation();
      document.querySelectorAll(".filter-dropdown").forEach(d => {
        if (d !== currentDropdown) d.style.display = "none";
      });
      currentDropdown.style.display = currentDropdown.style.display === "block" ? "none" : "block";
    });
 
    // Search filter list
    currentInput.addEventListener("input", () => {
      const searchVal = currentInput.value.toLowerCase();
      currentOptions.forEach(item => {
        const labelText = item.textContent.toLowerCase();
        item.style.display = labelText.includes(searchVal) ? "block" : "none";
      });
    });
 
    // Apply filters when checkboxes change
    currentDropdown.addEventListener("change", () => {
      const checkedValues = Array.from(currentDropdown.querySelectorAll(".filter-check:checked")).map(cb => cb.value.toLowerCase());
      rows.forEach(row => {
        const cell = row.querySelector(`td.${columnKey}`);
        const value = cell?.textContent.trim().toLowerCase();
        row.style.display = checkedValues.length === 0 || checkedValues.includes(value) ? "" : "none";
      });
    });
 
    // Clear filters
    if (currentClearBtn) {
      currentClearBtn.addEventListener("click", () => {
        currentDropdown.querySelectorAll(".filter-check").forEach(cb => (cb.checked = false));
        rows.forEach(row => row.style.display = "");
        currentInput.value = "";
        currentOptions.forEach(opt => opt.style.display = "block");
        currentDropdown.style.display = "none";
      });
    }
  });
}
 
// Function to dynamically update filter options based on table data
function updateFilterOptions() {
  const table = document.querySelector('.asset-table');
  const rows = table.querySelectorAll('.data-row');
 
  // Get all filter dropdowns
  const filterDropdowns = document.querySelectorAll('.filter-dropdown');
 
  filterDropdowns.forEach(dropdown => {
    // Get the column this filter belongs to
    const columnHeader = dropdown.closest('th').querySelector('.header-title').textContent.trim();
    const columnClass = columnHeader.toLowerCase().replace(/\s+/g, '');
   
    // Collect all unique values from this column
    const values = new Set();
   
    rows.forEach(row => {
      const cell = row.querySelector(`td.${columnClass}`);
      if (cell) {
        values.add(cell.textContent.trim());
      }
    });
   
    // Get the options list
    const optionsList = dropdown.querySelector('.filter-options');
   
    // Clear existing options
    optionsList.innerHTML = '';
   
    // Add new options based on actual data
    Array.from(values).sort().forEach(value => {
      const li = document.createElement('li');
      li.innerHTML = `<label><input type="checkbox" value="${value}" class="filter-check"/> ${value}</label>`;
      optionsList.appendChild(li);
    });
   
    // Add clear filter button if not already present
    if (!dropdown.querySelector('.clear-filter')) {
      const clearBtn = document.createElement('button');
      clearBtn.className = 'clear-filter';
      clearBtn.textContent = 'Clear Filter';
      dropdown.appendChild(clearBtn);
    }
  });
 
  // Reinitialize filters with the new options
  initializeFilters();
}
 
document.addEventListener("DOMContentLoaded", function () {
  // Initialize with current data
  updateFilterOptions();
 
  const rows = document.querySelectorAll("#assetBody .data-row");
 
  // Close filter dropdown if clicked outside
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".filter-wrapper")) {
      document.querySelectorAll(".filter-dropdown").forEach(drop => drop.style.display = "none");
    }
  });
 
   const selectAllBar = document.getElementById('selectAllBar');
  const selectAllBtn = document.getElementById('selectAllBtn');
  const rowSelectors = document.querySelectorAll('.row-selector');
 
  function checkToggleSelectAll() {
    const anyChecked = Array.from(rowSelectors).some(cb => cb.checked);
    selectAllBar.style.display = anyChecked ? 'flex' : 'none';
  }
 
  rowSelectors.forEach(cb => {
    cb.addEventListener('change', checkToggleSelectAll);
  });
 
  selectAllBtn.addEventListener('click', () => {
    rowSelectors.forEach(cb => cb.checked = true);
    selectAllBar.style.display = 'none';
  });
});
function applyStatusColor(statusCell) {
  // normalize text
  const statusText = statusCell.textContent.trim().toLowerCase();
 
  // remove old status classes
  statusCell.classList.remove("check", "overdue", "checked", "inprogress", "upToDate");
 
  // map text to class
 if (statusText === "check") {
    statusCell.classList.add("check");
    statusCell.setAttribute("data-tooltip", "Review due within 30 days.");
  } else if (statusText === "overdue") {
    statusCell.classList.add("overdue");
    statusCell.setAttribute("data-tooltip", "Review Overdue - no update in 30+ days.");
  }  else if (statusText === "in-progress") {
    statusCell.classList.add("inprogress");
    statusCell.setAttribute("data-tooltip", "Review in progress. (Saved status)");
  } else if (statusText === "up to date" || statusText === "uptodate") {
    statusCell.classList.add("upToDate");
    statusCell.setAttribute("data-tooltip", "Reviewed and up to date.");
  }
}

function observeStatusCells() {
  const statuses = document.querySelectorAll("#assetBody .status");
 
  statuses.forEach(statusCell => {
    // apply once initially
    applyStatusColor(statusCell);
 
    // observe changes
    const observer = new MutationObserver(() => applyStatusColor(statusCell));
    observer.observe(statusCell, { childList: true, characterData: true, subtree: true });
  });
}
 
// run after table loads
document.addEventListener("DOMContentLoaded", observeStatusCells);
 
 