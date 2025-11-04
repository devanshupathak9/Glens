let popupCloseTimeout;
let isPopupHovered = false;
const POPUP_TIMEOUT_MS = 10000; // 10 seconds

// Wait for the page to load
window.addEventListener('load', function() {
  setTimeout(initializeExtension, 4000); // Increased delay for Gmail to fully load
});

let lastUrl = location.href;

function initializeExtension() {
  console.log('🔍 Starting Gmail Summary Extension...');
  
  extractImportantEmails().then(emailData => {
    console.log('📧 Emails found:', emailData);
    
    if (emailData && emailData.length > 0) {
      // Show loading state
      createPopup('Analyzing ' + emailData.length + ' emails with AI...', emailData.length, true);
      
      // Send to background script for AI processing
      chrome.runtime.sendMessage({
        action: 'generateSummary',
        emailData: formatEmailData(emailData),
        emailCount: emailData.length
      }, (response) => {
        if (response && response.summary) {
          createPopup(response.summary, emailData.length);
        } else {
          createPopup('Analysis complete. ' + (response?.error || 'Try refreshing the page.'), emailData.length);
        }
      });
    } else {
      createPopup('No important emails detected. The extension looks for emails about deliveries, flights, meetings, etc. Try checking your main inbox.', 0);
    }
  }).catch(error => {
    console.error('Error extracting emails:', error);
    createPopup('Having trouble accessing your emails. Make sure you\'re on Gmail and try refreshing the page.');
  });
}

function extractImportantEmails() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const importantEmails = [];
        
        // Multiple strategies to find emails
        const emailElements = [
          // Strategy 1: Direct email thread elements
          ...document.querySelectorAll('[role="listitem"][data-thread-id]'),
          ...document.querySelectorAll('[role="listitem"][data-legacy-thread-id]'),
          ...document.querySelectorAll('[gh="tl"] [role="listitem"]'),
          
          // Strategy 2: Any element that looks like an email row
          ...document.querySelectorAll('.zA'),
          ...document.querySelectorAll('[class*="msg"]'),
          ...document.querySelectorAll('[class*="email"]'),
          
          // Strategy 3: More generic approach
          ...document.querySelectorAll('tr[class*="zA"]'),
          ...document.querySelectorAll('div[class*="message"]'),
        ];

        console.log(`Found ${emailElements.length} potential email elements`);
        
        // Remove duplicates by data attribute
        const uniqueEmails = new Map();
        emailElements.forEach(element => {
          const threadId = element.getAttribute('data-thread-id') || 
                          element.getAttribute('data-legacy-thread-id') ||
                          element.textContent.substring(0, 50);
          if (!uniqueEmails.has(threadId)) {
            uniqueEmails.set(threadId, element);
          }
        });

        const uniqueEmailElements = Array.from(uniqueEmails.values());
        
        // Process up to 25 unique emails
        uniqueEmailElements.slice(0, 25).forEach(emailElement => {
          try {
            const emailData = extractEmailData(emailElement);
            if (emailData && emailData.subject !== 'No subject' && emailData.sender !== 'Unknown sender') {
              // Check if it's important OR if it's recent (last 7 days)
              if (isImportantEmail(emailData) || isRecentEmail(emailData)) {
                importantEmails.push(emailData);
              }
            }
          } catch (e) {
            console.log('Error parsing email element:', e);
          }
        });
        
        console.log(`Filtered ${importantEmails.length} important/recent emails`);
        resolve(importantEmails);
      } catch (error) {
        reject(error);
      }
    }, 1500);
  });
}

