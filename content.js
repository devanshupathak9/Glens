// Wait for the page to load
window.addEventListener('load', function() {
    // Small delay to ensure Gmail is fully loaded
    setTimeout(createPopup, 2000);
  });
  
  function createPopup() {
    // Create popup container
    const popup = document.createElement('div');
    popup.id = 'gmail-summary-popup';
    popup.innerHTML = `
      <div class="popup-content">
        <div class="popup-header">
          <h3>Gmail Summary</h3>
          <button class="close-btn">&times;</button>
        </div>
        <div class="popup-body">
          <p>Gmail page loaded successfully!</p>
          <p>URL: ${window.location.href}</p>
          <p>Title: ${document.title}</p>
          <p>Time: ${new Date().toLocaleTimeString()}</p>
        </div>
      </div>
    `;
  
    // Add to page
    document.body.appendChild(popup);
  
    // Close button functionality
    const closeBtn = popup.querySelector('.close-btn');
    closeBtn.addEventListener('click', function() {
      popup.remove();
    });
  
    // Auto-close after 10 seconds (optional)
    setTimeout(() => {
      if (document.body.contains(popup)) {
        popup.remove();
      }
    }, 10000);
  }
  
  // Recreate popup when navigating between Gmail pages
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      // Remove existing popup if any
      const existingPopup = document.getElementById('gmail-summary-popup');
      if (existingPopup) {
        existingPopup.remove();
      }
      // Create new popup after navigation
      setTimeout(createPopup, 1000);
    }
  }).observe(document, {subtree: true, childList: true});