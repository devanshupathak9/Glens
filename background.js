
chrome.runtime.onMessage.addListener(async (message, sender) => {
if (message.action === "process_text") {
    console.log('Processing Email for summarization...');
    console.log('📊 Content length:', message.data?.length);
    try 
    {
    let summary;
    if (await isGeminiNanoAvailable()) {
        console.log('Using Gemini Nano for summarization!');
        summary = await summarizeWithGeminiNano(message.data);
    } else {
        console.log('📊 Using smart text summarization...');
        summary = message.data;
    }

    if (sender.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, {
        action: "display_result",
        data: summary,
        });
    }
    } catch (error) 
    {
    console.error('❌ Summarization failed:', error);
    const fallback = message.data;
    if (sender.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, {
        action: "display_result",
        data: fallback,
        });
    }
    }
}
});

async function isGeminiNanoAvailable() {
    try {
        if (!('LanguageModel' in self)) {
        console.log('Prompt API is not supported in this browser.');
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

async function summarizeWithGeminiNano(text) {
    try {
        const session = await LanguageModel.create({
        monitor(monitor) {
            monitor.addEventListener('downloadprogress', (event) => {
            console.log(`Download progress: ${(event.loaded / event.total * 100).toFixed(1)}%`);
            });
        }
        });

        console.log("Sending prompt to the model!!");
        const prompt = `
        You are a helpful AI assistant that summarizes web pages clearly and concisely.
        
        The following text is extracted from a webpage. 
        Please:
        1. Summarize the key ideas and important details.
        2. Present the summary in a structured, reader-friendly format with headings or bullet points if useful.
        3. Remove ads, navigation text, or irrelevant content.
        4. Keep the language simple, clear, and engaging.
        5. End with a one-line takeaway describing what the page is mainly about.
        
        --- Webpage Content ---
        ${text}
        `;
        const summary = await session.prompt(prompt);
        console.log("Response Generated!!");
        
        return summary;
    } catch (error) {
        console.error('❌ Summarization with Gemini Nano failed:', error);
        throw error;
}
}