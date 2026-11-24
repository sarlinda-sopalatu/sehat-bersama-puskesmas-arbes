# SCRUM Documentation — Sehat Bersama - Puskesmas Arbes

## Project Information
- **Project Name**: Sehat Bersama - Puskesmas Arbes — Sistem Informasi Manajemen Puskesmas
- **App Version**: v1.0.0
- **Sprint**: Sprint 4
- **Tim Development**: Front-end only (plain HTML/CSS/JS, no external libraries)
- **Deployment**: Static SPA persisted via localStorage, no server-backed data

## Sprint Goals (Sprint 4)
Membangun seluruh modul aplikasi Sehat Bersama - Puskesmas Arbes dari awal hingga uji end-to-end dengan 6 peran pengguna, meliputi:
- Autentikasi & pengelolaan pengguna
- Pendaftaran dan antrean pasien
- Rekam medis elektronik (EMR) dokter
- Farmasi & obat
- Pembayaran & tarif
- Laporan & analitik
- Display antrean publik

## User Stories per Modul

### 1. Autentikasi & Pengguna (US-001 to US-010)
- [US-001] Login/logout dengan role-based access control
- [US-002] Password reset dengan verifikasi nomor telepon
- [US-003] Change password mandiri (current password → new password → confirmation)
- [US-004] Update profil pengguna (nama, nomor telepon)
- [US-005] Admin dapat membuat pengguna baru (create user)
- [US-006] Admin dapat mengubah data pengguna (update user)
- [US-007] Admin dapat mengaktifkan/menonaktifkan akun (toggle user)
- [US-008] Admin dapat mereset password pengguna
- [US-009] Admin dapat mengatur hak akses modul per role (access matrix)
- [US-010] Admin dapat mengidentitas dan pengaturan klinik (clinic settings)

### 2. Pendaftaran Pasien (US-011 to US-018)
- [US-011] Petugas pendaftaran dapat mendaftarkan pasien baru
- [US-012] Validasi NIK (16 digit angka) dan BPJS (13 digit angka)
- [US-013] Cari pasien berdasarkan RM, NIK, atau nama
- [US-014] Lihat riwayat kunjungan pasien lengkap
- [US-015] Cetak kartu pasien dengan barcode
- [US-016] Edit data pasien (nama, alamat, telepon, BPJS)
- [US-017] Nonaktifkan/aktifkan akun pasien (admin only)
- [US-018] Export data pasien ke CSV

