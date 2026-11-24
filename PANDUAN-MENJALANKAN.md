# Sehat Bersama - Puskesmas Arbes

Versi 4.0 (Python) — Website demonstrasi lokal, tema biru neumorphism dan Firebase Authentication.

Backend sudah ditulis ulang dalam Python; HTML, CSS, dan JavaScript browser tetap digunakan untuk mempertahankan seluruh tampilan dan modul asli. Tidak ada Node.js di versi ini.

## 1. Cara menjalankan di Windows / Visual Studio Code

1. Ekstrak ZIP. Buka folder `sehat-bersama-puskesmas-arbes` dengan VS Code (File > Open Folder).
2. Pilih Terminal > New Terminal (PowerShell). Pastikan terminal berada di folder yang berisi `app.py`.
3. Jalankan `python --version` atau `py --version`. Gunakan Python 3.11 atau lebih baru. Jika belum tersedia, unduh dari https://www.python.org/downloads/windows/ dan centang Add python.exe to PATH saat instalasi. Buka kembali VS Code. Tidak perlu Node.js, npm, pip install, Flask, Django, PHP, XAMPP, Live Server, Firebase CLI, atau hosting aplikasi.
4. Jalankan `Copy-Item .env.example .env` (hanya pertama kali; jangan menimpa konfigurasi lama). Buka `.env` di VS Code dan simpan setelah mengisi konfigurasi pada bagian 2.
5. Jalankan `python app.py` (atau `py app.py` jika perintah python tidak tersedia). Buka `http://127.0.0.1:4173` di browser. Jangan membuka index.html langsung. Biarkan terminal hidup. Ctrl+C untuk berhenti; jalankan ulang server setelah mengubah .env.

Akun demonstrasi bisa langsung digunakan tanpa konfigurasi Firebase. Internet dibutuhkan untuk daftar, login, dan reset akun Firebase.

## 2. Konfigurasi Firebase Authentication

1. Buka https://console.firebase.google.com/ dan pilih proyek Firebase Anda (boleh menggunakan proyek puskesmas-arbes yang sudah ada, atau buat proyek baru).
2. Build > Authentication > Get started jika belum diaktifkan.
3. Sign-in method > Email/Password > Enable > Save. Tidak perlu mengaktifkan Email link (passwordless).
4. Project settings (ikon roda gigi) > General > Web API Key. Jika belum ada, daftarkan aplikasi Web (ikon </>) tanpa memilih Firebase Hosting. Salin Web API Key.
5. Pada `.env`, ganti nilai FIREBASE_API_KEY dengan Web API Key proyek Anda. Contoh:

```env
FIREBASE_API_KEY=ISI_API_KEY_FIREBASE_ANDA
STAFF_REGISTRATION_CODE=GANTI_DENGAN_KODE_PETUGAS_YANG_RAHASIA
ADMIN_REGISTRATION_CODE=GANTI_DENGAN_KODE_ADMIN_YANG_BERBEDA
PORT=4173
```

Buat kode undangan sendiri yang berbeda, acak, minimal 12 karakter. Kosongkan jika pendaftaran peran itu harus dinonaktifkan. Administrator harus memegang kode admin; jangan membagikannya pada pasien. Untuk membuat kode acak melalui terminal PowerShell, jalankan dua kali: `python -c "import secrets; print(secrets.token_hex(24))"`. Jangan membagikan `.env` atau mengunggahnya ke GitHub.

6. Authentication > Templates > Password reset: gunakan template dan URL tindakan default Firebase. Anda dapat mengubah nama pengirim sesuai fasilitas konsol. Tidak perlu custom action handler, SMTP, App Password Gmail, hosting website, Cloud Functions, atau Firestore untuk fitur ini. Jangan memasukkan URL localhost sebagai URL tindakan di template. Firebase mengirim email dan menyediakan halaman tindakan bawaannya. Jika memakai proyek lama dengan custom action URL yang tidak lagi berfungsi, kembalikan ke default.
7. Restart server. Status "API key tersedia" berarti konfigurasi terisi, bukan bukti koneksi berhasil.

## 3. Uji pendaftaran dan reset password

1. Buka halaman login, klik Daftar akun baru.
2. Pilih Pasien, isi nama, username unik (huruf kecil/angka/titik/_/-), email aktif yang Anda miliki, nomor HP, password minimal 8 karakter, konfirmasi password.
3. Klik Daftar akun. Cek Firebase Console > Authentication > Users: email baru seharusnya terlihat. Masuk dengan username atau email dan password tersebut. Keluar.
4. Klik Lupa password? Masukkan username atau email yang tadi didaftarkan. Klik Kirim tautan reset.
5. Periksa Inbox, Spam, dan Promotions. Buka email Firebase. Klik link, isi password baru pada halaman Firebase dan simpan.
6. Kembali ke http://127.0.0.1:4173/#/login. Masuk menggunakan password baru. Password lama seharusnya ditolak.

