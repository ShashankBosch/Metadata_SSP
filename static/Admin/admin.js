document.addEventListener('DOMContentLoaded', function() {
      // Footer Year Display (only if element exists)
      const yearElement = document.getElementById('year');
      if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
      }
 
      // Send Email Logic
      function sendEmail() {
        const emailType = document.getElementById('emailType').value;
        switch (emailType) {
          case 'initial':
            alert('Initial E-mail triggered. Exporting dynamic Excel file...');
            break;
          case 'reminder':
            alert('Reminder triggered. Checking for overdue items...');
            break;
          case 'consolidated':
            alert('Sending consolidated email to BDO owner grouped by OU...');
            break;
        }
      }
 
      // Search Filter Functionality
      const assetSearchInput = document.getElementById('asset-search');
      const assetTable = document.getElementById('asset-table');
      const assetFilter = document.getElementById('asset-filter');
      const platformFilter = document.getElementById('platform-filter');
     
      function filterAssets() {
        const searchQuery = assetSearchInput.value.trim().toLowerCase();
        const providerFilter = assetFilter.value;
        const platformFilterValue = platformFilter.value;
       
        const rows = assetTable.querySelectorAll('tbody tr');
       
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          const provider = cells[1].textContent;
          const platform = cells[4].textContent;
         
          let matchesSearch = true;
          if (searchQuery) {
            matchesSearch = false;
            cells.forEach(cell => {
              if (cell.textContent.toLowerCase().includes(searchQuery)) {
                matchesSearch = true;
              }
            });
          }
         
          const matchesProvider = !providerFilter || provider === providerFilter;
          const matchesPlatform = !platformFilterValue || platform === platformFilterValue;
         
          row.style.display = (matchesSearch && matchesProvider && matchesPlatform) ? '' : 'none';
        });
      }
     
      if (assetSearchInput && assetTable) {
        assetSearchInput.addEventListener('input', filterAssets);
        assetFilter.addEventListener('change', filterAssets);
        platformFilter.addEventListener('change', filterAssets);
      }
 
      // Export Data to CSV
      function exportMetadata() {
        const table = document.getElementById('asset-table');
        const visibleRows = table.querySelectorAll('tbody tr:not([style*="display: none"])');
        let csvContent = '';
 
        // Add headers
        const headers = Array.from(table.querySelectorAll('thead th')).map(th => `"${th.innerText}"`);
        headers.pop(); // Remove Actions column from export
        csvContent += headers.join(',') + '\r\n';
 
        // Add visible row data
        visibleRows.forEach(row => {
          const cols = Array.from(row.cells);
          cols.pop(); // Remove Actions column from export
          const rowData = cols.map(col => `"${col.innerText.trim()}"`).join(',');
          csvContent += rowData + '\r\n';
        });
 
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = 'asset_metadata.csv';
        downloadLink.click();
      }
 
      // Edit Asset Functionality
      function editAsset(button) {
        const row = button.closest('tr');
        const cells = row.querySelectorAll('td');
       
        document.getElementById('edit-subscription').value = cells[0].textContent;
        document.getElementById('edit-provider').value = cells[1].textContent;
        document.getElementById('edit-costcenter').value = cells[2].textContent;
        document.getElementById('edit-owner').value = cells[3].textContent;
        document.getElementById('edit-platform').value = cells[4].textContent;
       
        document.getElementById('edit-modal').style.display = 'block';
      }
     
      function saveAsset() {
        const subscription = document.getElementById('edit-subscription').value;
        const provider = document.getElementById('edit-provider').value;
        const costcenter = document.getElementById('edit-costcenter').value;
        const owner = document.getElementById('edit-owner').value;
        const platform = document.getElementById('edit-platform').value;
       
        // Find the row with matching subscription and update it
        const rows = document.querySelectorAll('#asset-table tbody tr');
        rows.forEach(row => {
          if (row.cells[0].textContent === subscription) {
            row.cells[1].textContent = provider;
            row.cells[2].textContent = costcenter;
            row.cells[3].textContent = owner;
            row.cells[4].textContent = platform;
          }
        });
       
        closeEditModal();
        alert('Asset metadata updated successfully!');
      }
     
      function closeEditModal() {
        document.getElementById('edit-modal').style.display = 'none';
      }
 
      // Make functions available globally
      window.sendEmail = sendEmail;
      window.exportMetadata = exportMetadata;
      window.editAsset = editAsset;
      window.saveAsset = saveAsset;
      window.closeEditModal = closeEditModal;
    });
 
    // Review & Approval Functionality
    const reviewDropdown = document.getElementById('reviewDropdown');
   
    // Filter table based on dropdown selection
    reviewDropdown.addEventListener('change', function() {
      const rows = document.querySelectorAll('.approval-table tbody tr');
      const filter = this.value;
     
      rows.forEach(row => {
        if (filter === 'all') {
          row.style.display = '';
        } else if (filter === 'pending') {
          row.style.display = row.getAttribute('data-status') === 'pending' ? '' : 'none';
        }
        else if (filter === 'rejected'){
          row.style.display = row.getAttribute('data-status') === 'rejected' ? '' : 'none';
        }
        else if (filter === 'approved'){
          row.style.display = row.getAttribute('data-status') === 'approved' ? '' : 'none';
        }
      });
    });
 
    // Toggle action buttons when clicking pending status
    document.querySelectorAll('.status-pending').forEach(status => {
      status.addEventListener('click', function() {
        const buttons = this.nextElementSibling;
        buttons.style.display = buttons.style.display === 'none' ? 'flex' : 'none';
      });
    });
 
    // Approval/Rejection functionality
    document.querySelectorAll('.approve-btn, .reject-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const isApprove = this.classList.contains('approve-btn');
        const modal = document.getElementById('approval-modal');
        const modalMessage = document.getElementById('modal-message');
        const confirmBtn = document.getElementById('confirm-action');
        const row = this.closest('tr');
        const actionCell = row.querySelector('.action-cell');
       
        modalMessage.textContent = isApprove
          ? 'Are you sure you want to approve this request?'
          : 'Are you sure you want to reject this request?';
       
        modal.style.display = 'block';
       
        confirmBtn.onclick = function() {
          const subscriptionId = row.cells[1].textContent.trim();  // 2nd column = ID
          const platform = row.cells[0].textContent.trim();        // 1st column = Platform
          const action = isApprove ? 'approve' : 'reject';

          fetch('/handle_approval', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              subscription_id: subscriptionId,
              platform: platform,
              action: action
            })
          })
          .then(response => {
            if (response.ok) {
              actionCell.innerHTML = isApprove
                ? '<span class="status-approved">Approved</span>'
                : '<span class="status-rejected">Rejected</span>';
              row.setAttribute('data-status', isApprove ? 'approved' : 'rejected');
            } else {
              alert("⚠️ Failed to update approval status.");
            }
            modal.style.display = 'none';
          })
          .catch(error => {
            console.error("Error updating approval:", error);
            alert("❌ Error occurred while processing.");
            modal.style.display = 'none';
          });
        };
      });
    });
 
    // Close modal handlers
    document.querySelector('.close-modal').addEventListener('click', function() {
      document.getElementById('approval-modal').style.display = 'none';
    });
 
    document.getElementById('cancel-action').addEventListener('click', function() {
      document.getElementById('approval-modal').style.display = 'none';
    });
 
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
      const modal = document.getElementById('approval-modal');
      if (event.target === modal) {
        modal.style.display = 'none';
      }
     
      const editModal = document.getElementById('edit-modal');
      if (event.target === editModal) {
        editModal.style.display = 'none';
      }
    });
    // Notification Functions
