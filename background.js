// Background script for Gemini Nano processing
let isProcessing = false;

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'generateSummary' && !isProcessing) {
    isProcessing = true;

    (async () => {
      try {
        console.log('🎯 Processing emails for AI summary...');
        console.log('📊 Emails found:', message.emailCount);
        console.log('Current view:', message.currentView);

        let summary;
        const emailData = message.emailData;
        const currentView = message.currentView;

        if (await isGeminiNanoAvailable()) {
          console.log('🤖 Using Gemini Nano for AI summarization...');
          summary = await summarizeWithGeminiNano(emailData, currentView);
        } else {
          console.log('📊 Using smart text summarization...');
          summary = createSmartSummary(emailData, currentView);
        }

        sendResponse({ summary });
      } catch (error) {
        console.error('❌ Summarization failed:', error);
        const fallback = createFallbackSummary(message.emailData, message.currentView);
        sendResponse({ summary: fallback });
      } finally {
        isProcessing = false;
      }
    })();

    return true;
  }
});

async function isGeminiNanoAvailable() {
  try {
    if (!('LanguageModel' in self)) {
      console.log('❌ Gemini Nano is not supported in this browser.');
      return false;
    }

    const availability = await LanguageModel.availability();
    console.log('🔍 Gemini Nano availability:', availability);

    return availability === "available" || availability === "downloadable";
  } catch (error) {
    console.log('❌ Gemini Nano availability check failed:', error);
    return false;
  }
}

async function summarizeWithGeminiNano(emailData, currentView) {
  try {
    console.log("📧 Creating session with Gemini Nano...");
    
    const session = await LanguageModel.create({
      monitor(monitor) {
        monitor.addEventListener('downloadprogress', (event) => {
          console.log(`📥 Model download progress: ${(event.loaded / event.total * 100).toFixed(1)}%`);
        });
      }
    });

    // ✅ DIFFERENT PROMPTS FOR INBOX VS EMAIL VIEW
    const prompt = currentView === 'INBOX_VIEW' 
      ? createInboxPrompt(emailData)
      : createEmailPrompt(emailData);

    console.log("🤖 Sending prompt to Gemini Nano...");
    const summary = await session.prompt(prompt);
    console.log("✅ Summary generated successfully!");
    
    return summary;
  } catch (error) {
    console.error('❌ Summarization with Gemini Nano failed:', error);
    throw error;
  }
}

function createInboxPrompt(emailData) {
  return `
You are a helpful AI assistant that analyzes multiple emails and creates a concise summary of important upcoming events and commitments.

IMPORTANT: Focus ONLY on extracting and summarizing actual events, appointments, deliveries, and deadlines from the email content.

EMAIL DATA:
${emailData}

Please analyze these emails and provide a structured summary with these categories:

🎯 UPCOMING EVENTS & COMMITMENTS:
- Deliveries & Packages (tracking numbers, expected dates, shipping carriers)
- Flights & Travel (airlines, dates, times, flight numbers, confirmation codes)
- Interviews & Meetings (company names, positions, dates, times, platforms like Zoom/Teams)
- Appointments & Reservations (type, date, time, location, confirmation numbers)
- Deadlines & Important Dates (submissions, payments, renewals, due dates)

FORMATTING REQUIREMENTS:
1. Start with a brief overview of what's coming up
2. Group items by category with clear headings
3. Include specific dates, times, and key details
4. Highlight any urgent items (within next 24-48 hours)
5. Skip any marketing emails, newsletters, or non-actionable content
6. If no important events are found, say "No upcoming events found in recent emails"

Make the summary clean, professional, and easy to scan quickly.
`;
}

