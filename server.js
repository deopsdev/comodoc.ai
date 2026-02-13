const http = require('http');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const { truncateMessagesToTokenLimit, countMessagesTokens } = require('./tokenizer_helper');
// max tokens to send to model (env override)
const MAX_MODEL_TOKENS = parseInt(process.env.MAX_MODEL_TOKENS || '2048', 10);


// Use process.env.PORT for deployment (Heroku/Render/Railway) or fallback to 3030 locally
const PORT = process.env.PORT || 3030;
// Hugging Face Router settings (session-only): set HF_TOKEN in your environment to enable
const HF_TOKEN = process.env.HF_TOKEN || process.env.HF_API_KEY || null;
const HF_MODEL = process.env.HF_MODEL || 'meta-llama/Llama-3.1-8B-Instruct:novita';


// --- HELPER: SEARCH WEB (BING) ---
async function searchWeb(query) {
    try {
        console.log('🔍 Searching Bing for:', query);
        // Use a more robust search approach if needed, but Bing works if selectors are correct
        const response = await axios.get(`https://www.bing.com/search?q=${encodeURIComponent(query)}&cc=ID`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer': 'https://www.bing.com/'
            },
            timeout: 5000 // 5 second timeout
        });

        const $ = cheerio.load(response.data);
        const results = [];
        
        // Bing's CSS classes can change, so we use multiple selectors
        const selectors = ['.b_algo', 'li.b_algo', '.b_caption', '.b_snippet'];
        
        $('.b_algo').each((i, el) => {
            if (i >= 5) return;
            const title = $(el).find('h2').text().trim();
            const link = $(el).find('a').attr('href');
            
            // Comprehensive snippet extraction
            let snippet = '';
            // Added more common selectors for snippets
            const snippetEl = $(el).find('.b_caption p, .b_snippet, .b_lineclamp2, .b_lineclamp3, .b_algoSlug, p');
            if (snippetEl.length > 0) {
                snippet = snippetEl.first().text().trim();
            }
            
            if (title && link) {
                results.push({ title, url: link, description: snippet });
            }
        });
        
        // Fallback for different Bing layout (e.g. mobile or minimal)
        if (results.length === 0) {
            $('h2 a').each((i, el) => {
                if (i >= 5) return;
                const title = $(el).text().trim();
                const link = $(el).attr('href');
                if (title && link && link.startsWith('http') && !link.includes('bing.com')) {
                    results.push({ title, url: link, description: '' });
                }
            });
        }
        
        console.log(`✅ Found ${results.length} results.`);
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
                let { messages, researchMode } = JSON.parse(body);

                // --- ADVANCED PII SAFETY FILTER (COMPREHENSIVE) ---
                // We only need to filter the LAST message from the user
                if (messages && messages.length > 0) {
                    const lastMsgIndex = messages.length - 1;
                    const lastMsg = messages[lastMsgIndex];

                    if (lastMsg.role === 'user') {
                        // Support both string and multimodal (array) user content
                        if (typeof lastMsg.content === 'string') {
                            let message = lastMsg.content;
                            const originalMessage = message;

                            // A. Direct Identifiers
                            message = message.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]');
                            message = message.replace(/\b(\+62|08|62)\d{8,15}\b/g, '[PHONE_REDACTED]');
                            message = message.replace(/\b\d{3}[- .]?\d{3}[- .]?\d{4}\b/g, '[PHONE_REDACTED]');
                            message = message.replace(/\b\d{16}\b/g, '[ID_NUM_REDACTED]');
                            message = message.replace(/\b(?:\d{4}[- ]?){3}\d{4}\b/g, '[CREDIT_CARD_REDACTED]');
                            message = message.replace(/\b\d{1,2}[-/]\d{1,2}[-/]\d{4}\b/g, '[DATE_REDACTED]');
                            message = message.replace(/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g, '[DATE_REDACTED]');
                            message = message.replace(/\b(?:Zip|Code|Pos)\s*:?\s*(\d{5})\b/gi, 'ZIP [REDACTED]');

                            if (message !== originalMessage) {
                                console.log('🛡️ Security: PII data redacted from user message.');
                            }
                            messages[lastMsgIndex].content = message;

                        } else if (Array.isArray(lastMsg.content)) {
                            // iterate parts and redact text parts only
                            const parts = lastMsg.content.map(part => {
                                if (!part) return part;
                                if (part.type === 'text' && typeof part.text === 'string') {
                                    let txt = part.text;
                                    const orig = txt;
                                    txt = txt.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]');
                                    txt = txt.replace(/\b(\+62|08|62)\d{8,15}\b/g, '[PHONE_REDACTED]');
                                    txt = txt.replace(/\b\d{3}[- .]?\d{3}[- .]?\d{4}\b/g, '[PHONE_REDACTED]');
                                    txt = txt.replace(/\b\d{16}\b/g, '[ID_NUM_REDACTED]');
                                    txt = txt.replace(/\b(?:\d{4}[- ]?){3}\d{4}\b/g, '[CREDIT_CARD_REDACTED]');
                                    txt = txt.replace(/\b\d{1,2}[-/]\d{1,2}[-/]\d{4}\b/g, '[DATE_REDACTED]');
                                    txt = txt.replace(/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g, '[DATE_REDACTED]');
                                    txt = txt.replace(/\b(?:Zip|Code|Pos)\s*:?\s*(\d{5})\b/gi, 'ZIP [REDACTED]');
                                    if (txt !== orig) console.log('🛡️ Security: PII data redacted from text part of multimodal message.');
                                    return { ...part, text: txt };
                                }
                                return part;
                            });
                            messages[lastMsgIndex].content = parts;
                        }
                    }
                }
                
                // --- NEW: WEB SEARCH CAPABILITY (RESEARCH) ---
                const lastMsgContent = messages[messages.length - 1].content;
                // Only perform search if researchMode is enabled by the user
                const needsSearch = researchMode === true;

                if (needsSearch) {
                    try {
                        // --- SMART QUERY OPTIMIZATION ---
                        const dateStr = new Date().toLocaleDateString('id-ID', { 
                            day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta'
                        });

                        let searchQuery = lastMsgContent;
                        
                        // Add context boosters based on keywords
                        const lowerMsg = (typeof lastMsgContent === 'string' ? lastMsgContent : '').toLowerCase();
                        if (lowerMsg.includes('bola') || lowerMsg.includes('pertandingan') || lowerMsg.includes('jadwal') || lowerMsg.includes('skor')) {
                            searchQuery = `${lastMsgContent} jadwal skor live terkini`;
                        } else if (lowerMsg.includes('cuaca')) {
                            searchQuery = `prakiraan cuaca ${lastMsgContent} hari ini bmkg`;
                        } else if (lowerMsg.includes('berita')) {
                            searchQuery = `berita terkini ${lastMsgContent} indonesia hari ini`;
                        }

                        console.log(`🔍 Optimized Search Query: "${searchQuery}"`);
                        const searchResults = await searchWeb(searchQuery);

                        let searchContext = '';
                        const currentDate = new Date().toLocaleDateString('id-ID', { 
                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Jakarta'
                        });

                        if (searchResults && searchResults.results && searchResults.results.length > 0) {
                            const topResults = searchResults.results.slice(0, 5).map(r => 
                                `[Source: ${r.title}]\n(URL: ${r.url})\nContent: ${r.description || 'No description available'}`
                            ).join('\n\n');

                            searchContext = `\n\n=== 🌍 LIVE SEARCH DATA (VERIFIED FACTS) ===\n[Date: ${currentDate}]\nHere is the real-time data I found for you. \n\n${topResults}\n\nINSTRUCTIONS FOR AI:\n1. Use the data above to answer specifically. \n2. Mention specific team names, scores, or times if available in the data.\n3. If the search results contain the answer, say it directly. Do NOT say "biasanya" or "mungkin".\n4. If the results mention specific matches happening today, LIST THEM.\n5. IMPORTANT: Your reply MUST be based on the LIVE SEARCH DATA provided above.\n=======================================\n`;
                            console.log('✅ Search results injected into context.');
                        } else {
                            console.log('⚠️ Search returned no results.');
                            searchContext = `\n\n[System Note: Research Mode was active, but no relevant search results were found for this query. Today is ${currentDate}. Answer based on your internal knowledge but mention that live search yielded no results.]`;
                        }
                        
                        // Ensure we don't break the message structure
                        if (messages[messages.length - 1]) {
                            messages[messages.length - 1].content += searchContext;
                        }
                    } catch (err) {
                        console.error('⚠️ Search logic failed:', err.message);
                        if (messages[messages.length - 1]) {
                            messages[messages.length - 1].content += `\n\n[System Note: Research Mode error: ${err.message}]`;
                        }
                    }
                }

                // Call provider (Hugging Face Router) — Pollinations removed
                
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
                    content: `You are Komodoc — a privacy‑first AI assistant with REAL‑TIME INTERNET ACCESS.

- Never state that you lack internet access; instead, say you have real‑time access when relevant.
- Respect privacy: backend redacts PII. If user input appears sensitive or incomplete, ask a clarifying question instead of guessing.
- On external API failure, acknowledge the issue and provide a best‑effort internal summary or next steps.
- Tone: Bahasa Indonesia, singkat, jelas, bantu dengan langkah praktis dan contoh bila perlu.
- Hari ini: ${currentDate}.`
                };
                
                // Prepend system prompt if it doesn't exist
                if (!messages.some(m => m.role === 'system')) {
                    messages.unshift(systemPrompt);
                } else {
                    // Update existing system prompt with date
                    const sysIdx = messages.findIndex(m => m.role === 'system');
                    messages[sysIdx].content += ` (Today is ${currentDate})`;
                }

                // Ensure message history fits within token budget (approximate)
                // Truncate older messages if needed, keeping system prompt and recent messages
                try {
                    const beforeTokens = countMessagesTokens(messages);
                    if (beforeTokens > MAX_MODEL_TOKENS) {
                        messages = truncateMessagesToTokenLimit(messages, MAX_MODEL_TOKENS);
                        console.log(`⚠️ Truncated messages: ${beforeTokens} → ${countMessagesTokens(messages)} tokens`);
                    }
                } catch (e) {
                    console.warn('Token truncation failed, continuing without truncation:', e.message);
                }

                // 1) Try Hugging Face Router (OpenAI-compatible chat endpoint) if HF_TOKEN is set
                let reply = null;

                if (HF_TOKEN) {
                    try {
                        const hfRes = await fetch('https://router.huggingface.co/v1/chat/completions', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${HF_TOKEN}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ model: HF_MODEL, messages })
                        });

                        const hfText = await hfRes.text().catch(() => '<no-body>');
                        if (!hfRes.ok) {
                            console.error('Hugging Face Router failed:', hfRes.status, hfRes.statusText, '\nBody:', hfText);
                            throw new Error(`HF Router Error: ${hfRes.status}`);
                        }

                        try {
                            const hfJson = JSON.parse(hfText);
                            if (hfJson.choices && hfJson.choices[0] && hfJson.choices[0].message) {
                                reply = hfJson.choices[0].message.content;
                            } else if (hfJson.output && Array.isArray(hfJson.output) && hfJson.output[0].content) {
                                // alternate HF router structure
                                const out = hfJson.output[0].content;
                                reply = typeof out === 'string' ? out : out[0]?.text || JSON.stringify(out);
                            } else {
                                reply = typeof hfJson === 'string' ? hfJson : JSON.stringify(hfJson);
                            }
                        } catch (e) {
                            reply = hfText; // plain text fallback
                        }

                        console.log('✅ Response provided by Hugging Face Router');
                    } catch (err) {
                        console.error('⚠️ Hugging Face Router call failed — no fallback available:', err.message);
                        reply = null; // force fallback
                    }
                }

                // If HF Router didn't provide a reply, fail fast — Pollinations removed
                if (!reply) {
                    console.error('No reply from Hugging Face Router and no fallback available.');
                    res.writeHead(503, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'No provider available: set HF_TOKEN to enable Hugging Face Router.' }));
                    return;
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