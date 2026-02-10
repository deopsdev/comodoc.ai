// --- PENJELASAN MUDAH TENTANG VARIABLE (VARIABEL) ---

/*
  BAYANGKAN: Variabel itu seperti "KOTAK" atau "WADAH".
  Kita memberi nama pada kotak itu, lalu kita bisa menyimpan sesuatu di dalamnya.
*/

// Ada 3 cara membuat "kotak" (variabel) di JavaScript:

// 1. var (Cara Lama - Jarang Dipakai)
// Kotak ini agak aneh, isinya bisa bocor keluar. Sebaiknya hindari pakai ini sekarang.
var namaJadul = "Budi (Jadul)";

// 2. let (Cara Modern - Bisa Diubah)
// Ini kotak standar. Isinya BISA diganti-ganti nanti.
// Contoh: Skor game, umur, harga barang.
let skor = 100;
console.log("Skor awal:", skor);

skor = 200; // Mengubah isinya (Update)
console.log("Skor baru:", skor);

// 3. const (Konstanta - TIDAK Bisa Diubah)
// Ini kotak yang dikunci mati. Sekali diisi, TIDAK BISA diganti lagi.
// Contoh: Nilai Pi, Tanggal Lahir, Nama Aplikasi.
const pi = 3.14;
// pi = 3.15; // INI AKAN ERROR! Karena const tidak boleh berubah.

/*
  KESIMPULAN SINGKAT:
  - Mau datanya bisa berubah? Pakai 'let'
  - Mau datanya tetap selamanya? Pakai 'const'
  - Jangan pakai 'var' kecuali terpaksa.
*/

// --- CONTOH "BOCOR" PADA VAR (KENAPA VAR BERBAHAYA) ---

/* 
  Masalah utama 'var' adalah dia tidak peduli dengan kurung kurawal {}. 
  Dia bisa "lompat keluar" dari blok kode (if, for, dll).
  Ini yang disebut "Function Scope" vs "Block Scope".
*/

// CONTOH 1: Bocor dari dalam IF
if (true) {
    var jenisKucing = "Anggora"; // Pakai var
}
console.log(jenisKucing); // HASIL: "Anggora" (Lho? Kok bisa diakses di luar if? Ini bocor!)

if (true) {
    let jenisAnjing = "Bulldog"; // Pakai let
}
// console.log(jenisAnjing); // AKAN ERROR: "jenisAnjing is not defined". (Aman, tidak bocor)


// CONTOH 2: Bocor dari dalam LOOP
for (var i = 0; i < 5; i++) {
    // Lakukan sesuatu 5 kali
}
console.log("Nilai i sekarang:", i); // HASIL: 5 (Variabel 'i' masih hidup di luar loop! Bahaya jika kita pakai 'i' lagi)

for (let j = 0; j < 5; j++) {
    // Lakukan sesuatu 5 kali
}
// console.log(j); // AKAN ERROR: "j is not defined". (Aman, 'j' mati setelah loop selesai)
