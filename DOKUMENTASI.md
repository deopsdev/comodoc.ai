# Dokumentasi Proyek: Komodoc AI

Komodoc AI adalah asisten kecerdasan buatan (AI) pribadi yang mengutamakan privasi. Proyek ini dirancang untuk memberikan interaksi yang aman dengan fitur penyensoran data sensitif secara otomatis sebelum data dikirim ke model AI.

## 🛠️ Arsitektur Proyek

Proyek ini dibangun menggunakan arsitektur Client-Server sederhana tanpa dependensi berat (Vanilla JS & Node.js Native).

### 1. Struktur File
- `server.js`: Backend Node.js yang menangani perutean (routing), keamanan (PII filtering), dan komunikasi dengan API Hugging Face.
- `script.js`: Frontend JavaScript yang menangani interaksi pengguna, tampilan chat, dan fitur simpan riwayat.
- `index.html`: Antarmuka pengguna (UI) utama.
- `style.css`: Desain visual dengan tema gelap (Dark Mode) dan aksen neon.
- `tokenizer_helper.js`: Helper untuk menghitung dan membatasi jumlah token agar efisien.

## 🔒 Fitur Keamanan: PII Filtering

Komodoc memiliki lapisan keamanan di `server.js` yang menggunakan Regular Expressions (Regex) untuk mendeteksi dan menyensor informasi sensitif (Personal Identifiable Information) seperti:
- Alamat Email
- Nomor Telepon (Format Indonesia & Internasional)
- Nomor Identitas (NIK/16 digit)
- Nomor Kartu Kredit
- Tanggal Lahir
- Kode Pos

Data tersebut akan diganti dengan label seperti `[EMAIL_REDACTED]` sebelum dikirim ke server AI eksternal.

## 🤖 Model AI

Aplikasi ini menggunakan model **Llama 3.1 8B Instruct** dari Meta yang diakses melalui **Hugging Face Router API**. 

### Identitas AI (System Prompt):
AI diinstruksikan untuk:
1. Menjadi asisten yang ramah dan membantu.
2. Menggunakan Bahasa Indonesia yang jelas.
3. Menghormati privasi pengguna.

## 🚀 Cara Menjalankan Lokal

1. Pastikan Anda memiliki Node.js terinstal (Versi 20 ke atas direkomendasikan).
2. Siapkan `HF_TOKEN` (API Key dari Hugging Face) di environment variables.
3. Jalankan server:
   ```bash
   node server.js
   ```
4. Buka browser dan akses `http://localhost:3030`.

## 💾 Fitur Simpan Chat
Pengguna dapat mengunduh seluruh riwayat percakapan dalam format file `.txt` dengan mengklik tombol ikon unduh di area input. File akan dinamai secara otomatis berdasarkan waktu unduhan.

---
**Dikembangkan oleh:** [Deops Dev](https://deopsdev.github.io)
**Tahun:** 2026