function sendInitialEmail() {
  // Create Excel data
  const data = [
    ["Subscription", "Owner", "Last Contact", "Status"],
    ["SUB-001", "owner1@domain.com", "2023-11-10", "Active"],
    ["SUB-002", "owner2@domain.com", "2023-11-12", "Active"],
    ["SUB-003", "owner3@domain.com", "2023-11-05", "Needs Review"]
  ];
 
  // Convert to CSV
  let csvContent = data.map(row => row.join(",")).join("\n");
 
  // Create download link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `email_report_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
 
  // Log the action
  addEmailLogEntry({
    type: "Initial",
    recipient: "all-agents@domain.com",
    subscription: "All",
    status: "Sent"
  });
 
  alert("Initial email data downloaded as Excel file");
}
 
function checkOverdueSubscriptions() {
  // In a real app, this would check your backend
  const overdueSubs = [
    { id: "SUB-001", owner: "owner1@domain.com", daysOverdue: 5 },
    { id: "SUB-004", owner: "owner4@domain.com", daysOverdue: 12 }
  ];
 
  const list = document.getElementById('overdue-items');
  list.innerHTML = '';
  const btn = document.getElementById('reminder-btn');
 
  if (overdueSubs.length > 0) {
    overdueSubs.forEach(sub => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span>${sub.id}</span>
        <span class="overdue-days">${sub.daysOverdue} days</span>
      `;
      list.appendChild(li);
    });
    btn.disabled = false;
  } else {
    list.innerHTML = '<li>No overdue subscriptions</li>';
    btn.disabled = true;
  }
}
 
function sendReminderEmail() {
  const overdueItems = Array.from(document.querySelectorAll('#overdue-items li'))
    .filter(li => !li.textContent.includes('No overdue'))
    .map(li => li.querySelector('span').textContent);
 
  if (overdueItems.length === 0) {
    alert("No overdue subscriptions to remind");
    return;
  }
 
  // In a real app, this would send to each owner
  overdueItems.forEach(sub => {
    const owner = document.querySelector(`#asset-table td:first-child:contains(${sub})`)
      .closest('tr').querySelector('td:nth-child(4)').textContent;
   
    addEmailLogEntry({
      type: "Reminder",
      recipient: owner,
      subscription: sub,
      status: "Sent"
    });
  });
 
  alert(`Reminder emails sent for ${overdueItems.length} overdue subscriptions`);
}
 
