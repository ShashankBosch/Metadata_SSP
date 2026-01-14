document.addEventListener('DOMContentLoaded', function() {
  const filterBtn = document.getElementById('filterBtn');
  const filterDropdown = document.getElementById('filterDropdown');
  const searchInput = document.getElementById('searchInput');
  const searchIcon = document.querySelector('.search-icon');
  const loadingOverlay = document.createElement('div');
 
  // Create and add loading overlay to the DOM
  loadingOverlay.className = 'loading-overlay';
  loadingOverlay.innerHTML = `
    <div class="loading-spinner">
      <div class="collision-box"></div>
      <div class="collision-box"></div>
    </div>
  `;
  document.body.appendChild(loadingOverlay);
 
  // Toggle filter dropdown
  filterBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    filterDropdown.classList.toggle('show');
  });
 
  // Close dropdown when clicking outside
  document.addEventListener('click', function() {
    filterDropdown.classList.remove('show');
  });
 
  // Prevent dropdown from closing when clicking inside it
  filterDropdown.addEventListener('click', function(e) {
    e.stopPropagation();
  });
 
  // Search input - trigger on Enter key
  searchInput.addEventListener('keyup', function(e) {
    if (e.key === 'Enter') {
      triggerSearchAnimationAndFilter();
    }
  });
 
  // Also trigger search when clicking the search icon
  searchIcon.addEventListener('click', function() {
    triggerSearchAnimationAndFilter();
  });
 
  // Checkbox filter change
  document.querySelectorAll('.filter-option input').forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      filterTable();
    });
  });
 
  // Initial count update
  updateCounts();
 
  function triggerSearchAnimationAndFilter() {
    const searchTerm = searchInput.value.trim();
   
    // Show loading animation
    loadingOverlay.style.display = 'flex';
   
    // Disable search input during animation
    searchInput.disabled = true;
   
    // Filter table after 2 seconds
    setTimeout(() => {
      loadingOverlay.style.display = 'none';
      searchInput.disabled = false;
      filterTable();
    }, 2000);
  }
 
  function filterTable() {
    const searchQuery = searchInput.value.trim().toLowerCase();
    const checkedOptions = Array.from(document.querySelectorAll('.filter-option input:checked')).map(c => c.value);
   
    const rows = document.querySelectorAll('.approval-table tbody tr');
   
    rows.forEach(row => {
      const rowStatus = row.getAttribute('data-status');
      const cells = row.querySelectorAll('td');
     
      // Check if row matches status filter
      const statusMatch = checkedOptions.includes('all') || checkedOptions.includes(rowStatus);
     
      // Check if row matches search query
      let searchMatch = true;
      if (searchQuery) {
        searchMatch = false;
        cells.forEach(cell => {
          if (cell.textContent.toLowerCase().includes(searchQuery)) {
            searchMatch = true;
          }
        });
      }
     
      // Show/hide row based on filters
      row.style.display = (statusMatch && searchMatch) ? '' : 'none';
    });
   
    // Update counts after filtering
    updateCounts();
  }
 
  function updateCounts() {
    const rows = document.querySelectorAll('.approval-table tbody tr');
    const visibleRows = document.querySelectorAll('.approval-table tbody tr:not([style*="display: none"])');
   
    // Update filter counts based on visible rows only
    document.getElementById('countAll').textContent = visibleRows.length;
    document.getElementById('countPending').textContent = Array.from(visibleRows).filter(row => row.getAttribute('data-status') === 'pending').length;
    document.getElementById('countApproved').textContent = Array.from(visibleRows).filter(row => row.getAttribute('data-status') === 'approved').length;
    document.getElementById('countRejected').textContent = Array.from(visibleRows).filter(row => row.getAttribute('data-status') === 'rejected').length;
  }
 
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
  });
});