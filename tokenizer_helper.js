/**
 * tokenizer_helper.js - Utilitas untuk mengelola token pesan (Conversation History Management).
 * Kecerdasan Buatan (AI) memiliki batasan jumlah teks yang bisa dipahami dalam satu waktu (Context Window).
 * File ini berfungsi untuk menghitung perkiraan "Token" (satuan unit teks AI) agar memori AI tidak meluap.
 */

/**
 * approxTokenCount - Menghitung perkiraan jumlah token dari sebuah teks mentah.
 * Rumus Standar Industri: 1 token rata-rata setara dengan 4 karakter teks bahasa Inggris.
 * @param {string} text - Teks yang ingin dihitung jumlah tokennya.
 * @returns {number} - Angka hasil perkiraan jumlah token.
 */
function approxTokenCount(text) {
  // Validasi: Jika teks tidak ada (null/undefined), maka jumlah tokennya adalah 0.
  if (!text) return 0; 
  // Menghitung panjang teks, dibagi 4, lalu dibulatkan ke atas (Math.ceil).
  // Math.max(1, ...) memastikan minimal ada 1 token jika teks tidak kosong.
  return Math.max(1, Math.ceil(text.length / 4)); 
}

/**
 * countMessageTokens - Menghitung jumlah token untuk satu buah objek pesan tunggal.
 * Setiap pesan dalam chat memiliki format { role: 'user/ai', content: 'teks' }.
 * @param {object} message - Objek pesan yang ingin dihitung.
 * @returns {number} - Total token termasuk biaya tambahan (overhead) untuk role.
 */
function countMessageTokens(message) {
  // roleOverhead: Biaya tambahan token (biasanya 3) untuk menyimpan informasi pengirim (role).
  // Ini diperlukan karena AI butuh sedikit memori untuk tahu siapa yang bicara.
  const roleOverhead = 3; 

  // Mengambil isi teks dari pesan tersebut.
  const content = message.content; 
  // Jika konten kosong, kita hanya mengembalikan biaya overhead-nya saja.
  if (!content) return roleOverhead; 

  // LOGIKA KHUSUS: Jika konten berupa Array (biasanya digunakan untuk Multi-modal: Teks + Gambar).
  if (Array.isArray(content)) {
    // Mulai perhitungan dari biaya overhead role.
    let total = roleOverhead; 
    // Mengulang (looping) setiap bagian yang ada di dalam array konten tersebut.
    for (const part of content) { 
      // Jika bagian ini kosong, abaikan dan lanjut ke bagian berikutnya.
      if (!part) continue; 
      
      // Jika bagian ini adalah teks murni ({ type: 'text', text: '...' }).
      if (part.type === 'text' && typeof part.text === 'string') {
        // Hitung token dari teks tersebut dan tambahkan ke total.
        total += approxTokenCount(part.text); 
      } 
      // Jika bagian ini adalah data non-teks (gambar atau suara).
      else if (part.type === 'image_url' || part.type === 'audio' || part.type === 'image') {
        // Berikan biaya tetap (3 token) sebagai penanda keberadaan data non-teks.
        total += 3; 
      } 
      // Jika bagian ini langsung berupa string mentah (bukan objek).
      else if (typeof part === 'string') {
        // Langsung hitung token dari string tersebut.
        total += approxTokenCount(part); 
      }
    }
    // Mengembalikan hasil total token dari seluruh bagian array.
    return total; 
  }

  // LOGIKA UMUM: Jika konten adalah string biasa (paling sering digunakan dalam chat teks).
  // Total = Biaya Role + Perkiraan Token dari Teks Konten.
  return roleOverhead + approxTokenCount(String(content));
}

/**
 * countMessagesTokens - Menghitung total seluruh token dari daftar riwayat percakapan.
 * @param {Array} messages - Kumpulan pesan (array of objects).
 * @returns {number} - Jumlah total token dari semua pesan yang ada.
 */
function countMessagesTokens(messages) {
  // Jika input bukan array yang valid, kembalikan 0.
  if (!Array.isArray(messages)) return 0; 
  // Gunakan fungsi reduce untuk menjumlahkan token dari setiap pesan satu per satu.
  return messages.reduce((sum, m) => sum + countMessageTokens(m), 0);
}

/**
 * truncateMessagesToTokenLimit - Memotong riwayat chat agar tidak melebihi batas memori AI.
 * Strategi: Menghapus pesan lama (tengah) tapi tetap menyimpan instruksi utama (system prompt) 
 * dan pesan-pesan yang paling baru dikirim.
 * @param {Array} messages - Riwayat percakapan lengkap yang ingin diperpendek.
 * @param {number} maxTokens - Batas maksimal token yang diizinkan oleh sistem.
 * @returns {Array} - Riwayat percakapan baru yang sudah dipangkas agar muat di memori AI.
 */
function truncateMessagesToTokenLimit(messages, maxTokens) {
  // Jika input bukan array, kembalikan saja apa adanya tanpa perubahan.
  if (!Array.isArray(messages)) return messages; 

  // 1. Mencari pesan 'system' (biasanya instruksi awal seperti "Kamu adalah asisten pintar").
  // Pesan ini SANGAT PENTING dan tidak boleh dibuang agar AI tetap tahu tugasnya.
  const sysMsg = messages.find(m => m.role === 'system');
  
  // 2. Mengambil semua pesan SELAIN pesan system untuk diproses pemotongannya.
  const others = messages.filter(m => m.role !== 'system');

  // 3. Membalikkan urutan pesan (dari yang paling baru/bawah ke yang paling lama/atas).
  // Kita ingin memprioritaskan pesan terbaru agar percakapan tetap nyambung.
  const reversed = [...others].reverse();
  
  // Array untuk menampung pesan-pesan yang berhasil "lolos" seleksi limit.
  const kept = []; 
  
  // Menghitung total token awal (mulai dari token pesan system jika pesan tersebut ada).
  let total = sysMsg ? countMessageTokens(sysMsg) : 0;

  // 4. Melakukan pengecekan satu per satu dari pesan paling baru.
  for (const msg of reversed) {
    // Hitung berapa token yang dibutuhkan oleh pesan saat ini.
    const t = countMessageTokens(msg); 
    
    // CEK LIMIT: Jika total token + pesan ini sudah melebihi batas (maxTokens).
    // Maka kita berhenti mengambil pesan lagi (pesan yang lebih lama akan dibuang).
    if (total + t > maxTokens) break;
    
    // Jika masih muat, masukkan pesan ini ke daftar yang disimpan (kept).
    kept.push(msg); 
    // Tambahkan jumlah token pesan ini ke total akumulasi.
    total += t; 
  }

  // 5. Menyusun kembali hasil akhir percakapan.
  const result = []; 
  // Masukkan kembali pesan system di posisi paling atas (indeks 0).
  if (sysMsg) result.push(sysMsg); 
  
  // Gabungkan dengan pesan-pesan yang disimpan, tapi urutannya dibalikkan lagi ke semula.
  // kept.reverse() mengembalikan urutan dari lama ke baru agar AI membacanya secara kronologis.
  return result.concat(kept.reverse());
}

/**
 * EKSPOR MODUL: Agar fungsi-fungsi di atas bisa digunakan di file lain (seperti server.js).
 */
module.exports = {
  // Fungsi hitung token dasar.
  approxTokenCount,
  // Fungsi hitung total token dari riwayat chat.
  countMessagesTokens,
  // Fungsi pintar untuk memotong chat agar hemat memori.
  truncateMessagesToTokenLimit
};
