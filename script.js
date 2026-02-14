/**
 * script.js - Logika Frontend (Antarmuka Pengguna) untuk Komodoc AI.
 * File ini mengatur bagaimana browser merespon klik tombol, menampilkan pesan,
 * dan mengirim data ke server (backend).
 */

// Menunggu hingga seluruh elemen HTML selesai dimuat oleh browser sebelum menjalankan kode
document.addEventListener('DOMContentLoaded', () => {
    
    // --- PENGAMBILAN ELEMEN HTML ---
    // Mengambil referensi tombol "Kirim" agar bisa dikendalikan lewat kode
    const sendButton = document.getElementById('send-button'); 
    // Mengambil referensi kotak input tempat user mengetik pesan
    const userInput = document.getElementById('user-input');   
    // Mengambil referensi area chat tempat gelembung pesan akan muncul
    const chatMessages = document.getElementById('chat-messages'); 

    /**
     * conversationHistory - Variabel untuk menyimpan seluruh riwayat percakapan.
     * Ini penting agar AI ingat apa yang sudah dibicarakan sebelumnya (konteks).
     */
    let conversationHistory = [
        // Pesan sistem awal untuk memberi tahu AI cara bersikap dan berperan
        { role: 'system', content: 'You are Komodoc, a helpful, friendly, and secure AI assistant.' }
    ];

    /**
     * addMessage - Fungsi untuk membuat dan menampilkan gelembung pesan baru di layar.
     * @param {string} text - Isi teks pesan yang ingin ditampilkan
     * @param {string} sender - Kategori pengirim: 'user' (pengguna), 'ai' (asisten), atau 'system' (info sistem)
     */
    function addMessage(text, sender) {
        // Membuat elemen <div> baru di dalam memori browser untuk membungkus pesan
        const messageDiv = document.createElement('div');
        // Menambahkan class 'message' agar mendapatkan desain dasar dari CSS
        messageDiv.classList.add('message');
        // Menambahkan class sesuai pengirim (user/ai/system) untuk membedakan warna dan posisi
        messageDiv.classList.add(sender);
        
        // --- FORMATTING TEKS ---
        // Membagi teks berdasarkan baris baru (\n) agar format paragraf tetap terjaga
        const formattedText = text.split('\n').map(line => {
            // Jika baris tersebut kosong (hanya spasi), ubah menjadi tag <br> untuk jarak
            if (line.trim() === '') return '<br>'; 
            // Jika ada isinya, bungkus baris tersebut dengan tag paragraf <p>
            return `<p>${line}</p>`; 
        }).join(''); // Gabungkan kembali semua baris menjadi satu string HTML
        
        // Memasukkan string HTML yang sudah diformat ke dalam elemen <div> pesan
        messageDiv.innerHTML = formattedText;
        // Memasukkan elemen pesan baru tersebut ke dalam area chat utama di halaman web
        chatMessages.appendChild(messageDiv);
        
        // OTOMATIS SCROLL: Menghitung posisi paling bawah dari area chat
        // scrollTop adalah posisi scroll saat ini, scrollHeight adalah tinggi total konten
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    /**
     * sendMessage - Fungsi utama untuk memproses dan mengirim pesan pengguna ke server backend.
     */
    async function sendMessage() {
        // Mengambil teks dari kotak input dan menghapus spasi kosong yang tidak perlu
        const text = userInput.value.trim();
        
        // Validasi: Jika kotak input kosong, hentikan fungsi agar tidak mengirim pesan kosong
        if (text === '') return;

        // 1. Panggil fungsi addMessage untuk menampilkan apa yang diketik user ke layar
        addMessage(text, 'user');
        // 2. Kosongkan kembali kotak input supaya user siap mengetik pesan selanjutnya
        userInput.value = '';

        // 3. Masukkan pesan pengguna ke dalam array riwayat percakapan (role: 'user')
        conversationHistory.push({ role: 'user', content: text });

        // 4. Membuat elemen "indikator sedang berpikir" agar user tahu sistem merespon
        const loadingDiv = document.createElement('div');
        // Beri class 'message' dan 'system' agar tampilannya sesuai desain status sistem
        loadingDiv.classList.add('message', 'system');
        // Isi teks indikatornya
        loadingDiv.textContent = 'Komodoc thinking...';
        // Tampilkan indikator tersebut di area chat
        chatMessages.appendChild(loadingDiv);
        // Scroll ke bawah supaya indikator "thinking" terlihat oleh user
        chatMessages.scrollTop = chatMessages.scrollHeight;

        try {
            // 5. Mengirim data riwayat percakapan ke server backend (/chat)
            const response = await fetch('/chat', {
                // Gunakan metode POST karena kita mengirim data (riwayat chat) yang bisa jadi sangat panjang
                method: 'POST', 
                headers: {
                    // Memberi tahu server bahwa kita mengirim data dalam format JSON
                    'Content-Type': 'application/json', 
                },
                // Ubah objek JavaScript (riwayat pesan) menjadi string JSON agar bisa dikirim lewat internet
                body: JSON.stringify({ 
                    messages: conversationHistory
                })
            });
            
            // Periksa apakah koneksi ke server berhasil (status kode 200-299)
            if (!response.ok) {
                // Jika gagal (misal server mati), lempar pesan kesalahan ke blok 'catch'
                throw new Error('Network response was not ok');
            }

            // 6. Menunggu dan mengambil jawaban dari server dalam format JSON
            const data = await response.json();
            
            // 7. Hapus indikator "thinking" dari layar karena jawaban AI sudah tiba
            chatMessages.removeChild(loadingDiv);

            // 8. Logika untuk menampilkan jawaban AI atau pesan kesalahan dari API
            if (data.error) {
                // Jika server mengirimkan info error (misal: API key salah), tampilkan sebagai pesan sistem
                addMessage('Error: ' + data.error, 'system');
            } else {
                // Jika sukses, tampilkan jawaban teks dari AI ke layar user
                addMessage(data.reply, 'ai');
                // Simpan jawaban AI ke riwayat agar AI ingat konteks ini di pesan berikutnya
                conversationHistory.push({ role: 'assistant', content: data.reply });
            }

        } catch (error) {
            // Blok ini berjalan jika terjadi masalah koneksi atau server crash
            console.error('Error:', error); // Catat detail error di console browser untuk admin
            // Pastikan indikator loading dihapus agar tidak macet di layar
            if (chatMessages.contains(loadingDiv)) chatMessages.removeChild(loadingDiv);
            // Beri tahu user dengan bahasa yang ramah bahwa ada masalah teknis
            addMessage('Maaf, terjadi kesalahan. Pastikan server sudah berjalan.', 'system');
        }
    }

    // --- PENGATURAN INTERAKSI (EVENT LISTENERS) ---
    
    // Menjalankan fungsi sendMessage saat tombol "Kirim" diklik oleh mouse
    sendButton.addEventListener('click', sendMessage);

    // Menjalankan fungsi sendMessage saat user menekan tombol "Enter" di keyboard saat fokus di kotak input
    userInput.addEventListener('keypress', (e) => {
        // Cek apakah tombol yang ditekan adalah 'Enter'
        if (e.key === 'Enter') {
            sendMessage(); // Panggil fungsi kirim
        }
    });

    /**
     * FITUR TAMBAHAN: Simpan Chat (Download)
     * Fungsi ini mengubah riwayat chat menjadi file teks yang bisa disimpan user.
     */
    const saveButton = document.getElementById('save-button');
    // Pastikan tombol simpan ada di HTML sebelum memasang fungsi
    if (saveButton) {
        saveButton.addEventListener('click', () => {
            // Membuat template header file teks agar terlihat rapi seperti laporan resmi
            let chatHistory = "==================================================\n";
            chatHistory += "             KOMODOC AI - CHAT HISTORY            \n";
            chatHistory += "==================================================\n";
            // Menambahkan waktu saat ini ke dalam laporan
            chatHistory += `Date: ${new Date().toLocaleString()}\n`;
            chatHistory += "--------------------------------------------------\n\n";

            // Meloop/mengulang setiap pesan yang ada di riwayat (lewati indeks 0 karena itu pesan sistem internal)
            for (let i = 1; i < conversationHistory.length; i++) {
                const msg = conversationHistory[i];
                // Mengubah istilah teknis role menjadi nama yang mudah dipahami manusia
                const role = msg.role === 'user' ? 'YOU' : 'KOMODOC';
                
                // Menuliskan pengirim dan isi pesannya ke dalam string chatHistory
                chatHistory += `[${role}]\n`;
                chatHistory += `${msg.content}\n`;
                chatHistory += "--------------------------------------------------\n\n";
            }
            
            // Menambahkan penutup laporan
            chatHistory += "==================================================\n";
            chatHistory += "End of Transcript\n";
            chatHistory += "==================================================";

            // --- LOGIKA PENGUNDUHAN FILE ---
            // 1. Membuat 'Blob' (Binary Large Object) yang berisi data teks mentah
            const blob = new Blob([chatHistory], { type: 'text/plain' });
            // 2. Membuat URL unik sementara yang mengarah ke data Blob tersebut
            const url = URL.createObjectURL(blob);
            // 3. Membuat elemen link <a> 'palsu' di dalam memori untuk memicu download
            const a = document.createElement('a');
            // Pasang URL data ke link tersebut
            a.href = url;
            
            // 4. Membuat nama file otomatis berdasarkan tanggal dan waktu saat ini (timestamp)
            const now = new Date();
            const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
            a.download = `chat-history-${timestamp}.txt`;
            
            // 5. Masukkan link ke halaman secara singkat, klik otomatis, lalu hapus lagi
            document.body.appendChild(a); // Masukkan ke dokumen
            a.click(); // Klik otomatis (browser akan mulai mendownload)
            document.body.removeChild(a); // Hapus elemen dari dokumen
            URL.revokeObjectURL(url); // Hapus URL sementara dari memori browser agar hemat RAM
        });
    }
});