function extractEmailData(emailElement) {
  let subject = 'No subject';
  let sender = 'Unknown sender';
  let snippet = '';
  let date = 'Recent';

  // Try multiple strategies to extract subject
  const subjectElements = [
    emailElement.querySelector('[data-thread-id] span'),
    emailElement.querySelector('[data-legacy-thread-id] span'),
    emailElement.querySelector('.bog span'),
    emailElement.querySelector('.xS span'),
    emailElement.querySelector('.bqe'),
    emailElement.querySelector('[class*="subject"]'),
    emailElement.querySelector('[class*="message"] span')
  ];

  for (const element of subjectElements) {
    if (element && element.textContent && element.textContent.trim().length > 2) {
      subject = element.textContent.trim();
      break;
    }
  }

  // Try multiple strategies to extract sender
  const senderElements = [
    emailElement.querySelector('[email]'),
    emailElement.querySelector('.yW span'),
    emailElement.querySelector('.zF'),
    emailElement.querySelector('[class*="sender"]'),
    emailElement.querySelector('[class*="from"]')
  ];

  for (const element of senderElements) {
    if (element) {
      const senderText = element.getAttribute('email') || element.textContent.trim();
      if (senderText && senderText.length > 0) {
        sender = senderText;
        break;
      }
    }
  }

  // Try multiple strategies to extract snippet
  const snippetElements = [
    emailElement.querySelector('.y2'),
    emailElement.querySelector('.xT'),
    emailElement.querySelector('.a4W'),
    emailElement.querySelector('[class*="snippet"]'),
    emailElement.querySelector('[class*="preview"]')
  ];

  for (const element of snippetElements) {
    if (element && element.textContent && element.textContent.trim().length > 5) {
      snippet = element.textContent.trim();
      break;
    }
  }

  // Extract date
  const dateElements = [
    emailElement.querySelector('[data-tooltip]'),
    emailElement.querySelector('.xW'),
    emailElement.querySelector('[class*="date"]'),
    emailElement.querySelector('[class*="time"]')
  ];

  for (const element of dateElements) {
    if (element) {
      const dateText = element.getAttribute('data-tooltip') || element.textContent.trim();
      if (dateText && dateText.length > 0) {
        date = dateText;
        break;
      }
    }
  }

  return {
    subject,
    sender,
    date,
    snippet,
    fullText: `Subject: ${subject} | From: ${sender} | Date: ${date} | Preview: ${snippet}`
  };
}

function isImportantEmail(emailData) {
  const importantKeywords = [
    // Deliveries & Packages
    'delivery', 'deliver', 'package', 'shipment', 'tracking', 'shipped', 'shipping', 'order',
    'amazon', 'fedex', 'ups', 'dhl', 'usps', 'arriving', 'arrival', 'out for delivery',
    
    // Flights & Travel
    'flight', 'airline', 'boarding', 'itinerary', 'airport', 'booking', 'reservation',
    'confirmation', 'ticket', 'delta', 'united', 'american airlines', 'southwest',
    'check-in', 'departure', 'arrival', 'airlines', 'travel',
    
    // Interviews & Meetings
    'interview', 'meeting', 'appointment', 'schedule', 'zoom', 'teams', 'google meet',
    'call', 'hiring', 'recruitment', 'careers', 'position', 'role', 'hiring manager',
    
    // Deadlines & Important dates
    'deadline', 'due', 'reminder', 'confirm', 'confirmation', 'invoice', 'bill',
    'payment', 'renewal', 'subscription', 'trial', 'expire', 'expiry', 'due date',
    
    // Events & Appointments
    'event', 'appointment', 'reservation', 'booking', 'rsvp', 'invitation', 'calendar'
  ];
  
  const text = emailData.fullText.toLowerCase();
  return importantKeywords.some(keyword => text.includes(keyword.toLowerCase()));
}

function isRecentEmail(emailData) {
  // Consider emails from recent time periods as potentially important
  const recentIndicators = [
    'hour', 'minute', 'today', 'yesterday', 'jan', 'feb', 'mar', 'apr', 'may', 'jun',
    'jul', 'aug', 'sep', 'oct', 'nov', 'dec', '2024', '2025'
  ];
  
  const dateText = emailData.date.toLowerCase();
  return recentIndicators.some(indicator => dateText.includes(indicator));
}

function formatEmailData(emailData) {
  return emailData.map((email, index) => 
    `EMAIL ${index + 1}:
FROM: ${email.sender}
SUBJECT: ${email.subject}
DATE: ${email.date}
PREVIEW: ${email.snippet}
---`
  ).join('\n');
}

