const http = require('http');
const fs = require('fs');
const path = require('path');
const { truncateMessagesToTokenLimit, countMessagesTokens } = require('./tokenizer_helper');
// max tokens to send to model (env override)
const MAX_MODEL_TOKENS = parseInt(process.env.MAX_MODEL_TOKENS || '2048', 10);


// Use process.env.PORT for deployment (Heroku/Render/Railway) or fallback to 3030 locally
const PORT = process.env.PORT || 3030;
// HF_MODEL: set HF_MODEL in your environment to override default
const HF_TOKEN = process.env.HF_TOKEN || process.env.HF_API_KEY || null;
const HF_MODEL = process.env.HF_MODEL || 'meta-llama/Llama-3.1-8B-Instruct:novita';


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
                    content: `You are Komodoc — a privacy‑first AI assistant.

- Respect privacy: backend redacts PII. If user input appears sensitive or incomplete, ask a clarifying question instead of guessing.
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
                    const errorMessage = HF_TOKEN 
                        ? 'Gagal mendapatkan respon dari Hugging Face. Silakan periksa apakah Token Anda valid atau kuota API tersedia.' 
                        : 'HF_TOKEN tidak ditemukan. Silakan atur Environment Variable HF_TOKEN di sistem atau dashboard Vercel Anda.';
                    
                    res.writeHead(503, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: errorMessage }));
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