function createEmailPrompt(emailData) {
  return `
You are a helpful AI assistant that analyzes a single email and creates a concise summary of its key information.

IMPORTANT: Focus on extracting the most important information from this specific email.

EMAIL CONTENT:
${emailData}

Please analyze this email and provide a structured summary with these sections:

📧 EMAIL SUMMARY:
- **Main Purpose**: What is this email primarily about?
- **Key Points**: Bullet points of important information
- **Action Required**: Any tasks, responses, or actions needed
- **Important Details**: Dates, times, locations, numbers, contacts

SPECIFIC ITEMS TO EXTRACT:
- Dates and deadlines mentioned
- Contact information (names, emails, phone numbers)
- Numbers (order numbers, amounts, quantities)
- Locations and addresses
- Urgent or time-sensitive information

FORMATTING REQUIREMENTS:
1. Start with a one-sentence overview
2. Use clear headings and bullet points
3. Highlight urgent items at the top
4. Include specific details like confirmation numbers, dates, times
5. Keep it concise but comprehensive

If this is a newsletter or marketing email, provide a brief "TL;DR" summary of the main content.`;
}

function createSmartSummary(emailData, currentView) {
  // ✅ Handle empty data for both views
  if (!emailData || emailData.length < 50) {
    return currentView === 'INBOX_VIEW' 
      ? "No sufficient email content found to analyze for upcoming events."
      : "No sufficient content found in this email to analyze.";
  }

  // ✅ Different logic for inbox vs email view
  if (currentView === 'INBOX_VIEW') {
    return createInboxSmartSummary(emailData);
  } else {
    return createEmailSmartSummary(emailData);
  }
}

// ✅ ADDED: Smart summary for inbox view (multiple emails)
function createInboxSmartSummary(emailData) {
  const events = [];
  
  // Look for delivery information
  const deliveryMatches = emailData.match(/(delivery|deliver|package|shipment|tracking).*?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\b(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b)/gi);
  if (deliveryMatches) {
    events.push("📦 Deliveries: " + deliveryMatches.slice(0, 2).join(', '));
  }
  
  // Look for flight information
  const flightMatches = emailData.match(/(flight|airline|boarding).*?([A-Z]{2}\d+|\d+[A-Z]?)/gi);
  if (flightMatches) {
    events.push("✈️ Flights: " + flightMatches.slice(0, 2).join(', '));
  }
  
  // Look for meeting information
  const meetingMatches = emailData.match(/(meeting|interview|appointment).*?(\d{1,2}[:\.]\d{2}\s*(am|pm)|\b(tomorrow|today)\b)/gi);
  if (meetingMatches) {
    events.push("📅 Meetings: " + meetingMatches.slice(0, 2).join(', '));
  }
  
  if (events.length > 0) {
    return `📊 Found potential events in your inbox:\n\n${events.join('\n')}\n\n💡 Enable Gemini Nano for more detailed analysis.`;
  }
  
  return createFallbackSummary(emailData, 'INBOX_VIEW');
}

// ✅ ADDED: Smart summary for email view (single email)
function createEmailSmartSummary(emailData) {
  const keyInfo = [];
  
  // Extract dates
  const dateMatches = emailData.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\b(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b)\b/gi);
  if (dateMatches) {
    keyInfo.push("📅 Dates mentioned: " + [...new Set(dateMatches)].slice(0, 3).join(', '));
  }
  
  // Extract times
  const timeMatches = emailData.match(/\b(\d{1,2}[:\.]\d{2}\s*(am|pm)|noon|midnight)\b/gi);
  if (timeMatches) {
    keyInfo.push("⏰ Times mentioned: " + [...new Set(timeMatches)].slice(0, 3).join(', '));
  }
  
  // Extract numbers (order numbers, amounts, etc.)
  const numberMatches = emailData.match(/\b(\d{4,}|\$\d+|\d+\.\d{2})\b/g);
  if (numberMatches) {
    keyInfo.push("🔢 Important numbers: " + numberMatches.slice(0, 3).join(', '));
  }
  
  // Check for urgency
  const urgentMatches = emailData.match(/\b(urgent|asap|immediately|important|deadline)\b/gi);
  if (urgentMatches) {
    keyInfo.push("🚨 Urgency indicators: " + urgentMatches.slice(0, 2).join(', '));
  }
  
  if (keyInfo.length > 0) {
    return `📧 Key information from this email:\n\n${keyInfo.join('\n')}\n\n💡 Enable Gemini Nano for comprehensive analysis.`;
  }
  
  return createFallbackSummary(emailData, 'EMAIL_VIEW');
}

