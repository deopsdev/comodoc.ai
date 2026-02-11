const http = require('http');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

// Use process.env.PORT for deployment (Heroku/Render/Railway) or fallback to 3030 locally
const PORT = process.env.PORT || 3030;

// --- HELPER: SEARCH WEB (BING) ---
async function searchWeb(query) {
    try {
        console.log('🔍 Searching Bing for:', query);
        // Add cc=ID for Indonesian context and explicit language headers
        const response = await axios.get(`https://www.bing.com/search?q=${encodeURIComponent(query)}&cc=ID`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        });

        const $ = cheerio.load(response.data);
        const results = [];
        
        $('.b_algo').each((i, el) => {
            if (i >= 5) return;
            const title = $(el).find('h2').text().trim();
            const link = $(el).find('a').attr('href');olong CustomElementRegistry
            // Try multiple snippet selectors
            const snippet = $(el).find('.b_caption p').text().trim() || 
                           $(el).find('.b_snippet').text().trim() ||
                           $(el).find('p').text().trim();
            
            if (title && link) {
                results.push({ title, url: link, description: snippet });
            }
        });
        
        return { results };
    } catch (e) {
        console.error('Search Error:', e.message);
        return { results: [] };
    }
}

const requestHandler = async (req, res) => {
    console.log(`${req.method} ${req.url}`);

    // CORS headers (useful if we were on different ports, but we are serving from same origin)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.url === '/' || req.url === '/index.html') {
        fs.readFile(path.join(__dirname, 'index.html'), (err, content) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading index.html');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(content);
            }
        });
    } else if (req.url === '/style.css') {
        fs.readFile(path.join(__dirname, 'style.css'), (err, content) => {
            if (err) {
                res.writeHead(500);
                res.end();
            } else {
                res.writeHead(200, { 'Content-Type': 'text/css' });
                res.end(content);
            }
        });
    } else if (req.url === '/script.js') {
        fs.readFile(path.join(__dirname, 'script.js'), (err, content) => {
            if (err) {
                res.writeHead(500);
                res.end();
            } else {
                res.writeHead(200, { 'Content-Type': 'text/javascript' });
                res.end(content);
            }
        });
    } else if (req.url.startsWith('/favicon.svg')) {
        const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="45" fill="#1e1e1e" stroke="#00ffcc" stroke-width="5"/>
  <text x="50" y="70" font-family="Arial, sans-serif" font-size="65" font-weight="bold" fill="#00ffcc" text-anchor="middle">K</text>
</svg>`;
        res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
        res.end(svgContent);
    } else if (req.url === '/chat' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                // Expect an array of messages now
                let { messages } = JSON.parse(body);

                // --- ADVANCED PII SAFETY FILTER (COMPREHENSIVE) ---
                // We only need to filter the LAST message from the user
                if (messages && messages.length > 0) {
                    const lastMsgIndex = messages.length - 1;
                    const lastMsg = messages[lastMsgIndex];

                    if (lastMsg.role === 'user') {
                        let message = lastMsg.content;
                        const originalMessage = message;

                        // A. Direct Identifiers
                        // 1. Email Addresses
                        message = message.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]');
                        
                        // 2. Phone Numbers (Indonesian & International formats)
                        // Covers: +62, 08xx, (xxx) xxx-xxxx
                        message = message.replace(/\b(\+62|08|62)\d{8,15}\b/g, '[PHONE_REDACTED]');
                        message = message.replace(/\b\d{3}[- .]?\d{3}[- .]?\d{4}\b/g, '[PHONE_REDACTED]');

                        // 3. Identification Numbers (NIK/KTP, Passport, Driver's License - Generic 16 digits)
                        message = message.replace(/\b\d{16}\b/g, '[ID_NUM_REDACTED]');
                        
                        // B. Sensitive PII (Financial)
                        // 1. Credit Card Numbers (Visa, Mastercard, etc. - 13-19 digits, often grouped)
                        message = message.replace(/\b(?:\d{4}[- ]?){3}\d{4}\b/g, '[CREDIT_CARD_REDACTED]');

                        // C. Indirect Identifiers (Dates & Locations)
                        // 1. Dates of Birth (Formats: DD-MM-YYYY, YYYY-MM-DD, DD/MM/YYYY)
                        // Simple regex to catch common date patterns
                        message = message.replace(/\b\d{1,2}[-/]\d{1,2}[-/]\d{4}\b/g, '[DATE_REDACTED]');
                        message = message.replace(/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g, '[DATE_REDACTED]');

                        // 2. ZIP Codes (5 digits) - Context aware is hard, but we can catch 5 digit isolated numbers
                        // NOTE: This might be too aggressive for general numbers, so we limit to specific patterns if needed.
                        // For now, we'll assume 5 digit numbers at the end of a string or after "Zip" might be sensitive.
                        message = message.replace(/\b(?:Zip|Code|Pos)\s*:?\s*(\d{5})\b/gi, 'ZIP [REDACTED]');

                        if (message !== originalMessage) {
                            console.log('🛡️ Security: PII data redacted from user message.');
                        }
                        
                        // Update the content in the array
                        messages[lastMsgIndex].content = message;
                    }
                }
                
                // --- NEW: WEB SEARCH CAPABILITY (RESEARCH) ---
                // Detect if user needs up-to-date info and search DuckDuckGo
                const lastMsgContent = messages[messages.length - 1].content;
                // ALWAYS perform search for every user message to ensure up-to-date context
                // We remove the keyword check and default to searching for the user's last message
                const needsSearch = true; 

                if (needsSearch) {
                    try {
                        // --- SMART QUERY OPTIMIZATION ---
                        // Instead of searching raw user input, we optimize it for better results
                        // e.g. "bola hari ini" -> "jadwal bola hari ini [current_date] scores"
                        
                        const dateStr = new Date().toLocaleDateString('id-ID', { 
                            day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta'
                        });

                        let searchQuery = lastMsgContent;
                        
                        // Add context boosters based on keywords
                        const lowerMsg = lastMsgContent.toLowerCase();
                        if (lowerMsg.includes('bola') || lowerMsg.includes('pertandingan') || lowerMsg.includes('jadwal') || lowerMsg.includes('skor')) {
                            // For sports, generic "hari ini" often yields better live results than specific dates
                            searchQuery = `jadwal bola hari ini live score terkini`;
                        } else if (lowerMsg.includes('cuaca')) {
                            searchQuery = `prakiraan cuaca hari ini ${dateStr} bmkg`;
                        } else if (lowerMsg.includes('berita')) {
                            searchQuery = `berita terkini hari ini indonesia`;
                        }

                        console.log(`🔍 Optimized Search Query: "${searchQuery}"`);
                        const searchResults = await searchWeb(searchQuery);

                        if (searchResults && searchResults.results && searchResults.results.length > 0) {
                            // Take top 5 results
                            const topResults = searchResults.results.slice(0, 5).map(r => 
                                `[Source: ${r.title}]\n(URL: ${r.url})\nContent: ${r.description}`
                            ).join('\n\n');

                            // Inject into the prompt with STRICTER instructions
                            const currentDate = new Date().toLocaleDateString('id-ID', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric',
                                timeZone: 'Asia/Jakarta'
                            });
                            
                            const searchContext = `\n\n=== 🌍 LIVE SEARCH DATA (VERIFIED FACTS) ===\n[Date: ${currentDate}]\nHere is the real-time data I found for you. \n\n${topResults}\n\nINSTRUCTIONS FOR AI:\n1. Use the data above to answer specifically. \n2. Mention specific team names, scores, or times if available in the data.\n3. If the search results contain the answer, say it directly. Do NOT say "biasanya" or "mungkin".\n4. If the results mention specific matches happening today, LIST THEM.\n=======================================\n`;
                            
                            messages[messages.length - 1].content += searchContext;
                            console.log('✅ Search results injected into context.');
                        } else {
                            console.log('⚠️ Search returned no results.');
                        }
                    } catch (err) {
                        console.error('⚠️ Search failed:', err.message);
                    }
                }
                // ---------------------------------------------------

                // Call Pollinations AI with Mistral
                
                // Add System Prompt for Date Awareness (if not present)
                const currentDate = new Date().toLocaleDateString('id-ID', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    timeZone: 'Asia/Jakarta'
                });
                
                const systemPrompt = {
                    role: 'system',
                    content: `You are Komodoc, a helpful AI assistant. Today is ${currentDate}. Always answer based on the current date unless specified otherwise.`
                };
                
                // Prepend system prompt if it doesn't exist
                if (!messages.some(m => m.role === 'system')) {
                    messages.unshift(systemPrompt);
                } else {
                    // Update existing system prompt with date
                    const sysIdx = messages.findIndex(m => m.role === 'system');
                    messages[sysIdx].content += ` (Today is ${currentDate})`;
                }

                const response = await fetch('https://text.pollinations.ai/', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    },
                    body: JSON.stringify({
                        messages: messages, // Send the full history
                        model: 'mistral'
                    })
                });

                if (!response.ok) {
                    throw new Error(`API Error: ${response.statusText}`);
                }

                const text = await response.text();
                // Try to parse JSON if it comes as JSON, otherwise use text
                let reply = text;
                try {
                    const json = JSON.parse(text);
                    if (json.choices && json.choices[0]) {
                        reply = json.choices[0].message.content;
                    }
                } catch (e) {
                    // plain text
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ reply }));

            } catch (error) {
                console.error('Error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
};

const server = http.createServer(requestHandler);

// Only listen if run directly (not imported as a module/serverless function)
if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}/`);
    });
}

module.exports = requestHandler;