function sendBdoEmail() {
  // In a real app, this would filter by status and group by OU
  const bdos = [
    { ou: "Cloud Engineering", email: "bdo1@domain.com", count: 3 },
    { ou: "Data Analytics", email: "bdo2@domain.com", count: 2 }
  ];
 
  bdos.forEach(bdo => {
    addEmailLogEntry({
      type: "BDO Consolidated",
      recipient: bdo.email,
      subscription: `${bdo.count} subscriptions`,
      status: "Sent"
    });
  });
 
  alert(`Consolidated emails sent to ${bdos.length} BDOs`);
}
 
function addEmailLogEntry(entry) {
  const table = document.querySelector('#email-log-table tbody');
  const row = document.createElement('tr');
 
  row.innerHTML = `
    <td>${new Date().toLocaleString()}</td>
    <td><span class="badge ${
      entry.type === 'Initial' ? 'badge-info' :
      entry.type.includes('BDO') ? 'badge-success' : 'badge-warning'
    }">${entry.type}</span></td>
    <td>${entry.recipient}</td>
    <td>${entry.subscription}</td>
    <td><span class="badge badge-success">${entry.status}</span></td>
  `;
 
  table.prepend(row);
}
 
// Check for overdue subscriptions on page load
document.addEventListener('DOMContentLoaded', checkOverdueSubscriptions);
// Updated function to check overdue subscriptions
function checkOverdueSubscriptions() {
  // Sample overdue data - in real app this would come from your backend
  const overdueSubs = [
    {
      id: "SUB-001",
      cloud: "Azure",
      costCenter: "CC-1001",
      owner: "owner1@domain.com",
      daysOverdue: 5
    },
    {
      id: "SUB-004",
      cloud: "AWS",
      costCenter: "CC-4004",
      owner: "owner4@domain.com",
      daysOverdue: 12
    }
  ];
 
  const tableBody = document.getElementById('overdue-items');
  tableBody.innerHTML = '';
  const btn = document.getElementById('reminder-btn');
 
  if (overdueSubs.length > 0) {
    overdueSubs.forEach(sub => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${sub.id}</td>
        <td>${sub.cloud}</td>
        <td>${sub.costCenter}</td>
        <td>${sub.owner}</td>
        <td class="days-overdue">${sub.daysOverdue} days</td>
      `;
      tableBody.appendChild(row);
    });
    btn.disabled = false;
  } else {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center">No overdue subscriptions</td>
      </tr>
    `;
    btn.disabled = true;
  }
}
 
// Function to send reminder emails
function sendReminderEmails() {
  const table = document.getElementById('overdue-items');
  const rows = table.querySelectorAll('tr');
 
  // Array to track sent emails
  const sentEmails = [];
 
  rows.forEach(row => {
    if (row.cells && row.cells.length >= 4) {
      const subId = row.cells[0].textContent;
      const ownerEmail = row.cells[3].textContent;
     
      // In a real app, this would actually send an email
      console.log(`Sending reminder for ${subId} to ${ownerEmail}`);
     
      // Add to log
      addEmailLogEntry({
        type: "Reminder",
        recipient: ownerEmail,
        subscription: subId,
        status: "Sent"
      });
     
      sentEmails.push(ownerEmail);
    }
  });
 
  if (sentEmails.length > 0) {
    alert(`Reminder emails sent to:\n${sentEmails.join('\n')}`);
  } else {
    alert("No valid overdue subscriptions found");
  }
 
  // Refresh the overdue list
  checkOverdueSubscriptions();
}
 
// Initialize on page load
document.addEventListener('DOMContentLoaded', checkOverdueSubscriptions);
 