Firebase mengirim **tautan**, bukan OTP 6 digit. Respons permintaan reset bersifat umum untuk mengurangi pengungkapan akun. Email belum tentu sampai ke Inbox meskipun API menerima permintaan; periksa alamat, filter email, konfigurasi dan kuota Firebase. Gunakan email yang benar-benar Anda kuasai. Tidak perlu mengatur email penerima di .env: penerima adalah email akun yang didaftarkan. Akun Firebase yang telah dibuat di luar aplikasi tidak otomatis memiliki profil lokal; gunakan email baru atau hubungi pengelola untuk migrasi profil.

## 4. Pilihan daftar sebagai

- Pasien: daftar mandiri, portal profil pasien, antrean dan riwayat simulasi.
- Petugas pendaftaran, dokter, perawat, farmasi, kasir: kode undangan petugas; dokter memilih poli.
- Administrator: kode undangan administrator tersendiri.

Akun demo (accordion, klik untuk membuka dan klik akun untuk mengisi form): admin/admin123, pendaftaran/123456, dokter/123456, perawat/123456, farmasi/123456, kasir/123456. Akun demo hanya simulasi lokal, tidak terhubung ke email Firebase, dan tidak dapat membuat/mengubah akun Firebase. Buat administrator Firebase dengan kode admin untuk mengelola akun terdaftar. Admin dapat mengirim reset email, mengubah profil lokal/peran, dan menonaktifkan akses lokal. Email Firebase tidak dapat diganti dari tabel admin; reset password lewat email. Perubahan status lokal tidak menghapus/menonaktifkan akun pada Firebase Console.

## 5. Arsitektur dan keterbatasan

- HTML/CSS/JavaScript: tampilan responsif biru, card timbul, input cekung, sidebar, dashboard, modul asli.
- `app.py`: server HTTP Python dengan library standar (tanpa dependensi pip), memanggil Identity Toolkit REST API Firebase menggunakan HTTPS; cookie sesi HttpOnly lokal; validasi kode undangan di server.
- Firebase Authentication: penyimpanan kredensial akun terdaftar, login dan pengiriman link reset.
- `server-data/firebase-profiles.json`: metadata akun, username, peran dan UID Firebase secara lokal. Jangan hapus file ini bila ingin mempertahankan akun lokal. Password akun Firebase tidak disimpan di file ini. Demo memiliki hash lokal; kredensial demo memang diketahui publik.
- Data klinis asli masih localStorage browser untuk simulasi. Bukan database Firebase/Firestore, tidak tersinkron antar perangkat, dapat diubah dari developer tools, dan belum memenuhi keamanan sistem rekam medis produksi. Jangan masukkan NIK, rekam medis, data pasien atau identitas nyata. Gunakan data fiktif dan email pengujian sendiri. Jangan membuka server ke internet atau jaringan publik.
- Sesi lokal berakhir setelah restart server atau maksimal 12 jam. Reset pada Firebase mengganti kredensial Firebase; sesi lokal yang sudah terbuka harus ditutup/logout dan tidak otomatis dicabut oleh Firebase. Perubahan password dari menu profil mencabut sesi lokal.
- Ini versi demonstrasi; untuk produksi perlu backend data klinis yang terlindungi, audit, kontrol akses server, verifikasi email, manajemen token, kebijakan privasi, dan peninjauan keamanan.

## 6. Troubleshooting

- `python is not recognized`: instal Python dan aktifkan PATH, atau coba `py app.py`. Buka ulang VS Code setelah instalasi.
- `can't open file ...app.py`: buka folder proyek yang benar (`Get-ChildItem` untuk melihat file).
- `Address already in use` / `WinError 10048`: hentikan server lama atau ganti PORT pada .env (misal 4174), restart, dan gunakan alamat port yang sesuai.
- Firebase belum dikonfigurasi: cek file bernama tepat `.env` (bukan `.env.txt`), API key, dan restart server.
- Operation not allowed: aktifkan Email/Password di konsol.
- API key invalid: salin Web API Key dari proyek yang benar; pastikan pembatasan API key mengizinkan Identity Toolkit API.
- Email tidak masuk: cek akun pada Firebase > Users, template tindakan default, Inbox/Spam, alamat benar dan kuota pengiriman. Tunggu sebentar sebelum meminta ulang; aplikasi membatasi pengiriman 3 kali per akun setiap 15 menit.
- Jika akun demo tidak dapat reset, itu memang desain sistem; gunakan akun Firebase terdaftar.

Dokumentasi Firebase resmi: https://firebase.google.com/docs/reference/rest/auth dan https://firebase.google.com/docs/auth/web/password-auth?hl=id
