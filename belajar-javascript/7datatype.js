/* Data Type is 7 in JavaScript
1. Number
2. String
3. Boolean
4. Null
5. Undefined
6. Object
7. Symbol
*/

// --- PENJELASAN MUDAH 7 TIPE DATA JAVASCRIPT ---

// 1. Number (Angka)
// Digunakan untuk semua jenis angka, baik bulat maupun desimal.
// Contoh: 10, -5, 3.14
let umur = 25;           // Angka bulat
let beratBadan = 65.5;   // Angka desimal

// 2. String (Teks)
// Kumpulan huruf atau karakter yang diapit oleh tanda kutip ("" atau '').
// Contoh: "Halo", 'JavaScript'
let nama = "Budi";
let kalimat = 'Saya sedang belajar coding';

// 3. Boolean (Benar/Salah)
// Hanya punya dua nilai: true (benar) atau false (salah). Biasanya untuk logika.
// Contoh: true, false
let apakahLapar = true;
let apakahSudahMakan = false;

// 4. Null (Sengaja Kosong)
// Variabel yang isinya "sengaja" dikosongkan. Bayangkan kotak yang isinya kita buang.
// Contoh: null
let dompet = null; // Dompetnya ada, tapi isinya kosong melompong

// 5. Undefined (Belum Ada Isi)
// Variabel yang sudah dibuat tapi LUPA atau BELUM diisi nilainya.
// Contoh: undefined
let nilaiUjian; // Belum dinilai, jadi isinya undefined

// 6. Object (Kumpulan Data)
// Wadah untuk menyimpan banyak data sekaligus yang saling berhubungan.
// Contoh: { nama: "Ali", umur: 20 }
let siswa = {
    nama: "Siti",
    kelas: 12,
    jurusan: "RPL"
};

// 7. Symbol (Identitas Unik)
// Tipe data baru yang nilainya pasti unik (tidak ada kembarannya). Jarang dipakai pemula.
let idUnik = Symbol("id");
