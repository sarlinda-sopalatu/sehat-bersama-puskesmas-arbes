/* ==========================================================================
   Sehat Bersama - Puskesmas Arbes — Lapisan data & aturan bisnis
   Semua data disimpan di localStorage agar aplikasi dapat berjalan tanpa server.
   ========================================================================== */
(function (window) {
  'use strict';

  const NS = (window.PK = window.PK || {});
  const DB_KEY = 'sehat-bersama.db.v3';
  const SESSION_KEY = 'sehat-bersama.session.v3';
  const SEED_VERSION = 1;
  const APP_VERSION = '3.0.0';
  const SPRINT = 'Sprint 4';

  const POLI = [
    { id: 'umum', nama: 'Poli Umum', singkat: 'Umum', kode: 'U', warna: '#0f766e', ikon: 'stethoscope' },
    { id: 'gigi', nama: 'Poli Gigi', singkat: 'Gigi', kode: 'G', warna: '#246b97', ikon: 'tooth' },
    { id: 'kia', nama: 'Poli KIA', singkat: 'KIA', kode: 'K', warna: '#b4537a', ikon: 'baby' },
    { id: 'lansia', nama: 'Poli Lansia', singkat: 'Lansia', kode: 'L', warna: '#9a6700', ikon: 'heart' },
    { id: 'gizi', nama: 'Poli Gizi', singkat: 'Gizi', kode: 'Z', warna: '#6d5aa8', ikon: 'apple' }
  ];

  const ROLE_META = {
    admin: {
      label: 'Administrator',
      short: 'Admin',
      description: 'Akses penuh ke seluruh modul, pengguna, hak akses, dan pengaturan sistem.',
      color: '#0f766e',
      tint: '#e6f5f1'
    },
    pendaftaran: {
      label: 'Petugas Pendaftaran',
      short: 'Pendaftaran',
      description: 'Mengelola data pasien, pendaftaran kunjungan, dan antrean layanan.',
      color: '#246b97',
      tint: '#e9f3fa'
    },
    dokter: {
      label: 'Dokter',
      short: 'Dokter',
      description: 'Memeriksa pasien, mengisi rekam medis elektronik, diagnosis, dan resep.',
      color: '#6d5aa8',
      tint: '#f0ecfb'
    },
    perawat: {
      label: 'Perawat',
      short: 'Perawat',
      description: 'Mengelola alur antrean dan mencatat tanda vital / asesmen awal pasien.',
      color: '#b4537a',
      tint: '#fbeef4'
    },
    farmasi: {
      label: 'Petugas Farmasi',
      short: 'Farmasi',
      description: 'Mengelola master obat, stok, penerimaan, resep, dan penyerahan obat.',
      color: '#9a6700',
      tint: '#fbf3df'
    },
    pasien: {
      label: 'Pasien', short: 'Pasien',
      description: 'Melihat identitas sendiri, mengajukan antrean, dan memantau status kunjungan.',
      color: '#0f766e', tint: '#e6f5f1'
    },
    kasir: {
      label: 'Petugas Kasir',
      short: 'Kasir',
      description: 'Mengelola tarif, tagihan, verifikasi penjaminan, pembayaran, dan kuitansi.',
      color: '#a54a32',
      tint: '#fbeee9'
    }
  };

  const ROLE_ORDER = ['admin', 'pendaftaran', 'dokter', 'perawat', 'farmasi', 'kasir', 'pasien'];

  const PAGES = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'patients', label: 'Pendaftaran Pasien', icon: 'users' },
    { id: 'queues', label: 'Antrean Pasien', icon: 'queue' },
    { id: 'examinations', label: 'Pemeriksaan Dokter', icon: 'stethoscope' },
    { id: 'pharmacy', label: 'Farmasi & Obat', icon: 'pill' },
    { id: 'billing', label: 'Pembayaran & Tarif', icon: 'receipt' },
    { id: 'reports', label: 'Laporan', icon: 'chart' },
    { id: 'users', label: 'Pengguna & Hak Akses', icon: 'shield' },
    { id: 'settings', label: 'Pengaturan', icon: 'settings' }
  ];

  const DEFAULT_ACCESS = {
    admin: PAGES.map((page) => page.id),
    pendaftaran: ['dashboard', 'patients', 'queues'],
    dokter: ['dashboard', 'patients', 'queues', 'examinations', 'reports'],
    perawat: ['dashboard', 'patients', 'queues', 'examinations'],
    farmasi: ['dashboard', 'patients', 'pharmacy'],
    kasir: ['dashboard', 'patients', 'billing'],
    pasien: ['dashboard', 'patients', 'queues']
  };

  const CAPABILITIES = {
    admin: ['*'],
    pendaftaran: ['patient.manage', 'queue.manage', 'queue.cancel'],
    dokter: ['queue.manage', 'exam.manage', 'vitals.manage', 'prescription.manage'],
    perawat: ['queue.manage', 'queue.cancel', 'vitals.manage'],
    farmasi: ['pharmacy.manage', 'prescription.dispense'],
    kasir: ['billing.manage', 'tariff.manage', 'billing.verify'],
    pasien: ['patient.self', 'queue.self']
  };

  const STATUS_META = {
    menunggu: { label: 'Menunggu', tone: 'waiting' },
    dipanggil: { label: 'Dipanggil', tone: 'called' },
    dilayani: { label: 'Sedang Dilayani', tone: 'active' },
    selesai: { label: 'Selesai', tone: 'done' },
    batal: { label: 'Dibatalkan', tone: 'cancelled' }
  };

  const BILL_STATUS_META = {
    belum: { label: 'Belum Dibayar', tone: 'waiting' },
    lunas: { label: 'Lunas', tone: 'done' },
    ditanggung: { label: 'Ditanggung BPJS', tone: 'info' }
  };

  const PARTICIPATION = ['BPJS', 'Umum'];
  const PAYMENT_METHODS = ['Tunai', 'QRIS', 'Transfer Bank', 'Kartu Debit'];
  const PRIORITY_REASONS = ['Lansia (≥ 60 tahun)', 'Ibu hamil', 'Disabilitas', 'Anak balita', 'Kondisi darurat', 'Rujukan cepat'];

  const COMMON_DIAGNOSES = [
    { nama: 'ISPA (Infeksi Saluran Pernapasan Akut)', kode: 'J06.9' },
    { nama: 'Hipertensi esensial (primer)', kode: 'I10' },
    { nama: 'Dispepsia fungsional', kode: 'K30' },
    { nama: 'Diabetes melitus tipe 2', kode: 'E11.9' },
    { nama: 'Faringitis akut', kode: 'J02.9' },
    { nama: 'Dermatitis kontak iritan', kode: 'L24.9' },
    { nama: 'Myalgia', kode: 'M79.1' },
    { nama: 'Asma bronkial', kode: 'J45.9' },
    { nama: 'Gastritis akut', kode: 'K29.7' },
    { nama: 'Anemia defisiensi besi', kode: 'D50.9' },
    { nama: 'Pulpitis akut', kode: 'K04.0' },
    { nama: 'Karies gigi', kode: 'K02.9' }
  ];

  /* ------------------------------------------------------------------------
     Utilitas tanggal & angka
     ------------------------------------------------------------------------ */
  function pad(value, size) {
    return String(value).padStart(size || 2, '0');
  }

  function dateKey(date) {
    const d = date instanceof Date ? date : new Date(date || Date.now());
    if (Number.isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function parseDate(value) {
    if (value instanceof Date) return new Date(value.getTime());
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const parts = value.split('-').map(Number);
      return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
    }
    return new Date(value || Date.now());
  }

  function isoFor(day, hour, minute, second) {
    const d = parseDate(day);
    d.setHours(hour || 0, minute || 0, second || 0, 0);
    return d.toISOString();
  }

  function addDays(date, amount) {
    const d = new Date(date instanceof Date ? date.getTime() : parseDate(date).getTime());
    d.setDate(d.getDate() + amount);
    return d;
  }

  function addDaysKey(day, amount) {
    return dateKey(addDays(parseDate(day), amount));
  }

  function daysFromNow(amount, hour, minute) {
    const d = addDays(new Date(), amount);
    d.setHours(hour === undefined ? 9 : hour, minute || 0, 0, 0);
    return d;
  }

  function daysAgoISO(amount, hour, minute) {
    return daysFromNow(-amount, hour, minute).toISOString();
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function addMinutesIso(iso, minutes) {
    const d = new Date(iso);
    d.setMinutes(d.getMinutes() + minutes);
    return d.toISOString();
  }

  function ageOf(birthDate) {
    if (!birthDate) return 0;
    const birth = parseDate(birthDate);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const month = now.getMonth() - birth.getMonth();
    if (month < 0 || (month === 0 && now.getDate() < birth.getDate())) age -= 1;
    return Math.max(age, 0);
  }

  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function normalizePhone(value) {
    return String(value || '').replace(/[^\d+]/g, '');
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getRoleMeta(role) {
    return ROLE_META[role] || {
      label: role || 'Pengguna',
      short: role || 'Pengguna',
      description: '',
      color: '#0f766e',
      tint: '#e6f5f1'
    };
  }

  function getPoli(id) {
    return POLI.find((poli) => poli.id === id) || { id: id, nama: id || 'Poli', singkat: id || '-', kode: 'P', warna: '#64748b' };
  }

  function poliId(value) {
    if (!value) return 'umum';
    const found = POLI.find((poli) => poli.id === value || poli.nama === value);
    return found ? found.id : 'umum';
  }

  function medicineStatus(medicine) {
    if (!medicine) return { key: 'unknown', label: 'Tidak diketahui', tone: 'muted' };
    const stock = Number(medicine.stok) || 0;
    const min = Number(medicine.stokMinimum) || 0;
    const today = dateKey();
    const expiry = medicine.kadaluarsa || '';
    if (expiry && expiry < today) return { key: 'expired', label: 'Kedaluwarsa', tone: 'danger' };
    if (stock <= 0) return { key: 'out', label: 'Stok habis', tone: 'danger' };
    if (expiry && expiry <= dateKey(addDays(new Date(), 60))) return { key: 'expiring', label: 'Segera kedaluwarsa', tone: 'warning' };
    if (stock <= min) return { key: 'low', label: 'Stok menipis', tone: 'warning' };
    return { key: 'safe', label: 'Aman', tone: 'success' };
  }

  /* ------------------------------------------------------------------------
     Seed data contoh
     ------------------------------------------------------------------------ */
  function seedData() {
    const today = dateKey();
    const now = new Date();
    const year = now.getFullYear();
    const clinic = {
      nama: 'Sehat Bersama - Puskesmas Arbes',
      instansi: 'Sehat Bersama - Puskesmas Arbes',
      alamat: 'Alamat belum dikonfigurasi (data simulasi)' ,
      telepon: '(022) 7712-3456',
      whatsapp: '0812-3456-7890',
      email: 'halo@puskesmas-arbes.id',
      jamOperasional: 'Senin–Jumat, 07.30–16.00 WIB',
      kepala: 'dr. Ratna Kusuma, M.K.M.',
      kodeFaskes: 'P3273012',
      motto: 'Melayani dengan hati, untuk masyarakat yang lebih sehat.'
    };

    const users = [
      { id: 'u-admin', username: 'admin', password: 'admin123', name: 'Sari Dewi, S.Kom.', role: 'admin', poli: null, phone: '081200000001', active: true, createdAt: daysAgoISO(420, 8, 0), lastLogin: daysAgoISO(0, 7, 1) },
      { id: 'u-pendaftaran', username: 'pendaftaran', password: '123456', name: 'Nurul Hidayah', role: 'pendaftaran', poli: null, phone: '081200000002', active: true, createdAt: daysAgoISO(380, 8, 0), lastLogin: daysAgoISO(0, 7, 18) },
      { id: 'u-dokter', username: 'dokter', password: '123456', name: 'dr. Rizky Pratama', role: 'dokter', poli: 'umum', phone: '081200000003', active: true, createdAt: daysAgoISO(350, 8, 0), lastLogin: daysAgoISO(0, 7, 40) },
      { id: 'u-perawat', username: 'perawat', password: '123456', name: 'Ani Rahmawati, S.Kep.', role: 'perawat', poli: null, phone: '081200000004', active: true, createdAt: daysAgoISO(310, 8, 0), lastLogin: daysAgoISO(0, 7, 30) },
      { id: 'u-farmasi', username: 'farmasi', password: '123456', name: 'Dedi Kurniawan, S.Farm.', role: 'farmasi', poli: null, phone: '081200000005', active: true, createdAt: daysAgoISO(290, 8, 0), lastLogin: daysAgoISO(0, 7, 22) },
      { id: 'u-kasir', username: 'kasir', password: '123456', name: 'Maya Sari', role: 'kasir', poli: null, phone: '081200000006', active: true, createdAt: daysAgoISO(260, 8, 0), lastLogin: daysAgoISO(0, 7, 25) },
      { id: 'u-dokter-gigi', username: 'dokter.gigi', password: '123456', name: 'drg. Lina Marlina', role: 'dokter', poli: 'gigi', phone: '081200000007', active: true, createdAt: daysAgoISO(240, 8, 0), lastLogin: daysAgoISO(1, 8, 10) },
      { id: 'u-pendaftaran-2', username: 'pendaftaran2', password: '123456', name: 'Budi Hartono', role: 'pendaftaran', poli: null, phone: '081200000008', active: false, createdAt: daysAgoISO(180, 8, 0), lastLogin: daysAgoISO(30, 9, 0) }
    ];

    const patients = [
      {
        id: 'p-001', noRM: 'RM-' + year + '-0001', nik: '3273014507990001', nama: 'Ahmad Fauzi', tempatLahir: 'Bandung', tanggalLahir: '1999-07-05', jenisKelamin: 'L', alamat: 'Jl. Merdeka No. 10, Sukamaju, Bandung', noTelepon: '081234567890', jenisKepersertaan: 'BPJS', noBPJS: '0001234567890', kontakKeluarga: { nama: 'Siti Aminah', hubungan: 'Istri', telepon: '081298765432' }, createdAt: daysAgoISO(360, 8, 30), createdBy: 'u-pendaftaran', updatedAt: daysAgoISO(40, 9, 10)
      },
      {
        id: 'p-002', noRM: 'RM-' + year + '-0002', nik: '3273015203880002', nama: 'Siti Aminah', tempatLahir: 'Bandung', tanggalLahir: '1988-03-12', jenisKelamin: 'P', alamat: 'Jl. Melati No. 5, Sukamaju, Bandung', noTelepon: '081298765432', jenisKepersertaan: 'BPJS', noBPJS: '0001234567891', kontakKeluarga: { nama: 'Ahmad Fauzi', hubungan: 'Suami', telepon: '081234567890' }, createdAt: daysAgoISO(350, 9, 0), createdBy: 'u-pendaftaran', updatedAt: daysAgoISO(50, 8, 20)
      },
      {
        id: 'p-003', noRM: 'RM-' + year + '-0003', nik: '3273010301650003', nama: 'Budi Santoso', tempatLahir: 'Cimahi', tanggalLahir: '1965-01-03', jenisKelamin: 'L', alamat: 'Jl. Kenanga No. 8, Sukamaju, Bandung', noTelepon: '081233334444', jenisKepersertaan: 'BPJS', noBPJS: '0001234567892', kontakKeluarga: { nama: 'Rina Wati', hubungan: 'Anak', telepon: '085755556666' }, createdAt: daysAgoISO(330, 8, 15), createdBy: 'u-pendaftaran', updatedAt: daysAgoISO(20, 10, 0)
      },
      {
        id: 'p-004', noRM: 'RM-' + year + '-0004', nik: '3273011803950004', nama: 'Rina Wati', tempatLahir: 'Bandung', tanggalLahir: '1995-03-18', jenisKelamin: 'P', alamat: 'Jl. Anggrek No. 2, Sukamaju, Bandung', noTelepon: '085755556666', jenisKepersertaan: 'Umum', noBPJS: '', kontakKeluarga: { nama: 'Budi Santoso', hubungan: 'Ayah', telepon: '081233334444' }, createdAt: daysAgoISO(300, 9, 20), createdBy: 'u-pendaftaran', updatedAt: daysAgoISO(15, 9, 30)
      },
      {
        id: 'p-005', noRM: 'RM-' + year + '-0005', nik: '3273010501600005', nama: 'Joko Prasetyo', tempatLahir: 'Garut', tanggalLahir: '1960-01-05', jenisKelamin: 'L', alamat: 'Jl. Cempaka No. 12, Sukamaju, Bandung', noTelepon: '082177778888', jenisKepersertaan: 'BPJS', noBPJS: '0001234567893', kontakKeluarga: { nama: 'Dewi Lestari', hubungan: 'Anak', telepon: '087899990000' }, createdAt: daysAgoISO(280, 8, 40), createdBy: 'u-pendaftaran', updatedAt: daysAgoISO(12, 8, 5)
      },
      {
        id: 'p-006', noRM: 'RM-' + year + '-0006', nik: '3273012002000006', nama: 'Dewi Lestari', tempatLahir: 'Bandung', tanggalLahir: '2000-02-20', jenisKelamin: 'P', alamat: 'Jl. Dahlia No. 3, Sukamaju, Bandung', noTelepon: '087899990000', jenisKepersertaan: 'Umum', noBPJS: '', kontakKeluarga: { nama: 'Joko Prasetyo', hubungan: 'Ayah', telepon: '082177778888' }, createdAt: daysAgoISO(260, 9, 15), createdBy: 'u-pendaftaran', updatedAt: daysAgoISO(18, 8, 10)
      },
      {
        id: 'p-007', noRM: 'RM-' + year + '-0007', nik: '3273011107180007', nama: 'Muhammad Rizki', tempatLahir: 'Bandung', tanggalLahir: '2018-07-11', jenisKelamin: 'L', alamat: 'Jl. Cendana No. 7, Sukamaju, Bandung', noTelepon: '081377778888', jenisKepersertaan: 'BPJS', noBPJS: '0001234567894', kontakKeluarga: { nama: 'Yuni Astuti', hubungan: 'Ibu', telepon: '081377778888' }, createdAt: daysAgoISO(190, 10, 0), createdBy: 'u-pendaftaran', updatedAt: daysAgoISO(6, 9, 0)
      },
      {
        id: 'p-008', noRM: 'RM-' + year + '-0008', nik: '3273016001590008', nama: 'Sri Wahyuningsih', tempatLahir: 'Tasikmalaya', tanggalLahir: '1959-01-20', jenisKelamin: 'P', alamat: 'Jl. Pahlawan No. 31, Sukamaju, Bandung', noTelepon: '081355556666', jenisKepersertaan: 'BPJS', noBPJS: '0001234567895', kontakKeluarga: { nama: 'Arif Setiawan', hubungan: 'Anak', telepon: '081355556667' }, createdAt: daysAgoISO(170, 8, 20), createdBy: 'u-pendaftaran', updatedAt: daysAgoISO(3, 8, 30)
      },
      {
        id: 'p-009', noRM: 'RM-' + year + '-0009', nik: '3273011408840009', nama: 'Hendra Gunawan', tempatLahir: 'Bandung', tanggalLahir: '1984-08-14', jenisKelamin: 'L', alamat: 'Jl. Sukamaju Raya No. 18, Bandung', noTelepon: '082133334444', jenisKepersertaan: 'BPJS', noBPJS: '0001234567896', kontakKeluarga: { nama: 'Lilis Suryani', hubungan: 'Istri', telepon: '082133335555' }, createdAt: daysAgoISO(140, 9, 30), createdBy: 'u-pendaftaran', updatedAt: daysAgoISO(22, 10, 15)
      },
      {
        id: 'p-010', noRM: 'RM-' + year + '-0010', nik: '3273014102910010', nama: 'Maya Anggraini', tempatLahir: 'Bandung', tanggalLahir: '1991-02-01', jenisKelamin: 'P', alamat: 'Jl. Kamboja No. 6, Sukamaju, Bandung', noTelepon: '081822223333', jenisKepersertaan: 'Umum', noBPJS: '', kontakKeluarga: { nama: 'Rudi Anggraini', hubungan: 'Suami', telepon: '081822224444' }, createdAt: daysAgoISO(110, 8, 10), createdBy: 'u-pendaftaran', updatedAt: daysAgoISO(9, 9, 0)
      },
      {
        id: 'p-011', noRM: 'RM-' + year + '-0011', nik: '3273012204070011', nama: 'Fajar Nugroho', tempatLahir: 'Sumedang', tanggalLahir: '2007-04-22', jenisKelamin: 'L', alamat: 'Jl. Raya Cibeureum No. 44, Bandung', noTelepon: '082211119999', jenisKepersertaan: 'BPJS', noBPJS: '0001234567897', kontakKeluarga: { nama: 'Rohmat Nugroho', hubungan: 'Ayah', telepon: '082211118888' }, createdAt: daysAgoISO(80, 8, 45), createdBy: 'u-pendaftaran', updatedAt: daysAgoISO(8, 8, 15)
      },
      {
        id: 'p-012', noRM: 'RM-' + year + '-0012', nik: '3273015006760012', nama: 'Lilis Suryani', tempatLahir: 'Bandung', tanggalLahir: '1976-06-10', jenisKelamin: 'P', alamat: 'Jl. Sukamaju Raya No. 18, Bandung', noTelepon: '082133335555', jenisKepersertaan: 'BPJS', noBPJS: '0001234567898', kontakKeluarga: { nama: 'Hendra Gunawan', hubungan: 'Suami', telepon: '082133334444' }, createdAt: daysAgoISO(60, 9, 5), createdBy: 'u-pendaftaran', updatedAt: daysAgoISO(5, 9, 10)
      }
    ];

    const medicines = [
      { id: 'm-paracetamol', kode: 'OBT-001', nama: 'Paracetamol 500 mg', kategori: 'Analgesik / Antipiretik', satuan: 'Tablet', stok: 245, stokMinimum: 50, harga: 500, batch: 'PCM-2601', kadaluarsa: dateKey(addDays(now, 520)), lokasi: 'Rak A-1', aktif: true, createdAt: daysAgoISO(360, 7, 0) },
      { id: 'm-amoxicillin', kode: 'OBT-002', nama: 'Amoxicillin 500 mg', kategori: 'Antibiotik', satuan: 'Kapsul', stok: 18, stokMinimum: 25, harga: 1000, batch: 'AMX-2611', kadaluarsa: dateKey(addDays(now, 42)), lokasi: 'Rak A-2', aktif: true, createdAt: daysAgoISO(330, 7, 0) },
      { id: 'm-amlodipine', kode: 'OBT-003', nama: 'Amlodipine 10 mg', kategori: 'Antihipertensi', satuan: 'Tablet', stok: 120, stokMinimum: 30, harga: 700, batch: 'AML-2602', kadaluarsa: dateKey(addDays(now, 460)), lokasi: 'Rak B-1', aktif: true, createdAt: daysAgoISO(320, 7, 0) },
      { id: 'm-antasida', kode: 'OBT-004', nama: 'Antasida DOEN', kategori: 'Gastrointestinal', satuan: 'Tablet', stok: 86, stokMinimum: 20, harga: 400, batch: 'ANT-2604', kadaluarsa: dateKey(addDays(now, 390)), lokasi: 'Rak B-2', aktif: true, createdAt: daysAgoISO(310, 7, 0) },
      { id: 'm-salbutamol', kode: 'OBT-005', nama: 'Salbutamol 2 mg', kategori: 'Respirasi', satuan: 'Tablet', stok: 44, stokMinimum: 15, harga: 600, batch: 'SLB-2603', kadaluarsa: dateKey(addDays(now, 300)), lokasi: 'Rak C-1', aktif: true, createdAt: daysAgoISO(300, 7, 0) },
      { id: 'm-vitamin-b', kode: 'OBT-006', nama: 'Vitamin B Complex', kategori: 'Vitamin & Suplemen', satuan: 'Tablet', stok: 160, stokMinimum: 30, harga: 300, batch: 'VTB-2602', kadaluarsa: dateKey(addDays(now, 580)), lokasi: 'Rak D-1', aktif: true, createdAt: daysAgoISO(290, 7, 0) },
      { id: 'm-obh', kode: 'OBT-007', nama: 'OBH Combi Batuk', kategori: 'Respirasi', satuan: 'Botol', stok: 12, stokMinimum: 15, harga: 12000, batch: 'OBH-2510', kadaluarsa: dateKey(addDays(now, -12)), lokasi: 'Rak C-2', aktif: true, createdAt: daysAgoISO(280, 7, 0) },
      { id: 'm-metformin', kode: 'OBT-008', nama: 'Metformin 500 mg', kategori: 'Antidiabetes', satuan: 'Tablet', stok: 98, stokMinimum: 25, harga: 500, batch: 'MET-2605', kadaluarsa: dateKey(addDays(now, 410)), lokasi: 'Rak B-3', aktif: true, createdAt: daysAgoISO(270, 7, 0) },
      { id: 'm-dexamethasone', kode: 'OBT-009', nama: 'Dexamethasone 0,5 mg', kategori: 'Kortikosteroid', satuan: 'Tablet', stok: 62, stokMinimum: 15, harga: 400, batch: 'DEX-2602', kadaluarsa: dateKey(addDays(now, 350)), lokasi: 'Rak C-3', aktif: true, createdAt: daysAgoISO(250, 7, 0) },
      { id: 'm-ibuprofen', kode: 'OBT-010', nama: 'Ibuprofen 400 mg', kategori: 'Analgesik / Antiinflamasi', satuan: 'Tablet', stok: 102, stokMinimum: 25, harga: 600, batch: 'IBU-2603', kadaluarsa: dateKey(addDays(now, 430)), lokasi: 'Rak A-3', aktif: true, createdAt: daysAgoISO(240, 7, 0) },
      { id: 'm-ors', kode: 'OBT-011', nama: 'Oralit / ORS Sachet', kategori: 'Cairan & Elektrolit', satuan: 'Sachet', stok: 39, stokMinimum: 20, harga: 1500, batch: 'ORS-2606', kadaluarsa: dateKey(addDays(now, 75)), lokasi: 'Rak D-2', aktif: true, createdAt: daysAgoISO(220, 7, 0) },
      { id: 'm-fe', kode: 'OBT-012', nama: 'Tablet Tambah Darah (Fe)', kategori: 'Vitamin & Suplemen', satuan: 'Tablet', stok: 9, stokMinimum: 30, harga: 300, batch: 'FE-2605', kadaluarsa: dateKey(addDays(now, 310)), lokasi: 'Rak D-3', aktif: true, createdAt: daysAgoISO(210, 7, 0) }
    ];

    const tariffs = [
      { id: 't-001', kode: 'TRF-001', nama: 'Konsultasi Dokter Umum', kategori: 'Konsultasi', tarif: 15000, poli: 'umum', aktif: true },
      { id: 't-002', kode: 'TRF-002', nama: 'Konsultasi Dokter Gigi', kategori: 'Konsultasi', tarif: 25000, poli: 'gigi', aktif: true },
      { id: 't-003', kode: 'TRF-003', nama: 'Administrasi Pendaftaran', kategori: 'Administrasi', tarif: 5000, poli: null, aktif: true },
      { id: 't-004', kode: 'TRF-004', nama: 'Konsultasi KIA', kategori: 'Konsultasi', tarif: 15000, poli: 'kia', aktif: true },
      { id: 't-005', kode: 'TRF-005', nama: 'Konsultasi Lansia', kategori: 'Konsultasi', tarif: 15000, poli: 'lansia', aktif: true },
      { id: 't-006', kode: 'TRF-006', nama: 'Konsultasi Gizi', kategori: 'Konsultasi', tarif: 15000, poli: 'gizi', aktif: true },
      { id: 't-007', kode: 'TRF-007', nama: 'Pemeriksaan Tekanan Darah', kategori: 'Pemeriksaan Penunjang', tarif: 5000, poli: null, aktif: true },
      { id: 't-008', kode: 'TRF-008', nama: 'Cek Gula Darah Sewaktu', kategori: 'Pemeriksaan Penunjang', tarif: 15000, poli: null, aktif: true },
      { id: 't-009', kode: 'TRF-009', nama: 'Perawatan Luka Ringan', kategori: 'Tindakan', tarif: 35000, poli: null, aktif: true },
      { id: 't-010', kode: 'TRF-010', nama: 'Injeksi Intramuskular', kategori: 'Tindakan', tarif: 20000, poli: null, aktif: true },
      { id: 't-011', kode: 'TRF-011', nama: 'Surat Keterangan Sehat', kategori: 'Administrasi', tarif: 10000, poli: null, aktif: true },
      { id: 't-012', kode: 'TRF-012', nama: 'Tindakan Tambalan Gigi', kategori: 'Tindakan', tarif: 75000, poli: 'gigi', aktif: true }
    ];

    const queues = [];
    const exams = [];
    const bills = [];
    const mutations = [];
    const audit = [];
    const queueSeq = {};
    const billSeq = {};
    const examSeq = {};
    let auditSeq = 0;

    function appendAudit(action, module, description, actor, createdAt, meta) {
      auditSeq += 1;
      audit.push({
        id: 'audit-seed-' + pad(auditSeq, 4),
        action: action,
        module: module,
        description: description,
        userId: actor ? actor.id : null,
        userName: actor ? actor.name : 'Sistem',
        userRole: actor ? actor.role : 'system',
        createdAt: createdAt || nowIso(),
        meta: meta || null
      });
    }

    function patientById(id) {
      return patients.find((patient) => patient.id === id);
    }

    function medicineById(id) {
      return medicines.find((medicine) => medicine.id === id);
    }

    function getUser(id) {
      return users.find((user) => user.id === id);
    }

    function doctorForPoli(poli) {
      return users.find((user) => user.role === 'dokter' && user.active && user.poli === poli) ||
        users.find((user) => user.role === 'dokter' && user.active) || users[2];
    }

    function nextQueueNumber(day, poli) {
      const key = day + '|' + poli;
      queueSeq[key] = (queueSeq[key] || 0) + 1;
      return queueSeq[key];
    }

    function makeQueue(day, poli, patient, status, hour, minute, options) {
      const opts = options || {};
      poli = poliId(poli);
      const poliData = getPoli(poli);
      const nomor = nextQueueNumber(day, poli);
      const createdAt = isoFor(day, hour, minute);
      const queue = {
        id: uid('q'),
        nomor: nomor,
        kode: poliData.kode + '-' + pad(nomor, 3),
        tanggal: day,
        patientId: patient.id,
        poli: poli,
        prioritas: Boolean(opts.prioritas),
        alasanPrioritas: opts.alasanPrioritas || null,
        status: status,
        createdAt: createdAt,
        calledAt: ['dipanggil', 'dilayani', 'selesai'].includes(status) ? addMinutesIso(createdAt, opts.callDelay || 12) : null,
        startedAt: ['dilayani', 'selesai'].includes(status) ? addMinutesIso(createdAt, opts.startDelay || 22) : null,
        finishedAt: status === 'selesai' ? addMinutesIso(createdAt, opts.finishDelay || 48) : null,
        cancelledAt: status === 'batal' ? addMinutesIso(createdAt, 16) : null,
        alasanBatal: status === 'batal' ? (opts.alasanBatal || 'Pasien tidak hadir saat dipanggil') : null,
        createdBy: opts.createdBy || 'u-pendaftaran'
      };
      queues.push(queue);
      return queue;
    }

    function nextExamNo(day) {
      examSeq[day] = (examSeq[day] || 0) + 1;
      return 'EMR-' + day.replace(/-/g, '') + '-' + pad(examSeq[day], 3);
    }

    function nextBillNo(day) {
      billSeq[day] = (billSeq[day] || 0) + 1;
      return 'INV-' + day.replace(/-/g, '') + '-' + pad(billSeq[day], 3);
    }

    const historicalDiagnoses = [
      { nama: 'ISPA (Infeksi Saluran Pernapasan Akut)', kode: 'J06.9', obat: ['m-paracetamol', 'm-vitamin-b'], jumlah: [10, 10], aturan: '3 x sehari 1 tablet setelah makan', tindakan: 'Edukasi istirahat cukup dan hidrasi' },
      { nama: 'Hipertensi esensial (primer)', kode: 'I10', obat: ['m-amlodipine'], jumlah: [10], aturan: '1 x sehari 1 tablet, malam hari', tindakan: 'Edukasi diet rendah garam dan aktivitas fisik' },
      { nama: 'Dispepsia fungsional', kode: 'K30', obat: ['m-antasida'], jumlah: [10], aturan: '3 x sehari 1 tablet sebelum makan', tindakan: 'Edukasi pola makan teratur' },
      { nama: 'Diabetes melitus tipe 2', kode: 'E11.9', obat: ['m-metformin'], jumlah: [10], aturan: '2 x sehari 1 tablet setelah makan', tindakan: 'Edukasi kontrol gula darah dan diet' },
      { nama: 'Faringitis akut', kode: 'J02.9', obat: ['m-amoxicillin', 'm-paracetamol'], jumlah: [10, 10], aturan: '3 x sehari 1 tablet/kapsul setelah makan', tindakan: 'Edukasi istirahat dan hidrasi' },
      { nama: 'Dermatitis kontak iritan', kode: 'L24.9', obat: ['m-dexamethasone'], jumlah: [6], aturan: '2 x sehari 1 tablet setelah makan', tindakan: 'Edukasi menghindari alergen' },
      { nama: 'Myalgia', kode: 'M79.1', obat: ['m-ibuprofen'], jumlah: [10], aturan: '2 x sehari 1 tablet setelah makan', tindakan: 'Edukasi kompres hangat dan istirahat' },
      { nama: 'Asma bronkial', kode: 'J45.9', obat: ['m-salbutamol'], jumlah: [10], aturan: '3 x sehari 1 tablet bila sesak', tindakan: 'Edukasi menghindari pemicu dan teknik pernapasan' },
      { nama: 'Gastritis akut', kode: 'K29.7', obat: ['m-antasida'], jumlah: [10], aturan: '3 x sehari 1 tablet sebelum makan', tindakan: 'Edukasi hindari makanan pedas dan kopi' },
      { nama: 'Anemia defisiensi besi', kode: 'D50.9', obat: ['m-fe', 'm-vitamin-b'], jumlah: [10, 10], aturan: '1 x sehari 1 tablet setelah makan', tindakan: 'Edukasi konsumsi makanan kaya zat besi' }
    ];

    const dentalDiagnoses = [
      { nama: 'Pulpitis akut', kode: 'K04.0', obat: ['m-amoxicillin', 'm-ibuprofen'], jumlah: [10, 6], aturan: '3 x sehari 1 tablet setelah makan', tindakan: 'Perawatan saluran akar sementara' },
      { nama: 'Karies gigi', kode: 'K02.9', obat: ['m-paracetamol'], jumlah: [10], aturan: '3 x sehari 1 tablet bila nyeri', tindakan: 'Penambalan gigi sementara' }
    ];

    function makeResep(diagnosis, seedIndex) {
      return diagnosis.obat.map((medicineId, idx) => {
        const medicine = medicineById(medicineId);
        return {
          medicineId: medicineId,
          nama: medicine.nama,
          satuan: medicine.satuan,
          harga: medicine.harga,
          jumlah: diagnosis.jumlah[idx] || 10,
          aturan: diagnosis.aturan,
          diserahkan: true
        };
      });
    }

    function createSeedExam(queue, doctorId, options) {
      const opts = options || {};
      const patient = patientById(queue.patientId);
      const age = ageOf(patient.tanggalLahir);
      const day = queue.tanggal;
      const diagnosis = opts.diagnosis || historicalDiagnoses[0];
      const resep = opts.resep || makeResep(diagnosis);
      const createdAt = queue.startedAt || addMinutesIso(queue.createdAt, 20);
      const completedAt = queue.finishedAt || addMinutesIso(queue.createdAt, 45);
      const doctor = getUser(doctorId) || doctorForPoli(queue.poli);
      const exam = {
        id: uid('exam'),
        noPemeriksaan: nextExamNo(day),
        queueId: queue.id,
        patientId: patient.id,
        dokterId: doctor.id,
        poli: queue.poli,
        tanggal: day,
        status: opts.status || 'selesai',
        keluhan: opts.keluhan || 'Keluhan dirasakan sejak beberapa hari terakhir.',
        riwayatAlergi: opts.riwayatAlergi || 'Tidak ada riwayat alergi obat yang diketahui.',
        pemeriksaanFisik: {
          tekananDarah: age >= 60 ? '148/88 mmHg' : '120/80 mmHg',
          nadi: '82 x/menit',
          suhu: '36,6 °C',
          respirasi: '18 x/menit',
          beratBadan: String(age < 18 ? 32 : age >= 60 ? 68 : 61),
          tinggiBadan: String(age < 18 ? 138 : age >= 60 ? 158 : 166),
          spo2: '98%',
          catatanFisik: 'Kesadaran compos mentis, tampak nyaman.'
        },
        diagnosis: opts.status === 'draft' ? '' : diagnosis.nama,
        kodeICD10: opts.status === 'draft' ? '' : diagnosis.kode,
        diagnosisSekunder: opts.diagnosisSekunder || '',
        tindakan: opts.status === 'draft' ? '' : diagnosis.tindakan,
        catatanDokter: opts.status === 'draft' ? '' : 'Edukasi dan instruksi terapi telah dijelaskan kepada pasien.',
        rujukan: opts.rujukan || null,
        kontrolUlang: opts.kontrolUlang || (['I10', 'E11.9'].includes(diagnosis.kode) ? addDaysKey(day, 14) : ''),
        resep: opts.status === 'draft' ? [] : resep,
        resepStatus: opts.status === 'draft' ? null : (resep.length ? 'diserahkan' : null),
        dispensedAt: opts.status === 'draft' ? null : completedAt,
        dispensedBy: opts.status === 'draft' ? null : 'u-farmasi',
        createdAt: createdAt,
        completedAt: opts.status === 'draft' ? null : completedAt,
        updatedAt: completedAt
      };
      exams.push(exam);
      return exam;
    }

    function tariffByName(name) {
      return tariffs.find((tariff) => tariff.nama === name && tariff.aktif);
    }

    function addSeedBill(exam, patient, day, options) {
      const opts = options || {};
      const consultation = tariffs.find((tariff) => tariff.kategori === 'Konsultasi' && tariff.poli === exam.poli) ||
        tariffs.find((tariff) => tariff.kode === 'TRF-001');
      const admin = tariffs.find((tariff) => tariff.kode === 'TRF-003');
      const items = [
        {
          id: uid('bi'),
          tipe: 'konsultasi',
          label: consultation.nama,
          qty: 1,
          harga: consultation.tarif,
          total: consultation.tarif,
          tarifId: consultation.id
        },
        {
          id: uid('bi'),
          tipe: 'layanan',
          label: admin.nama,
          qty: 1,
          harga: admin.tarif,
          total: admin.tarif,
          tarifId: admin.id
        }
      ];
      (exam.resep || []).forEach((item) => {
        items.push({
          id: uid('bi'),
          tipe: 'obat',
          label: 'Obat · ' + item.nama,
          qty: item.jumlah,
          harga: item.harga,
          total: item.jumlah * item.harga,
          medicineId: item.medicineId
        });
      });
      const subtotal = items.reduce((total, item) => total + item.total, 0);
      const isBPJS = patient.jenisKepersertaan === 'BPJS' && opts.penjamin !== 'Umum';
      const status = opts.status || (isBPJS ? 'ditanggung' : 'lunas');
      const created = exam.completedAt || addMinutesIso(exam.createdAt, 45);
      const paidAt = status === 'lunas' ? addMinutesIso(created, 25) : status === 'ditanggung' ? addMinutesIso(created, 20) : null;
      const bill = {
        id: uid('bill'),
        noBill: nextBillNo(day),
        patientId: patient.id,
        examinationId: exam.id,
        poli: exam.poli,
        tanggal: day,
        items: items,
        subtotal: subtotal,
        diskon: 0,
        total: subtotal,
        penjamin: isBPJS ? 'BPJS' : 'Umum',
        status: status,
        metode: status === 'lunas' ? (opts.metode || (subtotal % 2 ? 'Tunai' : 'QRIS')) : (status === 'ditanggung' ? 'BPJS' : null),
        jumlahBayar: status === 'lunas' ? subtotal : 0,
        kembalian: 0,
        paidAt: paidAt,
        kasirId: status === 'lunas' ? 'u-kasir' : null,
        verification: isBPJS ? {
          status: status === 'ditanggung' ? 'terverifikasi' : 'belum',
          noSEP: status === 'ditanggung' ? 'SEP-' + day.replace(/-/g, '') + '-' + pad(Math.floor(Math.random() * 900) + 100, 3) : '',
          verifiedAt: status === 'ditanggung' ? addMinutesIso(created, 18) : null,
          verifiedBy: status === 'ditanggung' ? 'u-kasir' : null
        } : null,
        createdAt: addMinutesIso(created, 10),
        createdBy: exam.dokterId
      };
      bills.push(bill);
      return bill;
    }

    /* Riwayat kunjungan 30 hari terakhir untuk mengisi dashboard dan laporan. */
    for (let d = 30; d >= 1; d -= 1) {
      const day = dateKey(addDays(now, -d));
      const count = 3 + (d % 2);
      const usedPatients = new Set();
      for (let j = 0; j < count; j += 1) {
        let patient = patients[(d * 3 + j * 5 + 1) % patients.length];
        let guard = 0;
        while (usedPatients.has(patient.id) && guard < patients.length) {
          patient = patients[(patients.indexOf(patient) + 1) % patients.length];
          guard += 1;
        }
        usedPatients.add(patient.id);
        const poli = ['umum', 'umum', 'kia', 'gigi', 'lansia', 'gizi'][(d + j) % 6];
        const baseMinutes = 8 * 60 + j * 45 + (d % 4) * 5;
        const hour = Math.floor(baseMinutes / 60);
        const minute = baseMinutes % 60;
        const priority = ageOf(patient.tanggalLahir) >= 60 && j === 0;
        const cancelled = d % 8 === 0 && j === count - 1;
        const queue = makeQueue(day, poli, patient, cancelled ? 'batal' : 'selesai', hour, minute, {
          prioritas: priority,
          alasanPrioritas: priority ? 'Lansia (≥ 60 tahun)' : null,
          createdBy: 'u-pendaftaran'
        });
        if (!cancelled) {
          const isDental = poli === 'gigi';
          const diagnosis = isDental
            ? dentalDiagnoses[(d + j) % dentalDiagnoses.length]
            : historicalDiagnoses[(d * 2 + j) % historicalDiagnoses.length];
          const doctorId = isDental ? 'u-dokter-gigi' : 'u-dokter';
          const exam = createSeedExam(queue, doctorId, {
            diagnosis: diagnosis,
            rujukan: d === 12 && j === 0 ? {
              tujuan: 'RSUD Kota Bandung',
              alasan: 'Memerlukan pemeriksaan penunjang lanjutan',
              tanggal: addDaysKey(day, 1)
            } : null
          });
          addSeedBill(exam, patient, day);
        }
      }
    }

    /* Antrean hari ini */
    const budi = patientById('p-003');
    const siti = patientById('p-002');
    const rina = patientById('p-004');
    const lilis = patientById('p-012');
    const dewi = patientById('p-006');
    const ahmad = patientById('p-001');
    const joko = patientById('p-005');
    const fajar = patientById('p-011');

    const qBudi = makeQueue(today, 'umum', budi, 'selesai', 7, 42, { createdBy: 'u-pendaftaran', callDelay: 18, startDelay: 26, finishDelay: 55 });
    const qSiti = makeQueue(today, 'umum', siti, 'selesai', 7, 58, { createdBy: 'u-pendaftaran', callDelay: 14, startDelay: 24, finishDelay: 48 });
    const qRina = makeQueue(today, 'gigi', rina, 'dilayani', 8, 15, { createdBy: 'u-pendaftaran' });
    makeQueue(today, 'umum', lilis, 'batal', 8, 27, { createdBy: 'u-pendaftaran', alasanBatal: 'Pasien pulang sebelum dipanggil' });
    makeQueue(today, 'kia', dewi, 'dipanggil', 8, 40, { createdBy: 'u-pendaftaran' });
    makeQueue(today, 'umum', ahmad, 'menunggu', 9, 5, { createdBy: 'u-pendaftaran' });
    makeQueue(today, 'umum', joko, 'menunggu', 9, 8, { prioritas: true, alasanPrioritas: 'Lansia (≥ 60 tahun)', createdBy: 'u-pendaftaran' });
    makeQueue(today, 'umum', fajar, 'menunggu', 9, 20, { createdBy: 'u-pendaftaran' });

    const budiExam = createSeedExam(qBudi, 'u-dokter', {
      diagnosis: historicalDiagnoses[1],
      keluhan: 'Kepala terasa pusing dan tegang di bagian belakang leher sejak 4 hari terakhir.',
      diagnosisSekunder: 'Dispepsia fungsional',
      kontrolUlang: addDaysKey(today, 14),
      resep: [
        { medicineId: 'm-amlodipine', nama: 'Amlodipine 10 mg', satuan: 'Tablet', harga: 700, jumlah: 10, aturan: '1 x sehari 1 tablet, malam hari', diserahkan: false },
        { medicineId: 'm-antasida', nama: 'Antasida DOEN', satuan: 'Tablet', harga: 400, jumlah: 10, aturan: '3 x sehari 1 tablet sebelum makan', diserahkan: false }
      ]
    });
    budiExam.resepStatus = 'menunggu';
    budiExam.dispensedAt = null;
    budiExam.dispensedBy = null;
    const budiBill = addSeedBill(budiExam, budi, today, { status: 'belum', penjamin: 'BPJS' });
    budiBill.verification = { status: 'belum', noSEP: '', verifiedAt: null, verifiedBy: null };

    const sitiExam = createSeedExam(qSiti, 'u-dokter', {
      diagnosis: historicalDiagnoses[0],
      keluhan: 'Batuk berdahak, pilek, dan demam ringan sejak 3 hari yang lalu.',
      kontrolUlang: addDaysKey(today, 7)
    });
    const sitiBill = addSeedBill(sitiExam, siti, today, { status: 'belum', penjamin: 'BPJS' });
    sitiBill.verification = { status: 'belum', noSEP: '', verifiedAt: null, verifiedBy: null };

    const rinaExam = createSeedExam(qRina, 'u-dokter-gigi', {
      status: 'draft',
      keluhan: 'Nyeri gigi belakang kanan bawah sejak 2 hari, memberat saat mengunyah.',
      riwayatAlergi: 'Tidak ada riwayat alergi obat yang diketahui.'
    });
    rinaExam.pemeriksaanFisik = {
      tekananDarah: '118/76 mmHg',
      nadi: '84 x/menit',
      suhu: '36,7 °C',
      respirasi: '18 x/menit',
      beratBadan: '54',
      tinggiBadan: '160',
      spo2: '99%',
      catatanFisik: 'Pasien tampak menahan nyeri, kondisi umum baik.'
    };
    rinaExam.updatedAt = nowIso();

    /* Mutasi stok: saldo awal + seluruh penyerahan historis + satu penerimaan baru. */
    const usage = [];
    exams.forEach((exam) => {
      if (!exam.resep || !exam.resep.length || exam.resepStatus !== 'diserahkan') return;
      exam.resep.forEach((item) => {
        usage.push({
          medicineId: item.medicineId,
          jumlah: Number(item.jumlah) || 0,
          createdAt: exam.dispensedAt || exam.completedAt,
          reference: exam.noPemeriksaan,
          patientId: exam.patientId
        });
      });
    });

    const extraReceipts = [
      { medicineId: 'm-paracetamol', jumlah: 100, dayOffset: 3, supplier: 'PT Kimia Farma Trading', batch: 'PCM-2611', kadaluarsa: dateKey(addDays(now, 540)) },
      { medicineId: 'm-antasida', jumlah: 50, dayOffset: 6, supplier: 'PT Bina San Prima', batch: 'ANT-2611', kadaluarsa: dateKey(addDays(now, 400)) }
    ];

    medicines.forEach((medicine) => {
      const medicineUsage = usage.filter((entry) => entry.medicineId === medicine.id).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const incoming = extraReceipts.filter((entry) => entry.medicineId === medicine.id);
      const totalOut = medicineUsage.reduce((sum, entry) => sum + entry.jumlah, 0);
      const totalExtraIn = incoming.reduce((sum, entry) => sum + entry.jumlah, 0);
      const initialStock = Math.max(medicine.stok + totalOut - totalExtraIn, medicine.stokMinimum * 3);
      let running = initialStock;
      mutations.push({
        id: uid('mut'),
        medicineId: medicine.id,
        tipe: 'masuk',
        jumlah: initialStock,
        stokSebelum: 0,
        stokSesudah: initialStock,
        catatan: 'Saldo awal persediaan farmasi',
        referensi: 'SALDO-AWAL',
        supplier: 'Gudang Farmasi Puskesmas',
        batch: medicine.batch,
        kadaluarsa: medicine.kadaluarsa,
        createdAt: daysAgoISO(35, 7, 30),
        userId: 'u-admin',
        userName: 'Sari Dewi, S.Kom.'
      });

      const events = [
        ...incoming.map((entry) => ({ type: 'masuk', entry: entry, createdAt: daysAgoISO(entry.dayOffset, 10, 15) })),
        ...medicineUsage.map((entry) => ({ type: 'keluar', entry: entry, createdAt: entry.createdAt }))
      ].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      events.forEach((event) => {
        const before = running;
        if (event.type === 'masuk') {
          running += event.entry.jumlah;
          mutations.push({
            id: uid('mut'),
            medicineId: medicine.id,
            tipe: 'masuk',
            jumlah: event.entry.jumlah,
            stokSebelum: before,
            stokSesudah: running,
            catatan: 'Penerimaan obat dari distributor',
            referensi: 'TERIMA-' + dateKey(new Date(event.createdAt)),
            supplier: event.entry.supplier,
            batch: event.entry.batch,
            kadaluarsa: event.entry.kadaluarsa,
            createdAt: event.createdAt,
            userId: 'u-farmasi',
            userName: 'Dedi Kurniawan, S.Farm.'
          });
        } else {
          running = Math.max(0, running - event.entry.jumlah);
          const patient = patientById(event.entry.patientId);
          mutations.push({
            id: uid('mut'),
            medicineId: medicine.id,
            tipe: 'keluar',
            jumlah: event.entry.jumlah,
            stokSebelum: before,
            stokSesudah: running,
            catatan: 'Penyerahan obat untuk ' + (patient ? patient.nama : 'pasien'),
            referensi: event.entry.reference,
            supplier: '',
            batch: medicine.batch,
            kadaluarsa: medicine.kadaluarsa,
            createdAt: event.createdAt,
            userId: 'u-farmasi',
            userName: 'Dedi Kurniawan, S.Farm.'
          });
        }
      });
      /* Pastikan angka akhir buku stok sama dengan stok berjalan. */
      if (running !== medicine.stok && mutations.length) {
        const personalMutations = mutations.filter((mutation) => mutation.medicineId === medicine.id);
        personalMutations.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        if (personalMutations.length) personalMutations[personalMutations.length - 1].stokSesudah = medicine.stok;
      }
    });

    /* Audit trail contoh */
    const admin = getUser('u-admin');
    const pendaftaran = getUser('u-pendaftaran');
    const dokter = getUser('u-dokter');
    const farmasi = getUser('u-farmasi');
    const kasir = getUser('u-kasir');
    appendAudit('queue.create', 'Antrean', 'Mendaftarkan antrean ' + queues[queues.length - 1].kode + ' untuk Fajar Nugroho', pendaftaran, daysAgoISO(0, 9, 20));
    appendAudit('queue.call', 'Antrean', 'Memanggil antrean K-001 (Dewi Lestari) ke Poli KIA', pendaftaran, daysAgoISO(0, 9, 5));
    appendAudit('exam.complete', 'Pemeriksaan', 'Menyelesaikan pemeriksaan ' + sitiExam.noPemeriksaan + ' — Siti Aminah', dokter, daysAgoISO(0, 8, 46));
    appendAudit('prescription.dispense', 'Farmasi', 'Menyerahkan resep pemeriksaan ' + sitiExam.noPemeriksaan + ' kepada Siti Aminah', farmasi, daysAgoISO(0, 8, 55));
    appendAudit('exam.complete', 'Pemeriksaan', 'Menyelesaikan pemeriksaan ' + budiExam.noPemeriksaan + ' — Budi Santoso', dokter, daysAgoISO(0, 8, 37));
    appendAudit('queue.create', 'Pendaftaran', 'Mendaftarkan antrean G-001 untuk Rina Wati', pendaftaran, daysAgoISO(0, 8, 15));
    appendAudit('bill.create', 'Pembayaran', 'Tagihan ' + budiBill.noBill + ' dibuat untuk Budi Santoso', dokter, daysAgoISO(0, 8, 40));
    appendAudit('stock.receive', 'Farmasi', 'Menerima 100 tablet Paracetamol dari PT Kimia Farma Trading', farmasi, daysAgoISO(3, 10, 15));
    appendAudit('user.update', 'Pengguna', 'Menonaktifkan akun pendaftaran2 (Budi Hartono)', admin, daysAgoISO(30, 10, 0));

    audit.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    /* Satu pasien KIA (Dewi) memiliki antrean dipanggil hari ini. */
    return {
      meta: {
        seedVersion: SEED_VERSION,
        appVersion: APP_VERSION,
        sprint: SPRINT,
        createdAt: nowIso(),
        clinic: clinic,
        roleAccess: clone(DEFAULT_ACCESS)
      },
      users: users,
      patients: patients,
      queues: queues,
      exams: exams,
      medicines: medicines,
      mutations: mutations,
      tariffs: tariffs,
      bills: bills,
      audit: audit.slice(0, 220)
    };
  }

  /* ------------------------------------------------------------------------
     State, sesi, & persistensi
     ------------------------------------------------------------------------ */
  let db = null;
  let listeners = [];

  function notify() {
    listeners.forEach((listener) => {
      try { listener(db); } catch (error) { /* listener tidak boleh mengganggu aplikasi */ }
    });
  }

  function persist() {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch (error) {
      console.error('Sehat Bersama - Puskesmas Arbes: gagal menyimpan data', error);
    }
    notify();
  }

  function ensureAccessShape(data) {
    if (!data.meta) data.meta = {};
    if (!data.meta.roleAccess) data.meta.roleAccess = clone(DEFAULT_ACCESS);
    ROLE_ORDER.forEach((role) => {
      if (!Array.isArray(data.meta.roleAccess[role])) {
        data.meta.roleAccess[role] = clone(DEFAULT_ACCESS[role] || ['dashboard']);
      }
    });
    data.meta.roleAccess.admin = PAGES.map((page) => page.id);
    if (!Array.isArray(data.audit)) data.audit = [];
    return data;
  }

  function load() {
    if (db) return db;
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.meta && parsed.meta.seedVersion === SEED_VERSION && Array.isArray(parsed.users) && Array.isArray(parsed.patients)) {
          db = ensureAccessShape(parsed);
          return db;
        }
      }
    } catch (error) {
      console.warn('Sehat Bersama - Puskesmas Arbes: data lokal tidak dapat dibaca, memuat data contoh baru.', error);
    }
    db = ensureAccessShape(seedData());
    persist();
    return db;
  }

  function reload() {
    db = null;
    return load();
  }

  function resetAll() {
    localStorage.removeItem(DB_KEY);
    db = ensureAccessShape(seedData());
    persist();
    return db;
  }

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session || !session.userId) return null;
      return session;
    } catch (error) {
      return null;
    }
  }

  function saveSession(session) {
    if (!session) {
      localStorage.removeItem(SESSION_KEY);
    } else {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
  }

  function currentUser() {
    const session = getSession();
    if (!session) return null;
    const user = load().users.find((item) => item.id === session.userId);
    if (!user || !user.active) return null;
    return user;
  }

  function requireUser() {
    const user = currentUser();
    if (!user) throw new Error('Sesi Anda telah berakhir. Silakan masuk kembali.');
    return user;
  }

  function getAccessPages(role) {
    const data = load();
    if (role === 'admin') return PAGES.map((page) => page.id);
    return data.meta.roleAccess[role] || [];
  }

  function hasAccess(page) {
    const user = currentUser();
    if (!user) return false;
    if (user.role === 'admin') return true;
    return getAccessPages(user.role).includes(page);
  }

  function can(action) {
    const user = currentUser();
    if (!user) return false;
    if (user.role === 'admin') return true;
    const capabilities = CAPABILITIES[user.role] || [];
    return capabilities.includes(action);
  }

  function actorInfo(actor) {
    if (actor) return actor;
    return currentUser() || { id: null, name: 'Sistem', role: 'system' };
  }

  function appendAudit(action, module, description, actor, meta, createdAt) {
    const data = load();
    const info = actorInfo(actor);
    data.audit.unshift({
      id: uid('audit'),
      action: action,
      module: module,
      description: description,
      userId: info.id || null,
      userName: info.name || 'Sistem',
      userRole: info.role || 'system',
      createdAt: createdAt || nowIso(),
      meta: meta || null
    });
    if (data.audit.length > 300) data.audit.length = 300;
  }

  function commit(action, module, description, meta, actor) {
    appendAudit(action, module, description, actor, meta);
    persist();
  }

  /* ------------------------------------------------------------------------
     Autentikasi & pengguna
     ------------------------------------------------------------------------ */
  function login(username, password) {
    const data = load();
    const needle = String(username || '').trim().toLowerCase();
    const user = data.users.find((item) => item.username.toLowerCase() === needle);
    if (!user) return { ok: false, message: 'Username tidak ditemukan.' };
    if (!user.active) return { ok: false, message: 'Akun ini sedang dinonaktifkan. Hubungi administrator.' };
    if (String(password || '') !== String(user.password)) return { ok: false, message: 'Password yang Anda masukkan tidak sesuai.' };
    user.lastLogin = nowIso();
    saveSession({ userId: user.id, loginAt: nowIso() });
    appendAudit('auth.login', 'Autentikasi', user.name + ' masuk ke sistem', user);
    persist();
    return { ok: true, user: user };
  }

  // Hasil login/registrasi dari API server lokal menjadi profil sesi UI.
  // Server tetap memegang HASH password asli, browser hanya menyimpan profil demo.
  function acceptServerUser(user, withSession) {
    const data = load();
    if (!user || !user.id || !ROLE_META[user.role]) throw new Error('Respons akun dari server tidak valid.');
    let existing = data.users.find((item) => item.id === user.id);
    if (!existing) existing = data.users.find((item) => item.username === user.username);
    const clean = {
      id: user.id, username: user.username, name: user.name, email: user.email || '',
      phone: user.phone || '', role: user.role, poli: user.poli || null, active: user.active !== false,
      createdAt: user.createdAt || nowIso(), lastLogin: nowIso(), demo: Boolean(user.demo)
    };
    if (existing) Object.assign(existing, clean, {password: ''});
    else { existing = Object.assign({ password: '' }, clean); data.users.push(existing); }
    persist();
    if (withSession) saveSession({ userId: existing.id, loginAt: nowIso() });
    return existing;
  }

  function syncServerUsers(users) {
    const data = load();
    // Pertahankan referensi data contoh klinis; hanya profil Firebase yang disinkronkan dari server.
    const demoIds = ['u-admin','u-pendaftaran','u-dokter','u-perawat','u-farmasi','u-kasir','u-dokter-gigi','u-pendaftaran-2'];
    data.users = data.users.filter(item => demoIds.includes(item.id));
    users.forEach(user => acceptServerUser(user, false));
    persist();
  }

  // Pendaftaran pasien hanya dapat membuat data pasien milik akunnya.
  function createOwnPatient(payload) {
    const actor = requireUser();
    if (actor.role !== 'pasien') throw new Error('Fitur ini khusus akun pasien.');
    const data = load();
    if (data.patients.some((patient) => patient.akunId === actor.id)) throw new Error('Profil pasien Anda sudah terdaftar.');
    const clean = validatePatient(payload);
    const patient = Object.assign({}, clean, {
      id: uid('patient'), noRM: nextRM(), akunId: actor.id,
      createdAt: nowIso(), createdBy: actor.id, updatedAt: nowIso()
    });
    data.patients.push(patient);
    commit('patient.self-register', 'Portal pasien', 'Pasien mendaftarkan profil sendiri', { patientId: patient.id });
    return patient;
  }

  function updateOwnPatient(payload) {
    const actor = requireUser();
    if (actor.role !== 'pasien') throw new Error('Fitur ini khusus akun pasien.');
    const patient = load().patients.find((item) => item.akunId === actor.id);
    if (!patient) throw new Error('Profil pasien belum ada.');
    const clean = validatePatient(payload, patient.id);
    Object.assign(patient, clean, { updatedAt: nowIso() });
    commit('patient.self-update', 'Portal pasien', 'Pasien memperbarui identitasnya', { patientId: patient.id });
    return patient;
  }

  function ownPatient() {
    const user = currentUser();
    if (!user || user.role !== 'pasien') return null;
    return load().patients.find((item) => item.akunId === user.id) || null;
  }

  function logout() {
    const user = currentUser();
    if (user) {
      appendAudit('auth.logout', 'Autentikasi', user.name + ' keluar dari sistem', user);
      persist();
    }
    saveSession(null);
  }

  function resetPasswordWithPhone(username, phone, newPassword) {
    if (!username || !phone || !newPassword) throw new Error('Lengkapi semua data reset password.');
    if (String(newPassword).length < 6) throw new Error('Password baru minimal 6 karakter.');
    const data = load();
    const user = data.users.find((item) => item.username.toLowerCase() === String(username).trim().toLowerCase());
    if (!user) throw new Error('Username tidak ditemukan.');
    if (!user.active) throw new Error('Akun sedang nonaktif. Hubungi administrator.');
    if (normalizePhone(user.phone) !== normalizePhone(phone)) throw new Error('Nomor telepon tidak cocok dengan data akun.');
    user.password = String(newPassword);
    appendAudit('auth.reset-password', 'Autentikasi', 'Reset password mandiri untuk akun @' + user.username, user);
    persist();
    return true;
  }

  function changeOwnPassword(currentPassword, newPassword, confirmation) {
    const user = requireUser();
    if (String(currentPassword) !== String(user.password)) throw new Error('Password saat ini tidak sesuai.');
    if (String(newPassword).length < 6) throw new Error('Password baru minimal 6 karakter.');
    if (String(newPassword) !== String(confirmation)) throw new Error('Konfirmasi password baru belum sama.');
    if (String(newPassword) === String(currentPassword)) throw new Error('Password baru harus berbeda dari password lama.');
    user.password = String(newPassword);
    commit('auth.change-password', 'Autentikasi', user.name + ' mengubah password akun', null, user);
    return true;
  }

  function updateOwnProfile(payload) {
    const user = requireUser();
    if (!String(payload.name || '').trim()) throw new Error('Nama lengkap wajib diisi.');
    user.name = String(payload.name).trim();
    user.phone = normalizePhone(payload.phone || user.phone);
    commit('profile.update', 'Profil', user.name + ' memperbarui profil akun', null, user);
    return user;
  }

  function createUser(payload) {
    requireUser();
    if (!can('*') && !can('user.manage') && currentUser().role !== 'admin') throw new Error('Anda tidak memiliki akses untuk menambah pengguna.');
    const data = load();
    const username = String(payload.username || '').trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new Error('Username 3–30 karakter, hanya huruf kecil, angka, titik, garis bawah, atau tanda hubung.');
    if (data.users.some((user) => user.username.toLowerCase() === username)) throw new Error('Username sudah digunakan.');
    if (!String(payload.name || '').trim()) throw new Error('Nama lengkap wajib diisi.');
    if (!ROLE_META[payload.role]) throw new Error('Peran pengguna tidak valid.');
    if (String(payload.password || '').length < 6) throw new Error('Password awal minimal 6 karakter.');
    if (!String(payload.phone || '').trim()) throw new Error('Nomor telepon wajib diisi.');
    const user = {
      id: uid('user'),
      username: username,
      password: String(payload.password),
      name: String(payload.name).trim(),
      role: payload.role,
      poli: payload.role === 'dokter' ? poliId(payload.poli) : null,
      phone: normalizePhone(payload.phone),
      email: String(payload.email || '').trim().toLowerCase(),
      active: payload.active !== false,
      createdAt: nowIso(),
      lastLogin: null
    };
    data.users.push(user);
    commit('user.create', 'Pengguna', 'Menambahkan akun @' + user.username + ' (' + getRoleMeta(user.role).label + ')', { userId: user.id });
    return user;
  }

  function updateUser(id, payload) {
    const actor = requireUser();
    if (actor.role !== 'admin') throw new Error('Hanya administrator yang dapat mengubah pengguna.');
    const data = load();
    const user = data.users.find((item) => item.id === id);
    if (!user) throw new Error('Pengguna tidak ditemukan.');
    const username = String(payload.username || '').trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new Error('Username 3–30 karakter, hanya huruf kecil, angka, titik, garis bawah, atau tanda hubung.');
    if (data.users.some((item) => item.id !== id && item.username.toLowerCase() === username)) throw new Error('Username sudah digunakan.');
    if (!String(payload.name || '').trim()) throw new Error('Nama lengkap wajib diisi.');
    if (!ROLE_META[payload.role]) throw new Error('Peran pengguna tidak valid.');
    if (user.id === actor.id && payload.role !== 'admin') throw new Error('Anda tidak dapat mengubah peran akun sendiri menjadi non-administrator.');
    user.username = username;
    user.name = String(payload.name).trim();
    user.role = payload.role;
    user.poli = payload.role === 'dokter' ? poliId(payload.poli) : null;
    user.phone = normalizePhone(payload.phone || user.phone);
    if (payload.email !== undefined) user.email = String(payload.email || '').trim().toLowerCase();
    if (payload.password) {
      if (String(payload.password).length < 6) throw new Error('Password baru minimal 6 karakter.');
      user.password = String(payload.password);
    }
    commit('user.update', 'Pengguna', 'Memperbarui data akun @' + user.username, { userId: user.id });
    return user;
  }

  function toggleUser(id) {
    const actor = requireUser();
    if (actor.role !== 'admin') throw new Error('Hanya administrator yang dapat mengubah status akun.');
    if (id === actor.id) throw new Error('Anda tidak dapat menonaktifkan akun sendiri.');
    const data = load();
    const user = data.users.find((item) => item.id === id);
    if (!user) throw new Error('Pengguna tidak ditemukan.');
    if (user.role === 'admin' && user.active) {
      const activeAdmins = data.users.filter((item) => item.role === 'admin' && item.active);
      if (activeAdmins.length <= 1) throw new Error('Minimal harus ada satu administrator aktif.');
    }
    user.active = !user.active;
    commit('user.toggle', 'Pengguna', (user.active ? 'Mengaktifkan' : 'Menonaktifkan') + ' akun @' + user.username, { userId: user.id });
    return user;
  }

  function resetUserPassword(id, newPassword) {
    const actor = requireUser();
    if (actor.role !== 'admin') throw new Error('Hanya administrator yang dapat mereset password.');
    if (String(newPassword || '').length < 6) throw new Error('Password baru minimal 6 karakter.');
    const data = load();
    const user = data.users.find((item) => item.id === id);
    if (!user) throw new Error('Pengguna tidak ditemukan.');
    user.password = String(newPassword);
    commit('user.reset-password', 'Pengguna', 'Mereset password akun @' + user.username, { userId: user.id });
    return true;
  }

  function setRoleAccess(role, pages) {
    const actor = requireUser();
    if (actor.role !== 'admin') throw new Error('Hanya administrator yang dapat mengubah hak akses.');
    if (!ROLE_META[role] || role === 'admin') throw new Error('Hak akses administrator tidak dapat diubah.');
    const validPages = PAGES.map((page) => page.id);
    const normalized = Array.from(new Set((pages || []).filter((page) => validPages.includes(page))));
    if (!normalized.includes('dashboard')) normalized.unshift('dashboard');
    load().meta.roleAccess[role] = normalized;
    commit('access.update', 'Hak Akses', 'Memperbarui hak akses peran ' + getRoleMeta(role).label, { role: role, pages: normalized });
    return normalized;
  }

  function updateClinicSettings(payload) {
    const actor = requireUser();
    if (actor.role !== 'admin') throw new Error('Hanya administrator yang dapat mengubah pengaturan.');
    const clinic = load().meta.clinic;
    ['nama', 'instansi', 'alamat', 'telepon', 'whatsapp', 'email', 'jamOperasional', 'kepala', 'kodeFaskes', 'motto'].forEach((key) => {
      if (payload[key] !== undefined) clinic[key] = String(payload[key]).trim();
    });
    if (!clinic.nama) throw new Error('Nama puskesmas wajib diisi.');
    commit('settings.update', 'Pengaturan', 'Memperbarui identitas dan pengaturan puskesmas');
    return clinic;
  }

  /* ------------------------------------------------------------------------
     Pasien
     ------------------------------------------------------------------------ */
  function validatePatient(payload, existingId) {
    const data = load();
    const nik = String(payload.nik || '').replace(/\s/g, '');
    if (!/^\d{16}$/.test(nik)) throw new Error('NIK harus terdiri dari tepat 16 digit angka.');
    if (!String(payload.nama || '').trim()) throw new Error('Nama lengkap wajib diisi.');
    if (String(payload.nama).trim().length < 3) throw new Error('Nama lengkap minimal 3 karakter.');
    if (!String(payload.tempatLahir || '').trim()) throw new Error('Tempat lahir wajib diisi.');
    if (!payload.tanggalLahir || Number.isNaN(parseDate(payload.tanggalLahir).getTime())) throw new Error('Tanggal lahir wajib diisi dengan benar.');
    if (parseDate(payload.tanggalLahir) > new Date()) throw new Error('Tanggal lahir tidak boleh melebihi hari ini.');
    if (!['L', 'P'].includes(payload.jenisKelamin)) throw new Error('Jenis kelamin wajib dipilih.');
    if (!String(payload.alamat || '').trim()) throw new Error('Alamat wajib diisi.');
    if (!String(payload.noTelepon || '').trim()) throw new Error('Nomor telepon wajib diisi.');
    if (!PARTICIPATION.includes(payload.jenisKepersertaan)) throw new Error('Jenis kepesertaan tidak valid.');
    if (payload.jenisKepersertaan === 'BPJS' && !/^\d{13}$/.test(String(payload.noBPJS || '').replace(/\s/g, ''))) {
      throw new Error('Nomor BPJS harus terdiri dari 13 digit angka.');
    }
    if (data.patients.some((patient) => patient.nik === nik && patient.id !== existingId)) {
      throw new Error('NIK tersebut sudah terdaftar pada pasien lain.');
    }
    return {
      nik: nik,
      nama: String(payload.nama).trim(),
      tempatLahir: String(payload.tempatLahir).trim(),
      tanggalLahir: payload.tanggalLahir,
      jenisKelamin: payload.jenisKelamin,
      alamat: String(payload.alamat).trim(),
      noTelepon: normalizePhone(payload.noTelepon),
      jenisKepersertaan: payload.jenisKepersertaan,
      noBPJS: payload.jenisKepersertaan === 'BPJS' ? String(payload.noBPJS).replace(/\s/g, '') : '',
      kontakKeluarga: {
        nama: String((payload.kontakKeluarga && payload.kontakKeluarga.nama) || '').trim(),
        hubungan: String((payload.kontakKeluarga && payload.kontakKeluarga.hubungan) || '').trim(),
        telepon: normalizePhone((payload.kontakKeluarga && payload.kontakKeluarga.telepon) || '')
      }
    };
  }

  function nextRM() {
    const data = load();
    const year = new Date().getFullYear();
    const current = data.patients
      .map((patient) => {
        const match = /^RM-(\d{4})-(\d+)$/.exec(patient.noRM || '');
        return match && Number(match[1]) === year ? Number(match[2]) : 0;
      })
      .reduce((max, value) => Math.max(max, value), 0);
    return 'RM-' + year + '-' + pad(current + 1, 4);
  }

  function createPatient(payload) {
    const actor = requireUser();
    if (!can('patient.manage')) throw new Error('Anda tidak memiliki akses untuk mendaftarkan pasien.');
    const clean = validatePatient(payload);
    const patient = Object.assign({}, clean, {
      id: uid('patient'),
      noRM: nextRM(),
      createdAt: nowIso(),
      createdBy: actor.id,
      updatedAt: nowIso()
    });
    load().patients.push(patient);
    commit('patient.create', 'Pendaftaran', 'Mendaftarkan pasien baru ' + patient.nama + ' (' + patient.noRM + ')', { patientId: patient.id, noRM: patient.noRM });
    return patient;
  }

  function updatePatient(id, payload) {
    requireUser();
    if (!can('patient.manage')) throw new Error('Anda tidak memiliki akses untuk mengubah data pasien.');
    const data = load();
    const patient = data.patients.find((item) => item.id === id);
    if (!patient) throw new Error('Pasien tidak ditemukan.');
    const clean = validatePatient(payload, id);
    Object.assign(patient, clean, { updatedAt: nowIso() });
    commit('patient.update', 'Pendaftaran', 'Memperbarui data pasien ' + patient.nama + ' (' + patient.noRM + ')', { patientId: patient.id });
    return patient;
  }

  function patientById(id) {
    return load().patients.find((patient) => patient.id === id);
  }

  function patients() {
    return load().patients.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function patientVisits(patientId) {
    const data = load();
    const queues = data.queues.filter((queue) => queue.patientId === patientId);
    return queues.map((queue) => {
      const exam = data.exams.find((item) => item.queueId === queue.id);
      const bill = exam ? data.bills.find((item) => item.examinationId === exam.id) : null;
      return { queue: queue, exam: exam || null, bill: bill || null };
    }).sort((a, b) => new Date(b.queue.createdAt || b.queue.tanggal) - new Date(a.queue.createdAt || a.queue.tanggal));
  }

  /* ------------------------------------------------------------------------
     Antrean
     ------------------------------------------------------------------------ */
  function queueById(id) {
    return load().queues.find((queue) => queue.id === id);
  }

  function queues(filter) {
    const opts = filter || {};
    let list = load().queues.slice();
    if (opts.date) list = list.filter((queue) => queue.tanggal === opts.date);
    if (opts.poli) list = list.filter((queue) => queue.poli === opts.poli);
    if (opts.status) {
      if (Array.isArray(opts.status)) list = list.filter((queue) => opts.status.includes(queue.status));
      else list = list.filter((queue) => queue.status === opts.status);
    }
    list.sort((a, b) => {
      if (a.tanggal !== b.tanggal) return a.tanggal < b.tanggal ? 1 : -1;
      const priorityDiff = Number(b.prioritas) - Number(a.prioritas);
      if (priorityDiff) return priorityDiff;
      return a.nomor - b.nomor;
    });
    return list;
  }

  function nextQueueNumberFor(day, poli) {
    const data = load();
    const existing = data.queues.filter((queue) => queue.tanggal === day && queue.poli === poli);
    return existing.reduce((max, queue) => Math.max(max, Number(queue.nomor) || 0), 0) + 1;
  }

  function createQueue(patientId, poli, prioritas, alasanPrioritas) {
    const actor = requireUser();
    const data = load();
    const patient = data.patients.find((item) => item.id === patientId);
    if (!can('queue.manage') && !(actor.role === 'pasien' && patient && patient.akunId === actor.id)) {
      throw new Error('Anda hanya boleh membuat antrean untuk diri sendiri.');
    }
    if (!patient) throw new Error('Pilih pasien yang valid.');
    const poliIdValue = poliId(poli);
    const today = dateKey();
    const duplicate = data.queues.find((queue) => queue.patientId === patientId && queue.tanggal === today && ['menunggu', 'dipanggil', 'dilayani'].includes(queue.status));
    if (duplicate) throw new Error('Pasien sudah memiliki antrean aktif hari ini (' + duplicate.kode + ').');
    const nomor = nextQueueNumberFor(today, poliIdValue);
    const poliData = getPoli(poliIdValue);
    const queue = {
      id: uid('q'),
      nomor: nomor,
      kode: poliData.kode + '-' + pad(nomor, 3),
      tanggal: today,
      patientId: patient.id,
      poli: poliIdValue,
      prioritas: Boolean(prioritas),
      alasanPrioritas: prioritas ? (alasanPrioritas || 'Prioritas khusus') : null,
      status: 'menunggu',
      createdAt: nowIso(),
      calledAt: null,
      startedAt: null,
      finishedAt: null,
      cancelledAt: null,
      alasanBatal: null,
      createdBy: actor.id
    };
    data.queues.push(queue);
    commit('queue.create', 'Antrean', 'Mendaftarkan antrean ' + queue.kode + ' untuk ' + patient.nama, { queueId: queue.id, patientId: patient.id });
    return queue;
  }

  function updateQueueStatus(id, status, options) {
    const actor = requireUser();
    const data = load();
    const queue = data.queues.find((item) => item.id === id);
    const ownCancellation = actor.role === 'pasien' && status === 'batal' && queue &&
      data.patients.some((p) => p.id === queue.patientId && p.akunId === actor.id) && queue.status === 'menunggu';
    if (!can('queue.manage') && !ownCancellation) throw new Error('Anda tidak dapat mengubah status antrean ini.');
    if (!queue) throw new Error('Antrean tidak ditemukan.');
    if (!STATUS_META[status]) throw new Error('Status antrean tidak valid.');
    if (['selesai', 'batal'].includes(queue.status)) throw new Error('Antrean yang sudah selesai atau dibatalkan tidak dapat diubah.');
    const patient = patientById(queue.patientId);
    const now = nowIso();
    if (status === 'dipanggil') {
      queue.calledAt = now;
      queue.status = 'dipanggil';
    } else if (status === 'dilayani') {
      if (!queue.calledAt) queue.calledAt = now;
      queue.startedAt = now;
      queue.status = 'dilayani';
    } else if (status === 'selesai') {
      if (!queue.calledAt) queue.calledAt = now;
      if (!queue.startedAt) queue.startedAt = now;
      queue.finishedAt = now;
      queue.status = 'selesai';
    } else if (status === 'batal') {
      if (!can('queue.cancel') && !ownCancellation) throw new Error('Anda tidak memiliki akses membatalkan antrean.');
      queue.cancelledAt = now;
      queue.alasanBatal = (options && options.reason) || 'Dibatalkan oleh petugas';
      queue.status = 'batal';
    } else if (status === 'menunggu') {
      queue.status = 'menunggu';
    }
    commit('queue.' + status, 'Antrean', 'Mengubah antrean ' + queue.kode + ' (' + (patient ? patient.nama : 'Pasien') + ') menjadi ' + STATUS_META[status].label, { queueId: queue.id });
    return queue;
  }

  function cancelQueue(id, reason) {
    return updateQueueStatus(id, 'batal', { reason: reason || 'Dibatalkan oleh petugas' });
  }

  function callNextQueue(poliFilter) {
    const actor = requireUser();
    if (!can('queue.manage')) throw new Error('Anda tidak memiliki akses memanggil antrean.');
    const data = load();
    const today = dateKey();
    let candidates = data.queues.filter((queue) => queue.tanggal === today && queue.status === 'menunggu');
    if (poliFilter) candidates = candidates.filter((queue) => queue.poli === poliFilter);
    if (!candidates.length) throw new Error('Tidak ada pasien dalam daftar tunggu saat ini.');
    candidates.sort((a, b) => {
      if (Boolean(b.prioritas) !== Boolean(a.prioritas)) return Number(b.prioritas) - Number(a.prioritas);
      return a.nomor - b.nomor;
    });
    const queue = candidates[0];
    queue.status = 'dipanggil';
    queue.calledAt = nowIso();
    const patient = data.patients.find((item) => item.id === queue.patientId);
    commit('queue.call', 'Antrean', 'Memanggil antrean ' + queue.kode + ' (' + (patient ? patient.nama : 'Pasien') + ') ke ' + getPoli(queue.poli).nama, { queueId: queue.id }, actor);
    return queue;
  }

  function waitingEstimate(queue) {
    if (!queue) return 0;
    if (['dipanggil', 'dilayani', 'selesai', 'batal'].includes(queue.status)) return 0;
    const data = load();
    const waiting = data.queues.filter((item) =>
      item.tanggal === queue.tanggal &&
      item.poli === queue.poli &&
      item.status === 'menunggu' &&
      (item.id !== queue.id)
    );
    const ahead = waiting.filter((item) => {
      if (Boolean(item.prioritas) !== Boolean(queue.prioritas)) return Boolean(item.prioritas);
      return item.nomor < queue.nomor;
    }).length;
    return Math.max(5, (ahead + 1) * 12);
  }

  /* ------------------------------------------------------------------------
     Pemeriksaan & rekam medis
     ------------------------------------------------------------------------ */
  function exams() {
    return load().exams.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function examById(id) {
    return load().exams.find((exam) => exam.id === id);
  }

  function examForQueue(queueId) {
    return load().exams.find((exam) => exam.queueId === queueId);
  }

  function nextExamNumberFor(day) {
    const data = load();
    const prefix = 'EMR-' + day.replace(/-/g, '') + '-';
    const max = data.exams.filter((exam) => exam.noPemeriksaan && exam.noPemeriksaan.startsWith(prefix))
      .reduce((value, exam) => Math.max(value, Number(exam.noPemeriksaan.slice(-3)) || 0), 0);
    return prefix + pad(max + 1, 3);
  }

  function startExam(queueId) {
    const actor = requireUser();
    if (!can('exam.manage') && !can('vitals.manage')) throw new Error('Anda tidak memiliki akses memulai pemeriksaan.');
    const data = load();
    const queue = data.queues.find((item) => item.id === queueId);
    if (!queue) throw new Error('Antrean tidak ditemukan.');
    const existing = data.exams.find((exam) => exam.queueId === queueId);
    if (existing) {
      if (existing.status === 'draft' && queue.status !== 'dilayani') {
        queue.status = 'dilayani';
        if (!queue.calledAt) queue.calledAt = nowIso();
        queue.startedAt = queue.startedAt || nowIso();
        persist();
      }
      return existing;
    }
    const doctor = actor.role === 'dokter' ? actor : (data.users.find((user) => user.role === 'dokter' && user.active && user.poli === queue.poli) || data.users.find((user) => user.role === 'dokter' && user.active));
    const exam = {
      id: uid('exam'),
      noPemeriksaan: nextExamNumberFor(queue.tanggal || dateKey()),
      queueId: queue.id,
      patientId: queue.patientId,
      dokterId: doctor ? doctor.id : actor.id,
      poli: queue.poli,
      tanggal: queue.tanggal || dateKey(),
      status: 'draft',
      keluhan: '',
      riwayatAlergi: 'Tidak ada riwayat alergi obat yang diketahui.',
      pemeriksaanFisik: {
        tekananDarah: '', nadi: '', suhu: '', respirasi: '', beratBadan: '', tinggiBadan: '', spo2: '', catatanFisik: ''
      },
      diagnosis: '',
      kodeICD10: '',
      diagnosisSekunder: '',
      tindakan: '',
      catatanDokter: '',
      rujukan: null,
      kontrolUlang: '',
      resep: [],
      resepStatus: null,
      dispensedAt: null,
      dispensedBy: null,
      createdAt: nowIso(),
      completedAt: null,
      updatedAt: nowIso(),
      createdBy: actor.id
    };
    data.exams.push(exam);
    queue.status = 'dilayani';
    if (!queue.calledAt) queue.calledAt = nowIso();
    queue.startedAt = queue.startedAt || nowIso();
    const patient = data.patients.find((item) => item.id === queue.patientId);
    commit('exam.start', 'Pemeriksaan', 'Memulai pemeriksaan untuk ' + (patient ? patient.nama : 'pasien') + ' (' + queue.kode + ')', { examId: exam.id, queueId: queue.id }, actor);
    return exam;
  }

  function normalizePhysical(payload) {
    const source = payload || {};
    return {
      tekananDarah: String(source.tekananDarah || '').trim(),
      nadi: String(source.nadi || '').trim(),
      suhu: String(source.suhu || '').trim(),
      respirasi: String(source.respirasi || '').trim(),
      beratBadan: String(source.beratBadan || '').trim(),
      tinggiBadan: String(source.tinggiBadan || '').trim(),
      spo2: String(source.spo2 || '').trim(),
      catatanFisik: String(source.catatanFisik || '').trim()
    };
  }

  function normalizePrescription(items) {
    const data = load();
    return (items || []).map((item) => {
      const medicine = data.medicines.find((med) => med.id === item.medicineId);
      if (!medicine) throw new Error('Obat pada resep tidak ditemukan.');
      const jumlah = Number(item.jumlah);
      if (!Number.isFinite(jumlah) || jumlah <= 0) throw new Error('Jumlah obat harus lebih dari 0.');
      return {
        medicineId: medicine.id,
        nama: medicine.nama,
        satuan: medicine.satuan,
        harga: Number(medicine.harga) || 0,
        jumlah: jumlah,
        aturan: String(item.aturan || '').trim() || 'Sesuai petunjuk dokter',
        diserahkan: Boolean(item.diserahkan)
      };
    });
  }

  function applyExamPayload(exam, payload) {
    exam.pemeriksaanFisik = normalizePhysical(payload.pemeriksaanFisik);
    if (payload.keluhan !== undefined) exam.keluhan = String(payload.keluhan || '').trim();
    if (payload.riwayatAlergi !== undefined) exam.riwayatAlergi = String(payload.riwayatAlergi || '').trim();
    if (payload.diagnosis !== undefined) exam.diagnosis = String(payload.diagnosis || '').trim();
    if (payload.kodeICD10 !== undefined) exam.kodeICD10 = String(payload.kodeICD10 || '').trim();
    if (payload.diagnosisSekunder !== undefined) exam.diagnosisSekunder = String(payload.diagnosisSekunder || '').trim();
    if (payload.tindakan !== undefined) exam.tindakan = String(payload.tindakan || '').trim();
    if (payload.catatanDokter !== undefined) exam.catatanDokter = String(payload.catatanDokter || '').trim();
    if (payload.kontrolUlang !== undefined) exam.kontrolUlang = String(payload.kontrolUlang || '');
    if (payload.resep !== undefined) exam.resep = normalizePrescription(payload.resep);
    if (payload.rujukan !== undefined) {
      const rujukan = payload.rujukan;
      exam.rujukan = rujukan && (rujukan.tujuan || rujukan.alasan) ? {
        tujuan: String(rujukan.tujuan || '').trim(),
        alasan: String(rujukan.alasan || '').trim(),
        tanggal: String(rujukan.tanggal || dateKey())
      } : null;
    }
    exam.updatedAt = nowIso();
  }

  function saveExamDraft(id, payload) {
    const actor = requireUser();
    if (!can('exam.manage')) throw new Error('Anda tidak memiliki akses menyimpan pemeriksaan.');
    const data = load();
    const exam = data.exams.find((item) => item.id === id);
    if (!exam) throw new Error('Pemeriksaan tidak ditemukan.');
    if (exam.status !== 'draft') throw new Error('Pemeriksaan yang sudah selesai tidak dapat diubah.');
    applyExamPayload(exam, payload);
    const patient = patientById(exam.patientId);
    commit('exam.draft', 'Pemeriksaan', 'Menyimpan draf pemeriksaan ' + exam.noPemeriksaan + ' — ' + (patient ? patient.nama : 'Pasien'), { examId: exam.id }, actor);
    return exam;
  }

  function saveVitals(id, payload) {
    const actor = requireUser();
    if (!can('vitals.manage')) throw new Error('Anda tidak memiliki akses menyimpan tanda vital.');
    const data = load();
    const exam = data.exams.find((item) => item.id === id);
    if (!exam) throw new Error('Pemeriksaan tidak ditemukan.');
    if (exam.status !== 'draft') throw new Error('Tanda vital pemeriksaan yang sudah selesai tidak dapat diubah.');
    exam.pemeriksaanFisik = normalizePhysical(payload.pemeriksaanFisik);
    if (payload.keluhan !== undefined && !exam.keluhan) exam.keluhan = String(payload.keluhan || '').trim();
    exam.updatedAt = nowIso();
    const patient = patientById(exam.patientId);
    commit('exam.vitals', 'Pemeriksaan', 'Menyimpan tanda vital ' + (patient ? patient.nama : 'pasien') + ' (' + exam.noPemeriksaan + ')', { examId: exam.id }, actor);
    return exam;
  }

  function buildBillItemsForExam(exam) {
    const data = load();
    const patient = patientById(exam.patientId);
    const poli = exam.poli;
    const consultation = data.tariffs.find((tariff) => tariff.aktif && tariff.kategori === 'Konsultasi' && tariff.poli === poli) ||
      data.tariffs.find((tariff) => tariff.aktif && tariff.kategori === 'Konsultasi');
    const admin = data.tariffs.find((tariff) => tariff.aktif && tariff.kode === 'TRF-003');
    const items = [];
    if (consultation) {
      items.push({ id: uid('bi'), tipe: 'konsultasi', label: consultation.nama, qty: 1, harga: consultation.tarif, total: consultation.tarif, tarifId: consultation.id });
    }
    if (admin) {
      items.push({ id: uid('bi'), tipe: 'layanan', label: admin.nama, qty: 1, harga: admin.tarif, total: admin.tarif, tarifId: admin.id });
    }
    (exam.resep || []).forEach((item) => {
      items.push({
        id: uid('bi'),
        tipe: 'obat',
        label: 'Obat · ' + item.nama,
        qty: Number(item.jumlah) || 1,
        harga: Number(item.harga) || 0,
        total: (Number(item.jumlah) || 1) * (Number(item.harga) || 0),
        medicineId: item.medicineId
      });
    });
    return items;
  }

  function nextBillNumberFor(day) {
    const data = load();
    const prefix = 'INV-' + day.replace(/-/g, '') + '-';
    const max = data.bills.filter((bill) => bill.noBill && bill.noBill.startsWith(prefix))
      .reduce((value, bill) => Math.max(value, Number(bill.noBill.slice(-3)) || 0), 0);
    return prefix + pad(max + 1, 3);
  }

  function createBillForExamInternal(exam, actor) {
    const data = load();
    const existing = data.bills.find((bill) => bill.examinationId === exam.id);
    if (existing) return existing;
    const patient = patientById(exam.patientId);
    if (!patient) throw new Error('Pasien tidak ditemukan.');
    const items = buildBillItemsForExam(exam);
    const subtotal = items.reduce((total, item) => total + item.total, 0);
    const isBPJS = patient.jenisKepersertaan === 'BPJS';
    const bill = {
      id: uid('bill'),
      noBill: nextBillNumberFor(dateKey()),
      patientId: patient.id,
      examinationId: exam.id,
      poli: exam.poli,
      tanggal: dateKey(),
      items: items,
      subtotal: subtotal,
      diskon: 0,
      total: subtotal,
      penjamin: isBPJS ? 'BPJS' : 'Umum',
      status: 'belum',
      metode: null,
      jumlahBayar: 0,
      kembalian: 0,
      paidAt: null,
      kasirId: null,
      verification: isBPJS ? { status: 'belum', noSEP: '', verifiedAt: null, verifiedBy: null } : null,
      createdAt: nowIso(),
      createdBy: actor ? actor.id : null
    };
    data.bills.push(bill);
    return bill;
  }

  function completeExam(id, payload) {
    const actor = requireUser();
    if (!can('exam.manage')) throw new Error('Anda tidak memiliki akses menyelesaikan pemeriksaan.');
    const data = load();
    const exam = data.exams.find((item) => item.id === id);
    if (!exam) throw new Error('Pemeriksaan tidak ditemukan.');
    if (exam.status !== 'draft') throw new Error('Pemeriksaan ini sudah diselesaikan.');
    applyExamPayload(exam, payload);
    if (!exam.keluhan) throw new Error('Keluhan pasien wajib diisi sebelum menyelesaikan pemeriksaan.');
    if (!exam.diagnosis) throw new Error('Diagnosis utama wajib diisi sebelum menyelesaikan pemeriksaan.');
    if (exam.rujukan && !exam.rujukan.tujuan) throw new Error('Tujuan rujukan wajib diisi jika pemeriksaan dirujuk.');
    exam.status = 'selesai';
    exam.completedAt = nowIso();
    exam.updatedAt = nowIso();
    if (exam.resep.length) {
      exam.resepStatus = 'menunggu';
      exam.resep.forEach((item) => { item.diserahkan = false; });
      exam.dispensedAt = null;
      exam.dispensedBy = null;
    } else {
      exam.resepStatus = null;
    }
    const queue = data.queues.find((item) => item.id === exam.queueId);
    if (queue) {
      if (!queue.calledAt) queue.calledAt = exam.createdAt;
      if (!queue.startedAt) queue.startedAt = exam.createdAt;
      queue.status = 'selesai';
      queue.finishedAt = nowIso();
    }
    const bill = createBillForExamInternal(exam, actor);
    const patient = patientById(exam.patientId);
    commit('exam.complete', 'Pemeriksaan', 'Menyelesaikan pemeriksaan ' + exam.noPemeriksaan + ' — ' + (patient ? patient.nama : 'Pasien'), { examId: exam.id, billId: bill.id }, actor);
    return { exam: exam, bill: bill };
  }

  /* ------------------------------------------------------------------------
     Farmasi
     ------------------------------------------------------------------------ */
  function medicines() {
    return load().medicines.slice().sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  }

  function medicineById(id) {
    return load().medicines.find((medicine) => medicine.id === id);
  }

  function saveMedicine(payload, id) {
    const actor = requireUser();
    if (!can('pharmacy.manage')) throw new Error('Anda tidak memiliki akses mengelola data obat.');
    const data = load();
    if (!String(payload.nama || '').trim()) throw new Error('Nama obat wajib diisi.');
    if (!String(payload.kategori || '').trim()) throw new Error('Kategori obat wajib diisi.');
    if (!String(payload.satuan || '').trim()) throw new Error('Satuan obat wajib diisi.');
    if (!(Number(payload.harga) >= 0)) throw new Error('Harga obat tidak valid.');
    if (!(Number(payload.stokMinimum) >= 0)) throw new Error('Stok minimum tidak valid.');
    if (!payload.kadaluarsa) throw new Error('Tanggal kedaluwarsa wajib diisi.');
    const initialStock = Math.max(0, Number(payload.stok) || 0);
    if (id) {
      const medicine = data.medicines.find((item) => item.id === id);
      if (!medicine) throw new Error('Data obat tidak ditemukan.');
      Object.assign(medicine, {
        nama: String(payload.nama).trim(),
        kategori: String(payload.kategori).trim(),
        satuan: String(payload.satuan).trim(),
        stokMinimum: Number(payload.stokMinimum) || 0,
        harga: Number(payload.harga) || 0,
        batch: String(payload.batch || '').trim(),
        kadaluarsa: payload.kadaluarsa,
        lokasi: String(payload.lokasi || '').trim(),
        aktif: payload.aktif !== false
      });
      commit('medicine.update', 'Farmasi', 'Memperbarui data obat ' + medicine.nama, { medicineId: medicine.id }, actor);
      return medicine;
    }
    const sequential = data.medicines.reduce((max, medicine) => {
      const match = /OBT-(\d+)/.exec(medicine.kode || '');
      return Math.max(max, match ? Number(match[1]) : 0);
    }, 0) + 1;
    const medicine = {
      id: uid('med'),
      kode: payload.kode && String(payload.kode).trim() ? String(payload.kode).trim().toUpperCase() : 'OBT-' + pad(sequential, 3),
      nama: String(payload.nama).trim(),
      kategori: String(payload.kategori).trim(),
      satuan: String(payload.satuan).trim(),
      stok: initialStock,
      stokMinimum: Number(payload.stokMinimum) || 0,
      harga: Number(payload.harga) || 0,
      batch: String(payload.batch || '').trim(),
      kadaluarsa: payload.kadaluarsa,
      lokasi: String(payload.lokasi || '').trim(),
      aktif: payload.aktif !== false,
      createdAt: nowIso()
    };
    data.medicines.push(medicine);
    if (initialStock > 0) {
      data.mutations.unshift({
        id: uid('mut'),
        medicineId: medicine.id,
        tipe: 'masuk',
        jumlah: initialStock,
        stokSebelum: 0,
        stokSesudah: initialStock,
        catatan: 'Stok awal obat baru',
        referensi: 'STOK-AWAL',
        supplier: String(payload.supplier || '').trim(),
        batch: medicine.batch,
        kadaluarsa: medicine.kadaluarsa,
        createdAt: nowIso(),
        userId: actor.id,
        userName: actor.name
      });
    }
    commit('medicine.create', 'Farmasi', 'Menambahkan obat baru ' + medicine.nama, { medicineId: medicine.id }, actor);
    return medicine;
  }

  function stockMutation(medicine, type, quantity, payload, actor) {
    const before = Number(medicine.stok) || 0;
    let after = before;
    if (type === 'masuk') after = before + quantity;
    if (type === 'keluar') after = before - quantity;
    medicine.stok = after;
    if (payload && payload.batch) medicine.batch = String(payload.batch).trim();
    if (payload && payload.kadaluarsa) medicine.kadaluarsa = payload.kadaluarsa;
    const mutation = {
      id: uid('mut'),
      medicineId: medicine.id,
      tipe: type,
      jumlah: quantity,
      stokSebelum: before,
      stokSesudah: after,
      catatan: String((payload && payload.catatan) || '').trim() || (type === 'masuk' ? 'Penerimaan stok obat' : 'Pengeluaran stok obat'),
      referensi: String((payload && payload.referensi) || '').trim() || (type === 'masuk' ? 'TERIMA' : 'KELUAR'),
      supplier: String((payload && payload.supplier) || '').trim(),
      batch: (payload && payload.batch) || medicine.batch,
      kadaluarsa: (payload && payload.kadaluarsa) || medicine.kadaluarsa,
      createdAt: nowIso(),
      userId: actor.id,
      userName: actor.name
    };
    load().mutations.unshift(mutation);
    return mutation;
  }

  function addStock(medicineId, payload) {
    const actor = requireUser();
    if (!can('pharmacy.manage')) throw new Error('Anda tidak memiliki akses penerimaan obat.');
    const medicine = medicineById(medicineId);
    if (!medicine) throw new Error('Obat tidak ditemukan.');
    const quantity = Number(payload.jumlah);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Jumlah penerimaan harus lebih dari 0.');
    if (!payload.kadaluarsa) throw new Error('Tanggal kedaluwarsa batch wajib diisi.');
    stockMutation(medicine, 'masuk', quantity, payload, actor);
    commit('stock.receive', 'Farmasi', 'Menerima ' + quantity + ' ' + medicine.satuan + ' ' + medicine.nama, { medicineId: medicine.id, jumlah: quantity, supplier: payload.supplier || '' }, actor);
    return medicine;
  }

  function removeStock(medicineId, payload) {
    const actor = requireUser();
    if (!can('pharmacy.manage')) throw new Error('Anda tidak memiliki akses pengeluaran obat.');
    const medicine = medicineById(medicineId);
    if (!medicine) throw new Error('Obat tidak ditemukan.');
    const quantity = Number(payload.jumlah);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Jumlah pengeluaran harus lebih dari 0.');
    if (quantity > medicine.stok) throw new Error('Jumlah pengeluaran melebihi stok tersedia (' + medicine.stok + ' ' + medicine.satuan + ').');
    stockMutation(medicine, 'keluar', quantity, payload, actor);
    commit('stock.issue', 'Farmasi', 'Mengeluarkan ' + quantity + ' ' + medicine.satuan + ' ' + medicine.nama + ' (' + (payload.catatan || 'penyesuaian') + ')', { medicineId: medicine.id, jumlah: quantity }, actor);
    return medicine;
  }

  function mutations() {
    return load().mutations.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function pendingPrescriptions() {
    return exams().filter((exam) => exam.status === 'selesai' && exam.resep && exam.resep.length && exam.resepStatus === 'menunggu');
  }

  function dispensedPrescriptions() {
    return exams().filter((exam) => exam.status === 'selesai' && exam.resep && exam.resep.length && exam.resepStatus === 'diserahkan');
  }

  function dispensePrescription(examId) {
    const actor = requireUser();
    if (!can('prescription.dispense') && !can('pharmacy.manage')) throw new Error('Anda tidak memiliki akses menyerahkan obat.');
    const data = load();
    const exam = data.exams.find((item) => item.id === examId);
    if (!exam) throw new Error('Resep tidak ditemukan.');
    if (exam.status !== 'selesai' || !exam.resep || !exam.resep.length) throw new Error('Resep ini tidak dapat diserahkan.');
    if (exam.resepStatus === 'diserahkan') throw new Error('Resep ini sudah diserahkan sebelumnya.');
    const patient = patientById(exam.patientId);
    const today = dateKey();
    const problems = [];
    exam.resep.forEach((item) => {
      const medicine = medicineById(item.medicineId);
      if (!medicine) {
        problems.push(item.nama + ' tidak ditemukan dalam master obat');
        return;
      }
      if (medicine.kadaluarsa && medicine.kadaluarsa < today) problems.push(medicine.nama + ' sudah kedaluwarsa');
      if (Number(medicine.stok) < Number(item.jumlah)) problems.push(medicine.nama + ' stok tidak cukup (tersedia ' + medicine.stok + ', dibutuhkan ' + item.jumlah + ')');
    });
    if (problems.length) throw new Error(problems.join('. ') + '.');
    exam.resep.forEach((item) => {
      const medicine = medicineById(item.medicineId);
      const mutation = stockMutation(medicine, 'keluar', Number(item.jumlah), {
        catatan: 'Penyerahan resep untuk ' + (patient ? patient.nama : 'pasien'),
        referensi: exam.noPemeriksaan
      }, actor);
      item.diserahkan = true;
      item.mutationId = mutation.id;
    });
    exam.resepStatus = 'diserahkan';
    exam.dispensedAt = nowIso();
    exam.dispensedBy = actor.id;
    commit('prescription.dispense', 'Farmasi', 'Menyerahkan ' + exam.resep.length + ' jenis obat untuk resep ' + exam.noPemeriksaan + ' — ' + (patient ? patient.nama : 'Pasien'), { examId: exam.id }, actor);
    return exam;
  }

  /* ------------------------------------------------------------------------
     Tarif, tagihan, dan pembayaran
     ------------------------------------------------------------------------ */
  function tariffs() {
    return load().tariffs.slice().sort((a, b) => {
      if (a.kategori !== b.kategori) return a.kategori.localeCompare(b.kategori, 'id');
      return a.nama.localeCompare(b.nama, 'id');
    });
  }

  function saveTariff(payload, id) {
    const actor = requireUser();
    if (!can('tariff.manage')) throw new Error('Anda tidak memiliki akses mengelola tarif.');
    const data = load();
    if (!String(payload.nama || '').trim()) throw new Error('Nama layanan wajib diisi.');
    if (!String(payload.kategori || '').trim()) throw new Error('Kategori layanan wajib diisi.');
    if (!(Number(payload.tarif) >= 0)) throw new Error('Nominal tarif tidak valid.');
    if (id) {
      const tariff = data.tariffs.find((item) => item.id === id);
      if (!tariff) throw new Error('Tarif tidak ditemukan.');
      Object.assign(tariff, {
        nama: String(payload.nama).trim(),
        kategori: String(payload.kategori).trim(),
        tarif: Number(payload.tarif) || 0,
        poli: payload.poli ? poliId(payload.poli) : null,
        aktif: payload.aktif !== false
      });
      commit('tariff.update', 'Pembayaran', 'Memperbarui tarif ' + tariff.nama, { tariffId: tariff.id }, actor);
      return tariff;
    }
    const sequential = data.tariffs.reduce((max, tariff) => {
      const match = /TRF-(\d+)/.exec(tariff.kode || '');
      return Math.max(max, match ? Number(match[1]) : 0);
    }, 0) + 1;
    const tariff = {
      id: uid('tariff'),
      kode: 'TRF-' + pad(sequential, 3),
      nama: String(payload.nama).trim(),
      kategori: String(payload.kategori).trim(),
      tarif: Number(payload.tarif) || 0,
      poli: payload.poli ? poliId(payload.poli) : null,
      aktif: payload.aktif !== false
    };
    data.tariffs.push(tariff);
    commit('tariff.create', 'Pembayaran', 'Menambahkan tarif layanan ' + tariff.nama, { tariffId: tariff.id }, actor);
    return tariff;
  }

  function toggleTariff(id) {
    const actor = requireUser();
    if (!can('tariff.manage')) throw new Error('Anda tidak memiliki akses mengubah status tarif.');
    const data = load();
    const tariff = data.tariffs.find((item) => item.id === id);
    if (!tariff) throw new Error('Tarif tidak ditemukan.');
    tariff.aktif = !tariff.aktif;
    commit('tariff.toggle', 'Pembayaran', (tariff.aktif ? 'Mengaktifkan' : 'Menonaktifkan') + ' tarif ' + tariff.nama, { tariffId: tariff.id }, actor);
    return tariff;
  }

  function bills() {
    return load().bills.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function billById(id) {
    return load().bills.find((bill) => bill.id === id);
  }

  function createManualBill(payload) {
    const actor = requireUser();
    if (!can('billing.manage')) throw new Error('Anda tidak memiliki akses membuat tagihan.');
    const data = load();
    const patient = data.patients.find((item) => item.id === payload.patientId);
    if (!patient) throw new Error('Pilih pasien yang valid.');
    if (!Array.isArray(payload.items) || !payload.items.length) throw new Error('Minimal satu item layanan harus ditambahkan.');
    const items = payload.items.map((item) => {
      const tariff = data.tariffs.find((tariffItem) => tariffItem.id === item.tarifId);
      if (!tariff) throw new Error('Item tarif tidak valid.');
      const qty = Number(item.qty) || 1;
      if (qty <= 0) throw new Error('Jumlah item harus lebih dari 0.');
      return {
        id: uid('bi'),
        tipe: 'layanan',
        label: tariff.nama,
        qty: qty,
        harga: tariff.tarif,
        total: tariff.tarif * qty,
        tarifId: tariff.id
      };
    });
    const subtotal = items.reduce((total, item) => total + item.total, 0);
    const isBPJS = payload.penjamin === 'BPJS' && patient.jenisKepersertaan === 'BPJS';
    const bill = {
      id: uid('bill'),
      noBill: nextBillNumberFor(dateKey()),
      patientId: patient.id,
      examinationId: null,
      poli: null,
      tanggal: dateKey(),
      items: items,
      subtotal: subtotal,
      diskon: 0,
      total: subtotal,
      penjamin: isBPJS ? 'BPJS' : 'Umum',
      status: 'belum',
      metode: null,
      jumlahBayar: 0,
      kembalian: 0,
      paidAt: null,
      kasirId: null,
      verification: isBPJS ? { status: 'belum', noSEP: '', verifiedAt: null, verifiedBy: null } : null,
      createdAt: nowIso(),
      createdBy: actor.id
    };
    data.bills.push(bill);
    commit('bill.create', 'Pembayaran', 'Membuat tagihan ' + bill.noBill + ' untuk ' + patient.nama, { billId: bill.id }, actor);
    return bill;
  }

  function addBillItem(billId, payload) {
    const actor = requireUser();
    if (!can('billing.manage')) throw new Error('Anda tidak memiliki akses menambah item tagihan.');
    const data = load();
    const bill = data.bills.find((item) => item.id === billId);
    if (!bill) throw new Error('Tagihan tidak ditemukan.');
    if (bill.status !== 'belum') throw new Error('Item pada tagihan yang sudah selesai tidak dapat diubah.');
    const tariff = data.tariffs.find((item) => item.id === payload.tarifId);
    if (!tariff) throw new Error('Pilih tarif layanan yang valid.');
    const qty = Number(payload.qty) || 1;
    if (qty <= 0) throw new Error('Jumlah layanan harus lebih dari 0.');
    bill.items.push({
      id: uid('bi'),
      tipe: 'layanan',
      label: tariff.nama,
      qty: qty,
      harga: tariff.tarif,
      total: tariff.tarif * qty,
      tarifId: tariff.id
    });
    bill.subtotal = bill.items.reduce((total, item) => total + item.total, 0);
    bill.total = bill.subtotal - (bill.diskon || 0);
    commit('bill.add-item', 'Pembayaran', 'Menambahkan layanan ' + tariff.nama + ' ke tagihan ' + bill.noBill, { billId: bill.id }, actor);
    return bill;
  }

  function removeBillItem(billId, itemId) {
    const actor = requireUser();
    if (!can('billing.manage')) throw new Error('Anda tidak memiliki akses menghapus item tagihan.');
    const data = load();
    const bill = data.bills.find((item) => item.id === billId);
    if (!bill) throw new Error('Tagihan tidak ditemukan.');
    if (bill.status !== 'belum') throw new Error('Item pada tagihan yang sudah selesai tidak dapat diubah.');
    if (bill.items.length <= 1) throw new Error('Tagihan harus memiliki minimal satu item.');
    bill.items = bill.items.filter((item) => item.id !== itemId);
    bill.subtotal = bill.items.reduce((total, item) => total + item.total, 0);
    bill.total = bill.subtotal - (bill.diskon || 0);
    commit('bill.remove-item', 'Pembayaran', 'Menghapus satu item dari tagihan ' + bill.noBill, { billId: bill.id }, actor);
    return bill;
  }

  function verifyBill(billId, payload) {
    const actor = requireUser();
    if (!can('billing.verify') && !can('billing.manage')) throw new Error('Anda tidak memiliki akses verifikasi penjaminan.');
    const data = load();
    const bill = data.bills.find((item) => item.id === billId);
    if (!bill) throw new Error('Tagihan tidak ditemukan.');
    if (bill.status !== 'belum') throw new Error('Tagihan ini sudah diselesaikan.');
    if (bill.penjamin !== 'BPJS') throw new Error('Tagihan ini bukan tagihan BPJS.');
    const patient = patientById(bill.patientId);
    if (!patient || patient.jenisKepersertaan !== 'BPJS') throw new Error('Pasien bukan peserta BPJS aktif.');
    const noBPJS = String(payload.noBPJS || patient.noBPJS || '').replace(/\s/g, '');
    if (!/^\d{13}$/.test(noBPJS)) throw new Error('Nomor kartu BPJS harus 13 digit.');
    const noSEP = String(payload.noSEP || '').trim() || 'SEP-' + dateKey().replace(/-/g, '') + '-' + Math.floor(Math.random() * 900 + 100);
    bill.verification = {
      status: 'terverifikasi',
      noBPJS: noBPJS,
      noSEP: noSEP,
      verifiedAt: nowIso(),
      verifiedBy: actor.id,
      catatan: String(payload.catatan || '').trim()
    };
    bill.status = 'ditanggung';
    bill.metode = 'BPJS';
    bill.paidAt = nowIso();
    bill.kasirId = actor.id;
    commit('bill.verify', 'Pembayaran', 'Memverifikasi penjaminan BPJS tagihan ' + bill.noBill + ' (' + (patient ? patient.nama : 'Pasien') + ')', { billId: bill.id, noSEP: noSEP }, actor);
    return bill;
  }

  function payBill(billId, payload) {
    const actor = requireUser();
    if (!can('billing.manage')) throw new Error('Anda tidak memiliki akses menerima pembayaran.');
    const data = load();
    const bill = data.bills.find((item) => item.id === billId);
    if (!bill) throw new Error('Tagihan tidak ditemukan.');
    if (bill.status !== 'belum') throw new Error('Tagihan ini sudah dibayar atau telah diselesaikan.');
    if (bill.penjamin === 'BPJS' && bill.verification && bill.verification.status !== 'terverifikasi') {
      throw new Error('Verifikasi penjaminan BPJS terlebih dahulu, atau ubah penjamin menjadi umum.');
    }
    const amount = Number(payload.jumlahBayar);
    if (!Number.isFinite(amount) || amount < bill.total) throw new Error('Nominal pembayaran kurang dari total tagihan.');
    if (!PAYMENT_METHODS.includes(payload.metode)) throw new Error('Metode pembayaran tidak valid.');
    bill.status = 'lunas';
    bill.metode = payload.metode;
    bill.jumlahBayar = amount;
    bill.kembalian = Math.max(0, amount - bill.total);
    bill.paidAt = nowIso();
    bill.kasirId = actor.id;
    commit('bill.pay', 'Pembayaran', 'Menerima pembayaran ' + bill.noBill + ' sebesar Rp' + bill.total.toLocaleString('id-ID') + ' (' + payload.metode + ')', { billId: bill.id }, actor);
    return bill;
  }

  function billForExam(examId) {
    return load().bills.find((bill) => bill.examinationId === examId);
  }

  function auditLog(filter) {
    const opts = filter || {};
    let list = load().audit.slice();
    if (opts.userId) list = list.filter((entry) => entry.userId === opts.userId);
    if (opts.module) list = list.filter((entry) => entry.module === opts.module);
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function stockAlerts() {
    const allMeds = medicines();
    return {
      low: allMeds.filter((medicine) => Number(medicine.stok) <= Number(medicine.stokMinimum) && Number(medicine.stok) > 0),
      out: allMeds.filter((medicine) => Number(medicine.stok) <= 0),
      expired: allMeds.filter((medicine) => medicine.kadaluarsa && medicine.kadaluarsa < dateKey()),
      expiring: allMeds.filter((medicine) => {
        const status = medicineStatus(medicine);
        return status.key === 'expiring';
      })
    };
  }

  function exportJSON() {
    return JSON.stringify(load(), null, 2);
  }

  function subscribe(listener) {
    listeners.push(listener);
    return function unsubscribe() {
      listeners = listeners.filter((item) => item !== listener);
    };
  }

  /* ------------------------------------------------------------------------
     Public API
     ------------------------------------------------------------------------ */
  NS.constants = {
    POLI: POLI,
    ROLE_META: ROLE_META,
    ROLE_ORDER: ROLE_ORDER,
    PAGES: PAGES,
    DEFAULT_ACCESS: DEFAULT_ACCESS,
    CAPABILITIES: CAPABILITIES,
    STATUS_META: STATUS_META,
    BILL_STATUS_META: BILL_STATUS_META,
    PARTICIPATION: PARTICIPATION,
    PAYMENT_METHODS: PAYMENT_METHODS,
    PRIORITY_REASONS: PRIORITY_REASONS,
    COMMON_DIAGNOSES: COMMON_DIAGNOSES,
    APP_VERSION: APP_VERSION,
    SPRINT: SPRINT
  };

  NS.core = {
    dateKey: dateKey,
    parseDate: parseDate,
    isoFor: isoFor,
    addDays: addDays,
    addDaysKey: addDaysKey,
    daysFromNow: daysFromNow,
    ageOf: ageOf,
    nowIso: nowIso,
    getPoli: getPoli,
    poliId: poliId,
    getRoleMeta: getRoleMeta,
    medicineStatus: medicineStatus,
    normalizePhone: normalizePhone
  };

  NS.store = {
    load: load,
    reload: reload,
    resetAll: resetAll,
    subscribe: subscribe,
    exportJSON: exportJSON,
    getSession: getSession,
    currentUser: currentUser,
    hasAccess: hasAccess,
    can: can,
    login: login,
    acceptServerUser: acceptServerUser,
    syncServerUsers: syncServerUsers,
    createOwnPatient: createOwnPatient,
    updateOwnPatient: updateOwnPatient,
    ownPatient: ownPatient,
    logout: logout,
    resetPasswordWithPhone: resetPasswordWithPhone,
    changeOwnPassword: changeOwnPassword,
    updateOwnProfile: updateOwnProfile,
    createUser: createUser,
    updateUser: updateUser,
    toggleUser: toggleUser,
    resetUserPassword: resetUserPassword,
    setRoleAccess: setRoleAccess,
    getAccessPages: getAccessPages,
    updateClinicSettings: updateClinicSettings,
    users: function () { return load().users.slice(); },
    nextRM: nextRM,
    createPatient: createPatient,
    updatePatient: updatePatient,
    patients: patients,
    patientById: patientById,
    patientVisits: patientVisits,
    queues: queues,
    queueById: queueById,
    nextQueueNumberFor: nextQueueNumberFor,
    createQueue: createQueue,
    updateQueueStatus: updateQueueStatus,
    cancelQueue: cancelQueue,
    callNextQueue: callNextQueue,
    waitingEstimate: waitingEstimate,
    exams: exams,
    examById: examById,
    examForQueue: examForQueue,
    startExam: startExam,
    saveExamDraft: saveExamDraft,
    saveVitals: saveVitals,
    completeExam: completeExam,
    medicines: medicines,
    medicineById: medicineById,
    saveMedicine: saveMedicine,
    addStock: addStock,
    removeStock: removeStock,
    mutations: mutations,
    pendingPrescriptions: pendingPrescriptions,
    dispensedPrescriptions: dispensedPrescriptions,
    dispensePrescription: dispensePrescription,
    stockAlerts: stockAlerts,
    tariffs: tariffs,
    saveTariff: saveTariff,
    toggleTariff: toggleTariff,
    bills: bills,
    billById: billById,
    billForExam: billForExam,
    createManualBill: createManualBill,
    addBillItem: addBillItem,
    removeBillItem: removeBillItem,
    payBill: payBill,
    verifyBill: verifyBill,
    auditLog: auditLog,
    get clinic() { return load().meta.clinic; },
    get meta() { return load().meta; }
  };

  /* Muat data saat pertama kali modul dijalankan. */
  load();
})(window);