function createFallbackSummary(emailData, currentView) {
  // ✅ Different fallback logic based on view
  if (currentView === 'INBOX_VIEW') {
    return createInboxFallbackSummary(emailData);
  } else {
    return createEmailFallbackSummary(emailData);
  }
}

// ✅ ADDED: Fallback for inbox view
function createInboxFallbackSummary(emailData) {
  const terms = {
    'delivery': '📦 Deliveries',
    'flight': '✈️ Flights', 
    'meeting': '📅 Meetings',
    'interview': '👔 Interviews',
    'deadline': '⏰ Deadlines'
  };
  
  const found = [];
  for (const [term, label] of Object.entries(terms)) {
    const regex = new RegExp(term, 'gi');
    const matches = emailData.match(regex);
    if (matches) {
      found.push(`${label}: ${matches.length} mentioned`);
    }
  }
  
  if (found.length > 0) {
    return `📊 Inbox Analysis:\n\n${found.join('\n')}\n\n🔍 Enable Gemini Nano for detailed event extraction.`;
  }
  
  return "No upcoming events detected in recent emails. Gemini Nano can provide more accurate analysis if enabled.";
}

// ✅ ADDED: Fallback for email view
function createEmailFallbackSummary(emailData) {
  // Simple analysis for single email
  const emailLength = emailData.length;
  const hasDates = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|tomorrow|today)\b/gi.test(emailData);
  const hasNumbers = /\b(\d{4,}|\$\d+)\b/g.test(emailData);
  
  let analysis = "📧 Email Analysis:\n\n";
  
  if (hasDates) {
    analysis += "• Contains date information\n";
  }
  if (hasNumbers) {
    analysis += "• Contains important numbers\n";
  }
  
  analysis += `• Content length: ${emailLength} characters\n\n`;
  analysis += "🔍 Enable Gemini Nano for comprehensive email summary.";
  
  return analysis;
}

// function createSmartSummary(emailData) {
//   if (!emailData || emailData.length < 100) {
//     return "No sufficient email content found to analyze for upcoming events.";
//   }

//   // Extract key information using pattern matching
//   const events = [];
  
//   // Look for delivery information
//   const deliveryMatches = emailData.match(/(delivery|deliver|package|shipment|tracking).*?(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\b(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b)/gi);
//   if (deliveryMatches) {
//     events.push("📦 Deliveries: " + deliveryMatches.slice(0, 2).join(', '));
//   }
  
//   // Look for flight information
//   const flightMatches = emailData.match(/(flight|airline|boarding).*?([A-Z]{2}\d+|\d+[A-Z]?)/gi);
//   if (flightMatches) {
//     events.push("✈️ Flights: " + flightMatches.slice(0, 2).join(', '));
//   }
  
//   // Look for meeting information
//   const meetingMatches = emailData.match(/(meeting|interview|appointment).*?(\d{1,2}[:\.]\d{2}\s*(am|pm)|\b(tomorrow|today)\b)/gi);
//   if (meetingMatches) {
//     events.push("📅 Meetings: " + meetingMatches.slice(0, 2).join(', '));
//   }
  
//   if (events.length > 0) {
//     return `📊 Found potential events:\n\n${events.join('\n')}\n\n💡 Enable Gemini Nano for more detailed analysis.`;
//   }
  
//   return createFallbackSummary(emailData);
// }

// function createFallbackSummary(emailData) {
//   // Simple fallback - count occurrences of key terms
//   const terms = {
//     'delivery': '📦 Deliveries',
//     'flight': '✈️ Flights', 
//     'meeting': '📅 Meetings',
//     'interview': '👔 Interviews',
//     'deadline': '⏰ Deadlines'
//   };
  
//   const found = [];
//   for (const [term, label] of Object.entries(terms)) {
//     const regex = new RegExp(term, 'gi');
//     const matches = emailData.match(regex);
//     if (matches) {
//       found.push(`${label}: ${matches.length} mentioned`);
//     }
//   }
  
//   if (found.length > 0) {
//     return `📊 Email Analysis:\n\n${found.join('\n')}\n\n🔍 Enable Gemini Nano for detailed event extraction.`;
//   }
  
//   return "No upcoming events detected in recent emails. Gemini Nano can provide more accurate analysis if enabled.";
// }
