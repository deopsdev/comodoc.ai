/**
 * server.js - Backend utama untuk aplikasi Komo AI.
 * File ini berfungsi sebagai server yang menerima pesan dari pengguna,
 * membersihkan data sensitif (privasi), dan berkomunikasi dengan kecerdasan buatan (AI).
 */

// Mengimpor modul bawaan Node.js untuk membuat server web (HTTP)
const http = require('http'); 
// Mengimpor modul filesystem untuk membaca file fisik dari folder (HTML, CSS, JS)
const fs = require('fs');     
// Mengimpor modul path untuk mengelola lokasi file dengan aman di berbagai sistem operasi
const path = require('path'); 
// Mengimpor fungsi pembantu untuk menghitung dan memotong token teks agar tidak melebihi batas
const { truncateMessagesToTokenLimit, countMessagesTokens } = require('./tokenizer_helper');

// Menentukan batas maksimum token (jumlah kata/karakter) yang bisa diproses AI (default 2048)
const MAX_MODEL_TOKENS = parseInt(process.env.MAX_MODEL_TOKENS || '2048', 10);

// Menentukan port jaringan tempat server akan "mendengarkan" permintaan (default 3030)
const PORT = process.env.PORT || 3030;

// Token API Hugging Face (kunci akses) yang diambil dari pengaturan sistem (environment variables)
const HF_TOKEN = process.env.HF_TOKEN || process.env.HF_API_KEY || null;
// Nama model AI yang digunakan dari layanan Hugging Face
const HF_MODEL = process.env.HF_MODEL || 'meta-llama/Llama-3.1-8B-Instruct:novita';

/**
 * requestHandler - Fungsi utama yang dipanggil setiap kali ada permintaan (request) masuk ke server.
 * @param {object} req - Objek permintaan dari browser (berisi URL, metode POST/GET, data pesan, dll)
 * @param {object} res - Objek respons untuk mengirimkan jawaban balik ke browser (HTML, JSON, dll)
 */
