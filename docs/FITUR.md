# PEMETAAN FITUR — PUSKESMAS ARBES

Dokumen ini memetakan seluruh fitur yang diminta/dikembangkan pada proyek **Sehat Bersama - Puskesmas Arbes**
dengan lokasi implementasi di dalam aplikasi (modul, halaman, dan perilaku).

Aplikasi: **Sehat Bersama - Puskesmas Arbes — Sistem Informasi Manajemen Puskesmas**
Stack: **HTML5 + CSS3 + Vanilla JavaScript (ES6+)**, hash routing, localStorage.

---

## 1. Pengguna Sistem (2.1)

| Fitur | Implementasi |
|-------|--------------|
| Login | `js/app.js` → render auth (`#/login`, `#/lupa-password`, `#/reset-password`) |
| Logout | `js/app.js` → topbar/user menu (`logoutBtn`) |
| Manajemen pengguna (tambah, ubah, nonaktifkan akun) | `js/users.js` → modul Pengguna & Hak Akses (`#/pengguna`) |
| Hak akses | `js/users.js` → Matriks Hak Akses (`#/pengguna/akses`) |
| Reset password | `js/users.js` (admin) + `js/app.js` (mandiri via `resetPasswordWithPhone`) |

- **Halaman**: `#/dashboard`, `#/pengguna`, `#/pengguna/akses`, `#/pengaturan`, `#/profil`
- **Peran**: admin, petugas pendaftaran, dokter, perawat, petugas farmasi, petugas kasir (+ dokter gigi)

---

## 2. Modul Pendaftaran Pasien (4.1 – 4.8)

| Fitur | Implementasi |
|-------|--------------|
| Registrasi pasien baru | `js/patients.js` → `createPatient`, validasi NIK 16 digit + BPJS 13 digit |
| Pencarian pasien | `js/patients.js` → daftar/search pasien (RM, NIK, nama) |
| Edit data pasien | `js/patients.js` → `updatePatient` (`#/pasien/:id/edit`) |
| Nomor rekam medis | `js/data.js` → `nextRM()` menghasilkan `RM-<tahun>-<nomor>` |
| Data pasien lama | `js/patients.js` → `patients()` + riwayat kunjungan (`patientVisits`) |
| Validasi NIK | `js/data.js` → `validatePatient` |
| Riwayat kunjungan | `js/patients.js` → riwayat per pasien + detail pemeriksaan/tagihan |
| Cetak kartu pasien | `js/patients.js` / `js/ui.js` → cetak via UI print area |

- **Halaman**: `#/pasien`, `#/pasien/baru`, `#/pasien/:id`, `#/pasien/:id/edit`
- **Data input**: NIK, Nama Lengkap, Tempat Lahir, Tanggal Lahir, Jenis Kelamin, Alamat, No. Telepon, Jenis Kepersertaan (BPJS/Umum), No. BPJS, Kontak Keluarga.

---

## 3. Modul Antrean Pasien (5.1 – 5.8)

| Fitur | Implementasi |
|-------|--------------|
| Nomor antrean otomatis | `js/data.js` → `nextQueueNumberFor` (kode `U-001`, `G-001`, …) |
| Pilih poli umum | `js/data.js` → `POLI` (Umum, Gigi, KIA, Lansia, Gizi) |
| Antrean prioritas | `js/data.js` → `createQueue(..., prioritas, alasanPrioritas)` |
| Panggilan antrean | `js/data.js` → `callNextQueue` |
| Status antrean | `js/data.js` → `updateQueueStatus` (Menunggu → Dipanggil → Dilayani → Selesai → Dibatalkan) |
| Display antrean | `js/queues.js` → `render` display publik (`#/display`) |
| Estimasi waktu | `js/data.js` → `waitingEstimate` |
| Pembatalan antrean | `js/data.js` → `cancelQueue` |

- **Halaman**: `#/antrean`, `#/display`

---

## 4. Modul Pemeriksaan Dokter / EMR (6.1 – 6.9)

| Fitur | Implementasi |
|-------|--------------|
| Daftar Pasien Poli | `js/exams.js` → daftar pemeriksaan per poli |
| Rekam Medis Elektronik | `js/exams.js` → `startExam`, `saveExamDraft`, `saveVitals`, `completeExam` |
| Input Keluhan | `js/exams.js` → field `keluhan` |
| Pemeriksaan Fisik | `js/exams.js` → `pemeriksaanFisik` (tekananDarah, nadi, suhu, respirasi, BB, TB, SpO2, catatanFisik) |
| Diagnosis | `js/exams.js` → `diagnosis`, `kodeICD10`, `diagnosisSekunder` |
| Tindakan Medis | `js/exams.js` → `tindakan` |
| Catatan Dokter | `js/exams.js` → `catatanDokter` |
| Rujukan | `js/exams.js` → `rujukan` |
| Kontrol Ulang | `js/exams.js` → `kontrolUlang` |

