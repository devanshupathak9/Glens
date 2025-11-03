// Background script for Gemini Nano processing
let isProcessing = false;

// Listen for messages from content script
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === 'generateSummary' && !isProcessing) {
    isProcessing = true;
    
    try {
      console.log('🎯 Processing emails for AI summary...');
      console.log('📊 Emails found:', message.emailCount);
      
      let summary;
      const emailData = message.emailData;

      if (await isGeminiNanoAvailable()) {
        console.log('🤖 Using Gemini Nano for AI summarization...');
        summary = await summarizeWithGeminiNano(emailData);
      } else {
        console.log('📊 Using smart text summarization...');
        summary = createSmartSummary(emailData);
      }

      sendResponse({ summary });
    } catch (error) {
      console.error('❌ Summarization failed:', error);
      const fallback = createFallbackSummary(message.emailData);
      sendResponse({ summary: fallback });
    } finally {
      isProcessing = false;
    }
    
    return true; // Keep message channel open for async response
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

async function summarizeWithGeminiNano(emailData) {
  try {
    console.log("📧 Creating session with Gemini Nano...");
    
    // Create a session. This will trigger the download if needed.
    const session = await LanguageModel.create({
      monitor(monitor) {
        monitor.addEventListener('downloadprogress', (event) => {
          console.log(`📥 Model download progress: ${(event.loaded / event.total * 100).toFixed(1)}%`);
        });
      }
    });

    const prompt = `
You are a helpful AI assistant that analyzes emails and creates concise summaries of important upcoming events and commitments.

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

    console.log("🤖 Sending prompt to Gemini Nano...");
    const summary = await session.prompt(prompt);
    console.log("✅ Summary generated successfully!");
    
    return summary;
  } catch (error) {
    console.error('❌ Summarization with Gemini Nano failed:', error);
    throw error;
  }
}

function createSmartSummary(emailData) {
  if (!emailData || emailData.length < 100) {
    return "No sufficient email content found to analyze for upcoming events.";
  }

  // Extract key information using pattern matching
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
    return `📊 Found potential events:\n\n${events.join('\n')}\n\n💡 Enable Gemini Nano for more detailed analysis.`;
  }
  
  return createFallbackSummary(emailData);
}

function createFallbackSummary(emailData) {
  // Simple fallback - count occurrences of key terms
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
    return `📊 Email Analysis:\n\n${found.join('\n')}\n\n🔍 Enable Gemini Nano for detailed event extraction.`;
  }
  
  return "No upcoming events detected in recent emails. Gemini Nano can provide more accurate analysis if enabled.";
}
