// ==================== SAVE & SUBMIT LOGIC ====================
function showSuccess() {
  const messageBox = document.getElementById("successMessage");
  messageBox.style.display = "block";
  setTimeout(() => {
    messageBox.style.display = "none";
  }, 2500);
}

function saveChanges() {
  const formData = collectFormData();
  console.log("Collected form data on Save:", formData);

  fetch("/save_proposed_changes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData)
  })
  .then(response => {
    if (response.ok) {
      showSuccess();
    } else {
      alert("⚠️ Failed to save changes.");
    }
  })
  .catch(error => {
    console.error("Error:", error);
    alert("❌ Error occurred while saving.");
  });
}

function showSubmitMessage(message) {
  const submitBox = document.getElementById("submitMessage");
  if (submitBox) {
    submitBox.textContent = message;
    submitBox.style.display = "block";
    setTimeout(() => {
      submitBox.style.display = "none";
    }, 2500);
  }
}

function submitChanges(btn) {
  const btnText = btn.querySelector(".btn-text");
  const spinner = btn.querySelector(".spinner");

  btn.disabled = true;
  btnText.textContent = "Submitting...";
  spinner.style.display = "inline-block";

  const formData = collectFormData();
  console.log("Submitting changes:", formData);

  // First trigger Save
  fetch("/save_proposed_changes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData)
  })
  .then(saveResponse => {
    if (!saveResponse.ok) {
      throw new Error("Failed to auto-save before submit.");
    }
    // Proceed to submit after successful save
    return fetch("/submit_proposed_changes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData)
    });
  })
  .then(submitResponse => {
    if (submitResponse.ok) {
      showSubmitMessage("✅ Changes submitted!");
    } else {
      alert("⚠️ Submit failed after auto-save.");
    }
  })
  .catch(error => {
    console.error("Error during save + submit sequence:", error);
    alert("❌ Auto-save failed. Please try again.");
  })
  .finally(() => {
    // Always reset button
    btn.disabled = false;
    btnText.textContent = "Submit";
    spinner.style.display = "none";
  });
}

function collectFormData() {
  const editableElements = document.querySelectorAll(".editable");
  const data = {};

  editableElements.forEach((el) => {
    const label = el.closest("td").querySelector(".field-label")?.textContent?.trim();
    if (!label) return;

    let value = "";
    if (el.tagName === "SELECT" || el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      value = el.value;
    } else {
      value = el.textContent;
    }

    value = value?.trim();
    if (!value || value === '"' || value === "'") {
      value = "";  // Treat as blank
    }

    data[label] = value;
  });
  
  // 🔹 Explicitly handle cost center-related fields
  ["cc_name", "cc_responsible", "cc_responsible_wom"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      let value = (el.tagName === "INPUT") ? el.value.trim() : el.innerText.trim();
      if (!value || value.toLowerCase() === "not found") value = "";
      data[id] = value;
    }
  });

  const urlParams = new URLSearchParams(window.location.search);
  data['subscription_id'] = urlParams.get('id');
  data['platform'] = urlParams.get('platform');

  return data;
}

// ==================== HELPER FUNCTIONS ====================
function updateOrToggleField(id, value) {
  const el = document.getElementById(id);
  const currentValue = (el?.tagName === "INPUT") ? el.value.trim() : el.innerText.trim();

  // ✅ Case 1: API gives us a real value → always overwrite as readonly
  if (value && value.toLowerCase() !== "none") {
    forceMakeReadonlyById(id, value);
    return;
  }

  // ✅ Case 2: API failed or empty → always keep field editable
  // If manual value exists (from proposed_changes), keep it editable pre-filled
  if (currentValue && currentValue.toLowerCase() !== "not found") {
    forceMakeEditableById(id, currentValue);
  } else {
    // No manual value → editable blank
    forceMakeEditableById(id, "");
  }
}

