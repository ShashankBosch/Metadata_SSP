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