- **Halaman**: `#/pemeriksaan`, `#/pemeriksaan/:id`

---

## 5. Modul Farmasi dan Obat (7.1 – 7.9)

| Fitur | Implementasi |
|-------|--------------|
| Data Obat | `js/data.js` → `medicines`, `saveMedicine` |
| Stok Obat | `js/data.js` → `stok`, `stockAlerts` |
| Penerimaan Obat | `js/data.js` → `addStock` (mutasi masuk) |
| Pengeluaran Obat | `js/data.js` → `removeStock` (mutasi keluar) |
| Resep Elektronik | `js/data.js` → `normalizePrescription`, `pendingPrescriptions` |
| Penyeran Obat | `js/data.js` → `dispensePrescription` (validasi stok + kedaluwarsa) |
| Peringatan Stok Minimum | `js/data.js` → `stockAlerts` (low / out) |
| Kadaluarsa Obat | `js/data.js` → `stockAlerts` (expired / expiring) |
| Laporan Penggunaan Obat | `js/pharmacy.js`, `js/reports.js` |

- **Halaman**: `#/farmasi`, `#/farmasi/resep`, `#/farmasi/obat`, `#/farmasi/stok`, `#/farmasi/laporan`

---

## 6. Modul Pembayaran dan Administrasi (8.1 – 8.7)

| Fitur | Implementasi |
|-------|--------------|
| Data Tarif Layanan | `js/data.js` → `tariffs`, `saveTariff` |
| Verifikasi Kesehatan / BPJS | `js/data.js` → `verifyBill` (noSEP, status terverifikasi) |
| Tagihan | `js/data.js` → `createBillForExam`, `createManualBill`, `addBillItem` |
| Pembayaran | `js/data.js` → `payBill` (Tunai, QRIS, Transfer Bank, Kartu Debit) |
| Cetak Buku/Bukti Pembayaran | `js/billing.js` → print area / kuitansi |
| Riwayat Transaksi | `js/billing.js` → `bills()`, transaksi per pasien |

- **Halaman**: `#/pembayaran`, `#/pembayaran/tarif`, `#/pembayaran/transaksi`, `#/pembayaran/:id`

---

## 7. Modul Laporan (9.1 – 9.7)

| Fitur | Implementasi |
|-------|--------------|
| Laporan Kunjungan | `js/reports.js` → tab `kunjungan` |
| Laporan Per Poli | `js/reports.js` → tab `poli` |
| Laporan Penyakit | `js/reports.js` → tab `penyakit` (ICD-10) |
| Laporan Obat | `js/reports.js` → tab `obat` |
| Laporan Petugas | `js/reports.js` → tab `petugas` (audit log) |
| Dashboard | `js/dashboard.js` → ringkasan KPI |
| Export Laporan | `js/reports.js` → CSV download |

- **Halaman**: `#/laporan`

---

## 8. Ringkasan Alur Fitur → Halaman

| No | Fitur Utama | Halaman Aplikasi | Modul JS |
|----|-------------|-------------------|----------|
| 1 | Dashboard | `#/dashboard` | `js/dashboard.js` |
| 2 | Pendaftaran Pasien | `#/pasien`, `#/pasien/baru`, `#/pasien/:id`, `#/pasien/:id/edit` | `js/patients.js` |
| 3 | Antrean Pasien | `#/antrean`, `#/display` | `js/queues.js` |
| 4 | Pemeriksaan Dokter / EMR | `#/pemeriksaan`, `#/pemeriksaan/:id` | `js/exams.js` |
| 5 | Farmasi & Obat | `#/farmasi`, `#/farmasi/resep`, `#/farmasi/obat`, `#/farmasi/stok`, `#/farmasi/laporan` | `js/pharmacy.js` |
| 6 | Pembayaran & Tarif | `#/pembayaran`, `#/pembayaran/tarif`, `#/pembayaran/transaksi`, `#/pembayaran/:id` | `js/billing.js` |
| 7 | Laporan | `#/laporan` | `js/reports.js` |
| 8 | Pengguna & Hak Akses | `#/pengguna`, `#/pengguna/akses`, `#/pengaturan`, `#/profil` | `js/users.js` |
| 9 | Tampilan Antrean Publik | `#/display` | `js/queues.js` |

---

*Dokumen ini dibuat untuk proyek Sehat Bersama - Puskesmas Arbes — Sistem Informasi Manajemen Puskesmas (HTML/CSS/JS + Scrum).*