function createPopup(summaryText, emailCount = 0, isLoading = false) {
  const existingPopup = document.getElementById('gmail-summary-popup');
  if (existingPopup) {
    existingPopup.remove();
  }

  // Clear any existing timeout
  if (popupCloseTimeout) {
    clearTimeout(popupCloseTimeout);
  }
  
  const popup = document.createElement('div');
  popup.id = 'gmail-summary-popup';
  
  const headerText = isLoading ? 
    '🤖 Analyzing Emails...' : 
    (emailCount > 0 ? `🤖 Gmail Summary (${emailCount} emails)` : '🤖 Gmail Summary');
  
  popup.innerHTML = `
    <div class="popup-content">
      <div class="popup-header">
        <h3>${headerText}</h3>
        <button class="close-btn">&times;</button>
      </div>
      <div class="popup-body">
        ${isLoading ? 
          '<div class="loading">Scanning your emails for important events...</div>' : 
          `<div class="summary-content">${formatSummary(summaryText)}</div>
           <div class="popup-footer">
             <small>Powered by Gemini Nano • ${new Date().toLocaleTimeString()}</small>
           </div>`
        }
      </div>
    </div>
  `;
  
  document.body.appendChild(popup);
  
    // Add hover event listeners
  setupPopupHoverEvents(popup);

  const closeBtn = popup.querySelector('.close-btn');
  closeBtn.addEventListener('click', function() {
    removePopup();
  });

  if (!isLoading) {
    // Start the auto-close timeout
    startPopupTimeout();
  }

  return popup;
}

function setupPopupHoverEvents(popup) {
  // Reset hover state
  isPopupHovered = false;

  // Mouse enter event - user is hovering over popup
  popup.addEventListener('mouseenter', function() {
    console.log('🐭 Popup hover started');
    isPopupHovered = true;
    
    // Clear any existing timeout when user hovers
    if (popupCloseTimeout) {
      clearTimeout(popupCloseTimeout);
      console.log('⏹️ Auto-close paused (user hovering)');
    }
  });

  // Mouse leave event - user moved away from popup
  popup.addEventListener('mouseleave', function() {
    console.log('🐭 Popup hover ended');
    isPopupHovered = false;
    
    // Restart the timeout when user moves away
    startPopupTimeout();
  });
}

function startPopupTimeout() {
  // Clear any existing timeout
  if (popupCloseTimeout) {
    clearTimeout(popupCloseTimeout);
  }

  // Only start timeout if popup is not being hovered
  if (!isPopupHovered) {
    console.log('⏰ Auto-close timer started:', POPUP_TIMEOUT_MS + 'ms');
    
    popupCloseTimeout = setTimeout(() => {
      const popup = document.getElementById('gmail-summary-popup');
      if (popup && document.body.contains(popup) && !isPopupHovered) {
        console.log('⏰ Auto-close triggered');
        removePopup();
      } else if (isPopupHovered) {
        console.log('⏰ Auto-close skipped (user still hovering)');
        // Try again in 10 seconds if user is still hovering
        setTimeout(startPopupTimeout, 10000);
      }
    }, POPUP_TIMEOUT_MS);
  }
}

function formatSummary(text) {
  return text.split('\n').map(line => {
    line = line.trim();
    if (line === '') return '<br>';
    if (line.match(/^[#🎯📦✈️📅👔⏰📊✨]/) || line.toUpperCase().includes('SUMMARY') || line.toUpperCase().includes('EVENTS')) {
      return `<h4 style="margin: 12px 0 8px 0; color: #1a73e8; font-weight: bold;">${line}</h4>`;
    }
    if (line.match(/^[-*•]/)) {
      return `<div style="margin: 4px 0; padding-left: 8px;">${line}</div>`;
    }
    return `<p style="margin: 8px 0;">${line}</p>`;
  }).join('');
}

new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    
    // Clear timeout and remove popup on navigation
    if (popupCloseTimeout) {
      clearTimeout(popupCloseTimeout);
      popupCloseTimeout = null;
    }
    isPopupHovered = false;
    
    const existingPopup = document.getElementById('gmail-summary-popup');
    if (existingPopup) {
      existingPopup.remove();
    }
    setTimeout(initializeExtension, 2000);
  }
}).observe(document, {subtree: true, childList: true});
