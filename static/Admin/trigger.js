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