function forceMakeEditableById(id, presetValue = null) {
  const existingEl = document.getElementById(id);
  const currentValue = presetValue ?? (
    existingEl.tagName === "DIV" ? existingEl.innerText.trim() : existingEl.value.trim()
  );

  if (existingEl.tagName === "DIV") {
    const input = document.createElement("input");
    input.type = "text";
    input.id = id;
    input.className = "editable";
    input.style.textAlign = "center";
    input.value = (currentValue && currentValue.toLowerCase() !== "not found") ? currentValue : "";
    existingEl.replaceWith(input);
  } else if (existingEl.tagName === "INPUT") {
    existingEl.value = (currentValue && currentValue.toLowerCase() !== "not found") ? currentValue : "";
  }
}

function forceMakeReadonlyById(id, value) {
  const existingEl = document.getElementById(id);
  if (existingEl.tagName === "INPUT") {
    const div = document.createElement("div");
    div.className = "readonly";
    div.id = id;
    div.innerText = value;
    existingEl.replaceWith(div);
  } else {
    existingEl.innerText = value;
  }
}

// // ==================== WOM ID auto update ====================
document.addEventListener("DOMContentLoaded", function () {
  const itOwnerInput = document.getElementById("it_owner");
  const costCenterInput = document.getElementById("cost_center");
  const overlay = document.getElementById("loadingOverlay");

  function fetchItOwnerDetails(email) {
    fetch('/get_it_owner_details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ it_owner_email: email })
    })
    .then(response => response.json())
    .then(data => {
      document.getElementById("it_owner_wom").innerText = data.it_owner_wom || "Not Found";
    })
    .catch(error => console.error("Error fetching IT Owner WOM:", error))
  }

function fetchCostCenterDetails(code) {
  overlay.style.visibility = "visible";
  fetch('/get_cost_center_details', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cost_center_code: code })
  })
  .then(response => response.json())
  .then(data => {
    let apiFailed = false;

    if (!data.cost_center_name || data.cost_center_name.toLowerCase() === "none") {
      apiFailed = true;
    }

    // Update fields
    updateOrToggleField("cc_name", data.cost_center_name);
    updateOrToggleField("cc_responsible", data.cost_center_responsible);
    updateOrToggleField("cc_responsible_wom", data.cost_center_responsible_wom);

    // Show popup if API failed
    if (apiFailed) {
      alert("Cost center not found in RefMDs portal. User needs to enter the details manually.");
    }
  })
  .catch(error => {
    console.error("Error fetching Cost Center details:", error);
    ['cc_name', 'cc_responsible', 'cc_responsible_wom'].forEach(id => forceMakeEditableById(id));
    alert("Cost center not found in RefMDs portal. User needs to enter the details manually.");
  })
  .finally(() => overlay.style.visibility = "hidden");
}


// === IT Owner Triggers ===
  itOwnerInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      const email = itOwnerInput.value.trim();
      if (email) {
        e.preventDefault();
        fetchItOwnerDetails(email);
        itOwnerInput.blur();
      }
    }
  });
  itOwnerInput.addEventListener("blur", () => {
    const email = itOwnerInput.value.trim();
    if (email) fetchItOwnerDetails(email);
  });
//=== Cost Center Triggers ===
  costCenterInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      const code = costCenterInput.value.trim();
      if (code) {
        e.preventDefault();
        fetchCostCenterDetails(code);
        costCenterInput.blur();
      }
    }
  });
  costCenterInput.addEventListener("blur", () => {
    const code = costCenterInput.value.trim();
    if (code) fetchCostCenterDetails(code);
  });

 // ========== Page Load Trigger (use the returned promise properly) ==========
  const initialItOwner = itOwnerInput.value.trim();
  if (initialItOwner) {
    fetchItOwnerDetails(initialItOwner);
  }
  const initialCostCenter = costCenterInput.value.trim();
  if (initialCostCenter) {
    overlay.style.display = "Visible";
    fetchCostCenterDetails(initialCostCenter)
      .finally(() => {
        overlay.style.visibility = "hidden";
      });
  }

});