const requestHandler = async (req, res) => {
    // Mencatat aktivitas permintaan yang masuk ke jendela terminal (console) untuk pelacakan (debugging)
    console.log(`${req.method} ${req.url}`);

    // --- PENGATURAN KEAMANAN CORS ---
    // Mengatur Header agar website di browser diizinkan mengakses server ini meskipun alamatnya berbeda.
    res.setHeader('Access-Control-Allow-Origin', '*');
    // Mengizinkan metode pengiriman data tertentu (mengambil, mengirim, atau cek koneksi)
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    // Mengizinkan pengiriman tipe data JSON melalui header 'Content-Type'
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Jika browser mengirim permintaan "OPTIONS" (biasanya dilakukan otomatis oleh browser untuk cek izin),
    // kita langsung balas sukses (204 No Content) tanpa proses lebih lanjut.
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // --- SISTEM PERUTEAN (ROUTING) FILE STATIS ---
    // Bagian ini bertugas mengirimkan file (HTML, CSS, JS) agar tampilan website muncul di browser.

    // 1. Jika pengguna membuka halaman utama (URL '/' atau '/index.html')
    if (req.url === '/' || req.url === '/index.html') {
        fs.readFile(path.join(__dirname, 'index.html'), (err, content) => {
            if (err) {
                res.writeHead(500); // Kirim kode error 500 jika file rusak atau tidak ada
                res.end('Error loading index.html');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html' }); // Beritahu browser bahwa ini adalah file HTML
                res.end(content); // Kirimkan isi file index.html ke browser
            }
        });
    } 
    // 2. Jika browser meminta file gaya tampilan (style.css)
    else if (req.url === '/style.css') {
        fs.readFile(path.join(__dirname, 'style.css'), (err, content) => {
            if (err) {
                res.writeHead(500);
                res.end();
            } else {
                res.writeHead(200, { 'Content-Type': 'text/css' }); // Beritahu browser bahwa ini adalah file CSS
                res.end(content);
            }
        });
    } 
    // 3. Jika browser meminta file logika frontend (script.js)
    else if (req.url === '/script.js') {
        fs.readFile(path.join(__dirname, 'script.js'), (err, content) => {
            if (err) {
                res.writeHead(500);
                res.end();
            } else {
                res.writeHead(200, { 'Content-Type': 'text/javascript' }); // Beritahu browser bahwa ini adalah file JS
                res.end(content);
            }
        });
    } 
    else if (req.url === '/credits.html') {
        fs.readFile(path.join(__dirname, 'credits.html'), (err, content) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading credits.html');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(content);
            }
        });
    }
    else if (req.url === '/ogimage.png') {
        fs.readFile(path.join(__dirname, 'ogimage.png'), (err, content) => {
            if (err) {
                res.writeHead(500);
                res.end();
            } else {
                res.writeHead(200, { 'Content-Type': 'image/png' });
                res.end(content);
            }
        });
    }
    else if (req.url === '/ogimage.svg') {
        fs.readFile(path.join(__dirname, 'ogimage.svg'), (err, content) => {
            if (err) {
                res.writeHead(500);
                res.end();
            } else {
                res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
                res.end(content);
            }
        });
    }
    // 4. Membuat ikon website (Favicon) secara otomatis menggunakan format gambar SVG
    else if (req.url.startsWith('/favicon.svg')) {
        const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="45" fill="#1e1e1e" stroke="#00ffcc" stroke-width="5"/>
  <text x="50" y="70" font-family="Arial, sans-serif" font-size="65" font-weight="bold" fill="#00ffcc" text-anchor="middle">K</text>
</svg>`;
        res.writeHead(200, { 'Content-Type': 'image/svg+xml' }); // Kirim sebagai format gambar vektor SVG
        res.end(svgContent);
    } 
    // 5. Endpoint khusus '/chat' yang hanya menerima data (POST) untuk diproses oleh AI
    else if (req.url === '/chat' && req.method === 'POST') {
        let body = '';
        // Menerima data kiriman dari browser secara bertahap (chunk) agar tidak membebani memori
        req.on('data', chunk => {
            body += chunk.toString();
        });
        // Setelah semua data selesai diterima, mulai proses logika AI
        req.on('end', async () => {
            try {
                // Mengubah teks mentah format JSON menjadi objek JavaScript yang bisa diolah
                let { messages } = JSON.parse(body);

                // --- SISTEM PRIVASI: PENYENSORAN DATA SENSITIF (PII) ---
                // Mencari dan menyensor informasi pribadi agar tidak terkirim ke server AI luar.
                if (messages && messages.length > 0) {
                    const lastMsgIndex = messages.length - 1; // Ambil pesan terbaru (yang baru saja diketik user)
                    const lastMsg = messages[lastMsgIndex];

                    if (lastMsg.role === 'user') { // Hanya sensor pesan yang dikirim oleh pengguna
                        if (typeof lastMsg.content === 'string') {
                            let message = lastMsg.content;
                            const originalMessage = message;

                            // Menggunakan Regular Expression (Regex) untuk mencari pola teks tertentu:
                            // a. Sensor Alamat Email
                            message = message.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]');
                            // b. Sensor Nomor HP (Format Indonesia)
                            message = message.replace(/\b(\+62|08|62)\d{8,15}\b/g, '[PHONE_REDACTED]');
                            // c. Sensor Nomor Telepon umum (Format Internasional)
                            message = message.replace(/\b\d{3}[- .]?\d{3}[- .]?\d{4}\b/g, '[PHONE_REDACTED]');
                            // d. Sensor Nomor ID atau NIK (Pola 16 digit angka)
                            message = message.replace(/\b\d{16}\b/g, '[ID_NUM_REDACTED]');
                            // e. Sensor Nomor Kartu Kredit
                            message = message.replace(/\b(?:\d{4}[- ]?){3}\d{4}\b/g, '[CREDIT_CARD_REDACTED]');
                            // f. Sensor Tanggal (Format DD-MM-YYYY atau sebaliknya)
                            message = message.replace(/\b\d{1,2}[-/]\d{1,2}[-/]\d{4}\b/g, '[DATE_REDACTED]');
                            message = message.replace(/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g, '[DATE_REDACTED]');
                            // g. Sensor Kode Pos (Zip Code)
                            message = message.replace(/\b(?:Zip|Code|Pos)\s*:?\s*(\d{5})\b/gi, 'ZIP [REDACTED]');

                            // Jika ada teks yang berubah (terkena sensor), catat laporannya di terminal
                            if (message !== originalMessage) {
                                console.log('🛡️ Security: PII data redacted from user message.');
                            }
                            // Simpan kembali pesan yang sudah aman (sudah disensor) ke daftar pesan
                            messages[lastMsgIndex].content = message;
                        }
                    }
                }
                
                // --- PENGATURAN IDENTITAS AI (SYSTEM PROMPT) ---
                // Memberikan instruksi rahasia kepada AI tentang siapa dia dan bagaimana cara menjawab.
                const currentDate = new Date().toLocaleDateString('id-ID', { 
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Jakarta'
                });
                
                const systemPrompt = {
                    role: 'system',
                    content: `You are Komo — a privacy‑first multilingual AI assistant.
- Respect privacy: backend redacts PII.
- Default: reply in English. If the user's message is in another language, reply in that language.
- Translate only when explicitly requested; preserve meaning and tone.
- Avoid mixing languages; use clear, natural sentences.
- Keep formatting and line breaks; do not add extra commentary.
- Today: ${currentDate}.`
                };
                
                // Menambahkan instruksi sistem ini ke urutan paling atas daftar pesan jika belum ada
                if (!messages.some(m => m.role === 'system')) {
                    messages.unshift(systemPrompt);
                }

                // --- MANAJEMEN MEMORI (TOKEN TRUNCATION) ---
                // Memastikan riwayat percakapan tidak terlalu panjang agar tidak error atau mahal biayanya.
                try {
                    const beforeTokens = countMessagesTokens(messages); // Hitung total token saat ini
                    if (beforeTokens > MAX_MODEL_TOKENS) {
                        // Jika melebihi batas, hapus pesan-pesan lama tapi tetap simpan pesan terbaru
                        messages = truncateMessagesToTokenLimit(messages, MAX_MODEL_TOKENS);
                        console.log(`⚠️ Truncated messages: ${beforeTokens} → ${countMessagesTokens(messages)} tokens`);
                    }
                } catch (e) {
                    console.warn('Token truncation failed:', e.message);
                }

                // --- PENGIRIMAN DATA KE LAYANAN AI (HUGGING FACE) ---
                let reply = null;
                if (HF_TOKEN) {
                    try {
                        // Melakukan permintaan (request) ke API Hugging Face menggunakan fungsi 'fetch'
                        const hfRes = await fetch('https://router.huggingface.co/v1/chat/completions', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${HF_TOKEN}`, // Mengirim kunci akses (Token)
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ model: HF_MODEL, messages }) // Mengirim model yang dipilih dan daftar pesan
                        });

                        const hfText = await hfRes.text(); // Mengambil hasil respon dalam bentuk teks
                        if (!hfRes.ok) throw new Error(`HF Router Error: ${hfRes.status}`);

                        const hfJson = JSON.parse(hfText); // Mengubah teks respon menjadi objek JSON
                        reply = hfJson.choices[0].message.content; // Mengambil isi teks jawaban dari AI
                        console.log('✅ Response provided by Hugging Face Router');
                    } catch (err) {
                        console.error('⚠️ Hugging Face Router call failed:', err.message);
                    }
                }

                // Jika AI gagal memberikan jawaban (misalnya karena API down atau Token salah)
                if (!reply) {
                    const errorMessage = HF_TOKEN 
                        ? 'Gagal mendapatkan respon dari Hugging Face.' 
                        : 'HF_TOKEN tidak ditemukan.';
                    res.writeHead(503, { 'Content-Type': 'application/json' }); // Kirim kode 503 (Layanan tidak tersedia)
                    res.end(JSON.stringify({ error: errorMessage }));
                    return;
                }

                // --- MENGIRIM JAWABAN AKHIR KE PENGGUNA ---
                // Jika semua lancar, kirimkan jawaban AI dalam format JSON ke browser
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ reply }));

            } catch (error) {
                // Menangani jika terjadi error sistem (crash) agar server tidak mati total
                console.error('Error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
    } 
    // Jika pengguna mencoba mengakses alamat (URL) yang tidak terdaftar di atas
    else {
        res.writeHead(404); // Kirim kode 404 (Halaman tidak ditemukan)
        res.end('Not Found');
    }
};

// --- INISIALISASI DAN MENJALANKAN SERVER ---
// Membuat instance server menggunakan konfigurasi requestHandler di atas
const server = http.createServer(requestHandler);

// Menjalankan server jika file ini dipanggil secara langsung (bukan diimpor oleh file lain)
if (require.main === module) {
    server.listen(PORT, () => {
        // Menampilkan pesan sukses di terminal bahwa server sudah aktif
        console.log(`🚀 Komo AI Server running at http://localhost:${PORT}`);
    });
}

// Mengekspor requestHandler agar bisa diuji atau digunakan di modul lain jika diperlukan
module.exports = requestHandler;