### 3. Antrean Pasien (US-019 to US-028)
- [US-019] Daftarkan antrean baru per poli dengan nomor antrean
- [US-020] Priority queue untuk: Lansia (≥60 tahun), Ibu hamil, Disabilitas, Anak balita, Kondisi darurat, Rujukan cepat
- [US-021] Panggil antrean berikutnya (dokter/perawat)
- [US-022] Status antrean: Menunggu → Dipanggil → Dilayani → Selesai → Dibatalkan
- [US-023] Tunggu estimasi waktu antrean berdasarkan antrean yang menumpuk
- [US-024] Batal antrean dengan alasan
- [US-025] Public display antrean tanpa login (#/display)
- [US-025] Speech/text announcement untuk panggilan antrean
- [US-027] Cleanup event listeners dan interval saat meninggalkan #/display

### 4. Rekam Medis Elektronik (US-029 to US-040)
- [US-029] Dokter memulai pemeriksaan dari antrean
- [US-030] Catat tanda vital nurse (tekanan darah, nadi, suhu, respirasi, BB, TB, SpO2)
- [US-031] Masukkan keluhan pasien dan diagnosis ICD-10
- [US-032] Catat tindakan fisik selama pemeriksaan
- [US-033] Susun resep elektronik dengan obat, jumlah, aturan pakai
- [US-034] Sediakan kontrol ulang (14 hari untuk hipertensi/diabetes)
- [US-035] Selesaikan pemeriksaan dan buat tagihan otomatis
- [US-036] Cetak rekam medis lengkap dengan resep dan tanda tangan
- [US-037] Resep status: menunggu farmasi → diserahkan
- [US-038] Referensi ke RS lain jika perlu
- [US-039] Edit draf pemeriksaan sebelum diselesaikan
- [US-040] Nonaktifkan pemeriksaan yang sudah selesai (tidak dapat diubah)

### 5. Farmasi & Obat (US-041 to US-052)
- [US-041] Master obat: nama, kategori, satuan, harga, stok, minimum, masa kadaluwarsa
- [US-042] Penerimaan stok obat dari distributor (mutasi masuk)
- [US-043] Pengeluaran obat berdasarkan resep (mutasi keluar)
- [US-044] Alert stok menipis (stok ≤ minimum) dan stok habis (stok = 0)
- [US-045] Alert obat akan kedaluwarsa (60 hari ke depan) dan sudah kedaluwarsa
- [US-046] Resep menunggu diserahkan ke farmasi
- [US-047] Lihat riwayat mutasi stok lengkap (siapa, kapan, berapa banyak)
- [US-048] Dispense resep: kurangi stok, buat mutasi, tandai resep diserahkan
- [US-049] Pending prescriptions count untuk dashboard
- [US-050] Laporan penggunaan obat per periode
- [US-051] Cetak laporan farmasi dengan tanda tangan petugas
- [US-052] Reset stok awal untuk testing (admin only)

### 6. Pembayaran & Tarif (US-053 to US-062)
- [US-053] Kelola tarif layanan (konsultasi, tindakan, administrasi)
- [US-054] Verifikasi penjaminan BPJS (cek nomor kartu SEP)
- [US-055] Terima pembayaran: Tunai, QRIS, Transfer Bank, Kartu Debit
- [US-056] Cetak kuitansi/resep digital terformat
- [US-057] Tagihan manual untuk pasien tanpa pemeriksaan
- [US-058] Riwayat transaksi lengkap per pasien (RM no)
- [US-059] Filter tagihan: Belum dibayar, Lunas, Ditanggung BPJS
- [US-060] Export riwayat transaksi ke CSV
- [US-061] Verifikasi BPJS status: belum diverifikasi → diverifikasi
- [US-062] Set status tagihan: Belum → Dibayar → Ditanggung BPJS

### 7. Laporan & Analitik (US-063 to US-072)
- [US-063] 6 tab laporan: Ringkasan, Kunjungan, Poli, Penyakit, Obat, Petugas
- [US-064] Filter per tanggal (range picker), poli, status kunjungan
- [US-065] Ringkasan KPI: kunjungan hari ini, pendapatan, resep menunggu, stok masalah
- [US-066] Laporan kunjungan per poli dengan grafik donut
- [US-067] Laporan penyakit & diagnosis ICD-10 frekuensi
- [US-068] Laporan obat terpakai dan stok terkini
- [US-069] Laporan kinerja petugas (audit log aktivitas)
- [US-070] Export laporan ke file CSV
- [US-071] Cetak laporan terformat dengan header puskesmas dan tanda tangan
- [US-072] Filter data historis: 30 hari terakhir + hari ini

### 8. Display Antrean Publik (US-073 to US-078)
- [US-073] Layar antrean tanpa autentikasi (buka dari #/display)
- [US-074] Menampilkan nomor antrean yang sedang dipanggil
- [US-075] Menampilkan antrean berikutnya per poli
- [US-076] Menampilkan motto puskesmas dan informasi pelayanan
- [US-077] Indikator waktu dipanggil (waktu tetep atau hidup)
- [US-078] Tombol fullscreen dan kembali ke aplikasi

## Definition of Done per Story
- [x] Kode JavaScript valid (node --check lulus)
- [x] HTML valid, CSS responsive di browser modern
- [x] UI sesuai warna palette: deep teal/mint/coral, rounded cards
- [x] Role-based access control bekerja dengan benar
- [x] Persistensi data di localStorage bekerja
- [x] Print styles bekerja untuk cetak rekam medis, kuitansi, laporan
- [x] CSV export menghasilkan file yang bisa dibuka Excel
- [x] Akses publik #/display tanpa login
- [x] Demo accounts work: admin/admin123, pendaftaran/123456, dll.

## Risiko & Mitigasi
| Risiko | Mitigasi |
|--------|----------|
| localStorage penuh pada browser lama | Clear data rutin, warn pengguna jika > 5MB |
| Browser tidak mendukung color-mix() | Fallback warna statis, test di Chrome/Firefox/Edge modern |
| Hash router konflik dengan server | Hanya client-side routing, #/ prefix selalu |
| Persistence hilang saat clear cache | Dokumentasikan cara restore, bump seed version jika perlu |
| Dashboard trend label tidak akurat | Fix perhitungan hari (-13 ke -7 untuk 7 hari lengkap) |

## Catatan Teknis
- Semua modul mendaftar ke `NS.pages` dengan signature: `.render(root)` atau `{render, create, edit, detail, ...}`
- Hash router: `#/dashboard`, `#/pasien`, `#/pemeriksaan/:id`, `#/farmasi/resep`, dll.
- Simpan versi seed: `puskesmas-arbes.db.v1`, `SEED_VERSION = 1`
- Jika schema berubah: clear localStorage atau increment SEED_VERSION
- 6 peran: admin, pendaftaran, dokter, perawat, farmasi, kasir
- Demo accounts: admin/admin123, pendaftaran/123456, dokter/123456, perawat/123456, farmasi/123456, kasir/123456
- Extras: dokter.gigi/123456 (poli gigi), pendaftaran2/123456 (non-aktif)
- Seed data: 30 historical days + hari ini
- Versi: APP_VERSION = 1.0.0, SPRINT = Sprint 4

## Sprint Retrospective
- Completed: Semua modul inti berfungsi, syntax validasi lulus, auth guards bekerja
- In Progress: Browser-test end-to-end untuk 6 peran, print styles finalisasi
- Blocked: Demo browser testing (masih menunggu setup)
- Action Items: Fix dashboard trend label, tambah dokumentasi per-module, testing di berbagai device

---
*Document generated for Sprint 4 Sehat Bersama - Puskesmas Arbes development.*