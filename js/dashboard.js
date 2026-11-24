/* ==========================================================================
   Sehat Bersama - Puskesmas Arbes — Dashboard adaptif per peran
   ========================================================================== */
(function (window) {
  'use strict';

  const NS = window.PK;
  const ui = NS.ui;
  const store = NS.store;
  const C = NS.constants;

  function dayKeyOffset(offset) {
    return NS.core.addDaysKey(NS.core.dateKey(), offset);
  }

  function sum(list, getter) {
    return (list || []).reduce(function (total, item) { return total + (Number(getter(item)) || 0); }, 0);
  }

  function countTrend(current, previous) {
    if (!previous && !current) return null;
    if (!previous) return { direction: 'up', label: 'Data baru' };
    const diff = Math.round(((current - previous) / previous) * 100);
    return { direction: diff < 0 ? 'down' : 'up', label: (diff > 0 ? '+' : '') + diff + '% vs 7 hari lalu' };
  }

  function revenuePaidOn(day, bills) {
    return sum((bills || []).filter(function (bill) {
      return bill.status === 'lunas' && bill.paidAt && NS.core.dateKey(new Date(bill.paidAt)) === day;
    }), function (bill) { return bill.total; });
  }

  function nextControl(exams) {
    const today = NS.core.dateKey();
    const limit = dayKeyOffset(7);
    return exams.filter(function (exam) {
      return exam.status === 'selesai' && exam.kontrolUlang && exam.kontrolUlang >= today && exam.kontrolUlang <= limit;
    }).sort(function (a, b) { return a.kontrolUlang < b.kontrolUlang ? -1 : 1; });
  }

  function getUserBadge(role) {
    return '<span class="hero-role">' + ui.icon('shield') + ui.esc(NS.core.getRoleMeta(role).label) + '</span>';
  }

  function quickActionsFor(user) {
    const actions = [];
    if (store.can('patient.manage')) {
      actions.push({ label: 'Daftarkan pasien', href: '#/pasien/baru', icon: 'user-plus', primary: true });
    }
    if (store.can('queue.manage')) {
      actions.push({ label: 'Kelola antrean', href: '#/antrean', icon: 'queue' });
    }
    if (store.can('exam.manage')) {
      actions.push({ label: 'Mulai pemeriksaan', href: '#/pemeriksaan', icon: 'stethoscope', primary: !actions.length });
    }
    if (store.can('vitals.manage') && !store.can('exam.manage')) {
      actions.push({ label: 'Input tanda vital', href: '#/pemeriksaan', icon: 'activity', primary: !actions.length });
    }
    if (store.can('pharmacy.manage')) {
      actions.push({ label: 'Resep masuk', href: '#/farmasi/resep', icon: 'pill', primary: !actions.length });
    }
    if (store.can('billing.manage')) {
      actions.push({ label: 'Buka tagihan', href: '#/pembayaran', icon: 'receipt', primary: !actions.length });
    }
    if (store.hasAccess('reports')) {
      actions.push({ label: 'Lihat laporan', href: '#/laporan', icon: 'chart' });
    }
    const defaults = { admin: [{ label: 'Pasien baru', href: '#/pasien/baru', icon: 'user-plus', primary: true }, { label: 'Kelola antrean', href: '#/antrean', icon: 'queue' }] };
    return (actions.length ? actions : (defaults[user.role] || [])).slice(0, 3);
  }

  function statsFor(user, data) {
    const today = NS.core.dateKey();
    const todayQueues = data.queues.filter(function (queue) { return queue.tanggal === today; });
    const activeQueues = todayQueues.filter(function (queue) { return ['menunggu', 'dipanggil', 'dilayani'].includes(queue.status); });
    const doneToday = todayQueues.filter(function (queue) { return queue.status === 'selesai'; });
    const todayBills = data.bills.filter(function (bill) { return bill.tanggal === today; });
    const paidToday = data.bills.filter(function (bill) { return bill.status === 'lunas' && bill.paidAt && NS.core.dateKey(new Date(bill.paidAt)) === today; });
    const revenue = sum(paidToday, function (bill) { return bill.total; });
    const pendingRx = store.pendingPrescriptions();
    const alerts = store.stockAlerts();
    const lowStock = alerts.low.length + alerts.out.length;
    const unpaid = data.bills.filter(function (bill) { return bill.status === 'belum'; });
    const bpjsPending = unpaid.filter(function (bill) { return bill.penjamin === 'BPJS'; });
    const dispensedToday = data.exams.filter(function (exam) { return exam.dispensedAt && NS.core.dateKey(new Date(exam.dispensedAt)) === today; });
    const myPoliQueues = user.role === 'dokter' && user.poli ? todayQueues.filter(function (queue) { return queue.poli === user.poli; }) : todayQueues;
    const myActive = myPoliQueues.filter(function (queue) { return ['menunggu', 'dipanggil', 'dilayani'].includes(queue.status); });
    const myDoneExams = data.exams.filter(function (exam) {
      return exam.status === 'selesai' && exam.tanggal === today && (user.role !== 'dokter' || !user.poli || exam.poli === user.poli);
    });
    const triagePending = activeQueues.filter(function (queue) {
      const exam = data.exams.find(function (item) { return item.queueId === queue.id; });
      return !exam || (exam.status === 'draft' && !exam.pemeriksaanFisik.tekananDarah && !exam.pemeriksaanFisik.suhu);
    });
    const newPatients = data.patients.filter(function (patient) { return patient.createdAt && NS.core.dateKey(new Date(patient.createdAt)) === today; });

    if (user.role === 'dokter') {
      return [
        { label: 'Pasien menunggu', value: myActive.length, icon: 'queue', tone: 'teal', hint: myActive.filter(function (q) { return q.status === 'menunggu'; }).length + ' belum dipanggil' },
        { label: 'Sudah diperiksa', value: myDoneExams.length, icon: 'stethoscope', tone: 'blue', hint: 'Pemeriksaan selesai hari ini' },
        { label: 'Resep menunggu', value: pendingRx.length, icon: 'pill', tone: 'amber', hint: 'Belum diserahkan farmasi' },
        { label: 'Kontrol ulang', value: nextControl(data.exams).length, icon: 'calendar', tone: 'violet', hint: 'Dalam 7 hari ke depan' }
      ];
    }
    if (user.role === 'perawat') {
      return [
        { label: 'Antrean menunggu', value: todayQueues.filter(function (q) { return q.status === 'menunggu'; }).length, icon: 'queue', tone: 'teal', hint: 'Termasuk antrean prioritas' },
        { label: 'Perlu asesmen awal', value: triagePending.length, icon: 'activity', tone: 'amber', hint: 'Belum ada tanda vital' },
        { label: 'Sedang dilayani', value: todayQueues.filter(function (q) { return q.status === 'dilayani'; }).length, icon: 'stethoscope', tone: 'blue', hint: 'Berada di ruang periksa' },
        { label: 'Selesai hari ini', value: doneToday.length, icon: 'check-circle', tone: 'green', hint: 'Kunjungan tuntas' }
      ];
    }
    if (user.role === 'farmasi') {
      return [
        { label: 'Resep menunggu', value: pendingRx.length, icon: 'pill', tone: 'amber', hint: 'Perlu disiapkan & diserahkan' },
        { label: 'Stok menipis', value: lowStock, icon: 'package', tone: 'rose', hint: alerts.out.length + ' obat stok habis' },
        { label: 'Kedaluwarsa', value: alerts.expired.length, icon: 'alert', tone: 'rose', hint: alerts.expiring.length + ' mendekati kedaluwarsa' },
        { label: 'Penyerahan hari ini', value: dispensedToday.length, icon: 'check-circle', tone: 'green', hint: 'Resep telah diserahkan' }
      ];
    }
    if (user.role === 'kasir') {
      return [
        { label: 'Tagihan belum dibayar', value: unpaid.length, icon: 'receipt', tone: 'amber', hint: ui.currency(sum(unpaid, function (bill) { return bill.total; })) + ' total tagihan' },
        { label: 'Transaksi hari ini', value: paidToday.length, icon: 'credit-card', tone: 'teal', hint: 'Pembayaran berhasil' },
        { label: 'Pendapatan hari ini', value: ui.currency(revenue), icon: 'wallet', tone: 'green', hint: 'Pembayaran tunai/non-tunai' },
        { label: 'Menunggu verifikasi', value: bpjsPending.length, icon: 'shield', tone: 'blue', hint: 'Tagihan penjaminan BPJS' }
      ];
    }
    if (user.role === 'pendaftaran') {
      return [
        { label: 'Kunjungan hari ini', value: todayQueues.length, icon: 'users', tone: 'teal', hint: newPatients.length + ' pasien baru terdaftar' },
        { label: 'Menunggu antrean', value: todayQueues.filter(function (q) { return q.status === 'menunggu'; }).length, icon: 'queue', tone: 'amber', hint: 'Belum dipanggil' },
        { label: 'Selesai dilayani', value: doneToday.length, icon: 'check-circle', tone: 'green', hint: 'Dari seluruh poli' },
        { label: 'Total pasien', value: data.patients.length, icon: 'user-check', tone: 'blue', hint: 'Terdaftar dalam sistem' }
      ];
    }
    return [
      { label: 'Kunjungan hari ini', value: todayQueues.length, icon: 'users', tone: 'teal', hint: activeQueues.length + ' antrean masih aktif', trend: countTrend(todayQueues.length, data.queues.filter(function (q) { return q.tanggal === dayKeyOffset(-1); }).length) },
      { label: 'Pendapatan hari ini', value: ui.currency(revenue), icon: 'wallet', tone: 'green', hint: todayBills.filter(function (b) { return b.status === 'ditanggung'; }).length + ' tagihan BPJS' },
      { label: 'Resep menunggu', value: pendingRx.length, icon: 'pill', tone: 'amber', hint: statsStockHelper(alerts) },
      { label: 'Tagihan belum bayar', value: unpaid.length, icon: 'receipt', tone: 'rose', hint: bpjsPending.length + ' menunggu verifikasi BPJS' }
    ];
  }

  function statsStockHelper(alerts) {
    const count = alerts.low.length + alerts.out.length;
    return count ? count + ' obat perlu perhatian stok' : 'Persediaan obat aman';
  }

  function activeQueueCard(user, data) {
    const today = NS.core.dateKey();
    let active = data.queues.filter(function (queue) {
      return queue.tanggal === today && ['menunggu', 'dipanggil', 'dilayani'].includes(queue.status);
    });
    if (user.role === 'dokter' && user.poli) active = active.filter(function (queue) { return queue.poli === user.poli; });
    active.sort(function (a, b) {
      if (Boolean(b.prioritas) !== Boolean(a.prioritas)) return Number(b.prioritas) - Number(a.prioritas);
      return a.nomor - b.nomor;
    });
    const shown = active.slice(0, 6);
    return '<section class="card dashboard-queue-card">' +
      ui.sectionHeader('Antrean saat ini', active.length + ' pasien dalam alur layanan', '<a href="#/antrean" class="btn btn-ghost btn-sm">Lihat semua ' + ui.icon('arrow-right') + '</a>', 'queue') +
      (shown.length ? '<div class="mini-queue-list">' + shown.map(function (queue) {
        const patient = store.patientById(queue.patientId);
        const exam = store.examForQueue(queue.id);
        const estimate = queue.status === 'menunggu' ? '± ' + store.waitingEstimate(queue) + ' mnt' : queue.status === 'dipanggil' ? 'Dipanggil' : 'Diperiksa';
        return '<div class="mini-queue">' +
          '<div class="queue-code ' + (queue.prioritas ? 'is-priority' : '') + '">' + ui.esc(queue.kode) + '</div>' +
          '<div class="mini-queue-copy">' +
            '<strong>' + ui.esc(patient ? patient.nama : 'Pasien') + '</strong>' +
            '<span>' + ui.esc(NS.core.getPoli(queue.poli).nama) + ' · ' + ui.esc(estimate) + '</span>' +
          '</div>' +
          '<div class="mini-queue-status">' + ui.statusBadge(queue.status) + (exam && exam.status === 'draft' ? '<small class="tiny-muted">asesmen awal</small>' : '') + '</div>' +
          '</div>';
      }).join('') + '</div>' : ui.emptyState('check-circle', 'Antrean sudah bersih', 'Tidak ada pasien yang menunggu saat ini.') ) +
      (store.can('queue.manage') && active.some(function (q) { return q.status === 'menunggu'; }) ?
        '<button type="button" class="btn btn-soft btn-block" id="dashboardCallNext" data-poli="' + ui.attr(user.role === 'dokter' && user.poli ? user.poli : '') + '">' + ui.icon('megaphone') + 'Panggil antrean berikutnya</button>' : '') +
      '</section>';
  }

  function poliBreakdown(data) {
    const since = dayKeyOffset(-6);
    const today = NS.core.dateKey();
    const poliStats = C.POLI.map(function (poli) {
      return {
        label: poli.singkat,
        color: poli.warna,
        value: data.queues.filter(function (queue) {
          return queue.tanggal >= since && queue.tanggal <= today && queue.status !== 'batal' && queue.poli === poli.id;
        }).length
      };
    }).filter(function (item) { return item.value > 0; });
    return '<section class="card">' +
      ui.sectionHeader('Komposisi poli', 'Kunjungan 7 hari terakhir', '<a href="#/laporan" class="text-link">Detail ' + ui.icon('arrow-up-right') + '</a>', 'activity') +
      ui.donutChart(poliStats, { size: 164, thickness: 15, centerLabel: 'Kunjungan', centerValue: poliStats.reduce(function (total, item) { return total + item.value; }, 0) }) +
      '</section>';
  }

  function tasksFor(user, data) {
    const today = NS.core.dateKey();
    const activeQs = data.queues.filter(function (q) { return q.tanggal === today && ['menunggu', 'dipanggil', 'dilayani'].includes(q.status); });
    const alerts = store.stockAlerts();
    const pendingRx = store.pendingPrescriptions();
    const unpaid = data.bills.filter(function (bill) { return bill.status === 'belum'; });
    const tasks = [];
    if (user.role === 'dokter') {
      const draftExams = data.exams.filter(function (exam) { return exam.status === 'draft' && (user.poli ? exam.poli === user.poli : true); });
      const controls = nextControl(data.exams);
      if (draftExams.length) tasks.push({ icon: 'clipboard', tone: 'amber', title: 'Selesaikan asesmen pasien', text: draftExams.length + ' rekam medis masih berstatus draf.', href: '#/pemeriksaan', action: 'Lanjutkan' });
      if (controls.length) tasks.push({ icon: 'calendar', tone: 'violet', title: 'Jadwal kontrol terdekat', text: (store.patientById(controls[0].patientId) || {}).nama + ' · ' + ui.fmtDate(controls[0].kontrolUlang, 'medium'), href: '#/pemeriksaan', action: 'Lihat jadwal' });
      if (pendingRx.length) tasks.push({ icon: 'pill', tone: 'blue', title: 'Resep menunggu farmasi', text: pendingRx.length + ' resep elektronik belum diserahkan.', href: '#/farmasi/resep', action: 'Lihat resep' });
      if (!tasks.length) tasks.push({ icon: 'check-circle', tone: 'green', title: 'Semua tugas terkendali', text: 'Tidak ada pemeriksaan draf atau kontrol mendesak.', href: '#/pemeriksaan', action: 'Buka pemeriksaan' });
    } else if (user.role === 'perawat') {
      const triage = activeQs.filter(function (queue) {
        const exam = data.exams.find(function (item) { return item.queueId === queue.id; });
        return !exam || (exam.status === 'draft' && !exam.pemeriksaanFisik.tekananDarah && !exam.pemeriksaanFisik.suhu);
      });
      const called = activeQs.filter(function (queue) { return queue.status === 'dipanggil'; });
      if (triage.length) tasks.push({ icon: 'activity', tone: 'amber', title: 'Asesmen awal diperlukan', text: triage.length + ' pasien belum memiliki catatan tanda vital.', href: '#/pemeriksaan', action: 'Input tanda vital' });
      if (called.length) tasks.push({ icon: 'megaphone', tone: 'blue', title: 'Antrean sedang dipanggil', text: called.map(function (q) { return q.kode; }).join(', ') + ' menuju ruang periksa.', href: '#/antrean', action: 'Buka antrean' });
      if (!tasks.length) tasks.push({ icon: 'check-circle', tone: 'green', title: 'Asesmen awal lengkap', text: 'Semua pasien aktif sudah memiliki tanda vital.', href: '#/antrean', action: 'Buka antrean' });
    } else if (user.role === 'pendaftaran') {
      tasks.push({ icon: 'user-plus', tone: 'teal', title: 'Registrasi pasien baru', text: 'Lengkapi NIK dan data kepesertaan pasien baru.', href: '#/pasien/baru', action: 'Daftarkan' });
      if (activeQs.length) tasks.push({ icon: 'queue', tone: 'blue', title: pendingRx.length ? pendingRx.length + ' resep perlu dipantau' : 'Antrean berjalan', text: activeQs.length + ' pasien dalam alur layanan hari ini.', href: '#/antrean', action: 'Kelola antrean' });
      if (!activeQs.length) tasks.push({ icon: 'check-circle', tone: 'green', title: 'Belum ada antrean aktif', text: 'Pasien dapat didaftarkan ke poli tujuan.', href: '#/antrean', action: 'Buka antrean' });
    } else if (user.role === 'farmasi') {
      if (pendingRx.length) tasks.push({ icon: 'pill', tone: 'amber', title: 'Resep menunggu diserahkan', text: pendingRx.length + ' resep sudah diperiksa dokter.', href: '#/farmasi/resep', action: 'Siapkan obat' });
      if (alerts.low.length + alerts.out.length) tasks.push({ icon: 'package', tone: 'rose', title: 'Stok perlu ditambah', text: alerts.low.length + ' menipis, ' + alerts.out.length + ' habis. Segera lakukan penerimaan.', href: '#/farmasi/obat', action: 'Kelola stok' });
      if (alerts.expiring.length + alerts.expired.length) tasks.push({ icon: 'alert', tone: 'violet', title: 'Periksa kedaluwarsa obat', text: alerts.expiring.length + ' mendekati kedaluwarsa, ' + alerts.expired.length + ' telah kedaluwarsa.', href: '#/farmasi/obat', action: 'Periksa obat' });
      if (!tasks.length) tasks.push({ icon: 'check-circle', tone: 'green', title: 'Persediaan aman', text: 'Tidak ada resep tertunda atau peringatan stok.', href: '#/farmasi', action: 'Buka farmasi' });
    } else if (user.role === 'kasir') {
      if (unpaid.length) tasks.push({ icon: 'receipt', tone: 'amber', title: 'Tagihan belum diselesaikan', text: unpaid.length + ' tagihan menunggu pembayaran atau verifikasi.', href: '#/pembayaran', action: 'Buka kasir' });
      const bpjs = unpaid.filter(function (bill) { return bill.penjamin === 'BPJS'; });
      if (bpjs.length) tasks.push({ icon: 'shield', tone: 'blue', title: 'Verifikasi penjaminan BPJS', text: bpjs.length + ' tagihan BPJS belum diverifikasi.', href: '#/pembayaran', action: 'Verifikasi' });
      tasks.push({ icon: 'file-text', tone: 'teal', title: 'Tarif layanan terbaru', text: 'Pastikan tarif sesuai kebijakan yang berlaku.', href: '#/tarif', action: 'Kelola tarif' });
    } else {
      if (pendingRx.length) tasks.push({ icon: 'pill', tone: 'amber', title: 'Resep menunggu', text: pendingRx.length + ' resep belum diserahkan.', href: '#/farmasi/resep', action: 'Lihat farmasi' });
      if (alerts.low.length + alerts.out.length) tasks.push({ icon: 'package', tone: 'rose', title: 'Peringatan stok obat', text: alerts.low.length + ' menipis, ' + alerts.out.length + ' habis.', href: '#/farmasi/obat', action: 'Kelola stok' });
      if (unpaid.length) tasks.push({ icon: 'receipt', tone: 'blue', title: 'Tagihan belum dibayar', text: unpaid.length + ' tagihan menunggu penyelesaian kasir.', href: '#/pembayaran', action: 'Buka kasir' });
      if (!tasks.length) tasks.push({ icon: 'check-circle', tone: 'green', title: 'Operasional berjalan baik', text: 'Tidak ada peringatan kritis saat ini.', href: '#/laporan', action: 'Lihat laporan' });
    }
    return '<section class="card">' +
      ui.sectionHeader('Tugas prioritas', 'Sesuai peran ' + ui.esc(NS.core.getRoleMeta(user.role).label.toLowerCase()), '', 'check-square') +
      '<div class="task-list">' + tasks.slice(0, 4).map(function (task) {
        return '<a class="task-item" href="' + ui.attr(task.href) + '">' +
          '<span class="task-icon task-icon-' + ui.attr(task.tone) + '">' + ui.icon(task.icon) + '</span>' +
          '<span class="task-copy"><strong>' + ui.esc(task.title) + '</strong><small>' + ui.esc(task.text) + '</small></span>' +
          '<span class="task-action">' + ui.esc(task.action) + ui.icon('chevron-right') + '</span>' +
          '</a>';
      }).join('') + '</div>' +
      '</section>';
  }

  function recentActivity() {
    const logs = store.auditLog().slice(0, 5);
    return '<section class="card">' +
      ui.sectionHeader('Aktivitas terbaru', 'Jejak audit operasional sistem', store.currentUser().role === 'admin' ? '<a href="#/pengguna" class="text-link">Lihat audit ' + ui.icon('arrow-up-right') + '</a>' : '', 'clock') +
      '<div class="activity-list">' + (logs.length ? logs.map(function (log) {
        const meta = NS.core.getRoleMeta(log.userRole);
        return '<div class="activity-item">' +
          '<span class="avatar avatar-xs" style="--avatar-tone:' + ui.attr(meta.color) + '">' + ui.esc(ui.initials(log.userName)) + '</span>' +
          '<div class="activity-copy"><p>' + ui.esc(log.description) + '</p><small>' + ui.esc(log.userName) + ' · ' + ui.esc(ui.relativeTime(log.createdAt)) + '</small></div>' +
          '</div>';
      }).join('') : ui.emptyState('clock', 'Belum ada aktivitas', 'Aktivitas pengguna akan muncul di sini.')) + '</div>' +
      '</section>';
  }

  function hero(user) {
    const date = new Date();
    const actions = quickActionsFor(user);
    const clinic = store.clinic;
    return '<section class="dashboard-hero">' +
      '<div class="hero-pattern" aria-hidden="true"><span class="hero-cross"></span><span class="hero-ring"></span><span class="hero-dot"></span></div>' +
      '<div class="hero-content">' +
        '<div class="hero-eyebrow">' + ui.icon('sun') + '<span>' + ui.esc(ui.fmtDate(date, 'full')) + '</span><span class="hero-separator"></span><span>' + ui.esc(clinic.jamOperasional) + '</span></div>' +
        '<h1>' + ui.esc(ui.getGreeting()) + ', <span>' + ui.esc(user.name.replace(/,.*$/, '')) + '</span></h1>' +
        '<p>' + ui.esc(clinic.motto) + '</p>' +
        '<div class="hero-actions">' +
          actions.map(function (action) {
            return '<a href="' + ui.attr(action.href) + '" class="btn ' + (action.primary ? 'btn-primary' : 'btn-ghost-light') + '">' + ui.icon(action.icon) + ui.esc(action.label) + '</a>';
          }).join('') +
          '<a href="#/display" target="_blank" rel="noopener" class="btn btn-ghost-light hero-display-link">' + ui.icon('external-link') + 'Display</a>' +
        '</div>' +
      '</div>' +
      '<div class="hero-aside">' +
        '<div class="hero-date-card"><span class="hero-day">' + String(date.getDate()).padStart(2, '0') + '</span><div><strong>' + ui.esc(ui.fmtDate(date, 'month')) + '</strong><span>' + ui.esc(ui.fmtDay(date)) + '</span></div></div>' +
        '<div class="hero-status">' + getUserBadge(user.role) + '<span class="hero-live"><span class="status-dot"></span>Layanan aktif</span></div>' +
      '</div>' +
      '</section>';
  }

  function render(root) {
    const user = store.currentUser();
    if (!user) return;
    const data = store.load();
    const stats = statsFor(user, data);
    const today = NS.core.dateKey();
    const last7 = [];
    for (let i = 6; i >= 0; i -= 1) {
      const day = dayKeyOffset(-i);
      last7.push({
        day: day,
        label: ui.fmtDate(day, 'short'),
        visits: data.queues.filter(function (queue) { return queue.tanggal === day && queue.status !== 'batal'; }).length,
        revenue: revenuePaidOn(day, data.bills)
      });
    }
    const currentVisits = sum(last7, function (item) { return item.visits; });
    const prevVisits = data.queues.filter(function (queue) { return queue.tanggal >= dayKeyOffset(-13) && queue.tanggal <= dayKeyOffset(-7) && queue.status !== 'batal'; }).length;
    const revenueWeek = sum(last7, function (item) { return item.revenue; });
    const queueScope = user.role === 'dokter' && user.poli ? 'Poli Anda' : 'Semua poli';

    root.innerHTML = hero(user) +
      '<div class="stats-grid">' + stats.map(function (stat) {
        return ui.statCard(stat);
      }).join('') + '</div>' +
      '<div class="dashboard-main-grid">' +
        '<section class="card chart-card">' +
          ui.sectionHeader('Tren layanan', '7 hari terakhir · ' + queueScope, '<div class="segmented" role="group" aria-label="Pilih data grafik"><button type="button" class="segmented-btn is-active" data-chart-mode="visits">Kunjungan</button><button type="button" class="segmented-btn" data-chart-mode="revenue">Pendapatan</button></div>', 'chart') +
          '<div class="chart-summary"><div><strong id="chartBigValue">' + ui.number(sum(last7, function (item) { return item.visits; })) + '</strong><span id="chartBigLabel">total kunjungan</span></div><span class="chart-summary-note" id="chartSummaryNote">' + (currentVisits >= prevVisits ? ui.icon('trending-up') + 'Meningkat dari pekan sebelumnya' : ui.icon('trending-down') + 'Lebih rendah dari pekan sebelumnya') + '</span></div>' +
          '<div id="dashboardChart">' + ui.lineChart(last7.map(function (item) { return { label: item.label, value: item.visits, extra: item.day }; }), { color: '#0f766e', ariaLabel: 'Grafik kunjungan 7 hari terakhir' }) + '</div>' +
          '<div class="chart-legend-note"><span><span class="legend-line"></span>Data kunjungan tercatat</span><span>Pendapatan pekan ini: <strong>' + ui.currency(revenueWeek) + '</strong></span></div>' +
        '</section>' +
        activeQueueCard(user, data) +
      '</div>' +
      '<div class="dashboard-lower-grid">' +
        poliBreakdown(data) +
        tasksFor(user, data) +
        recentActivity() +
      '</div>';

    const chartHost = root.querySelector('#dashboardChart');
    const bigValue = root.querySelector('#chartBigValue');
    const bigLabel = root.querySelector('#chartBigLabel');
    const summaryNote = root.querySelector('#chartSummaryNote');
    function setChart(mode) {
      if (!chartHost) return;
      root.querySelectorAll('[data-chart-mode]').forEach(function (button) {
        button.classList.toggle('is-active', button.dataset.chartMode === mode);
      });
      if (mode === 'revenue') {
        chartHost.innerHTML = ui.lineChart(last7.map(function (item) { return { label: item.label, value: item.revenue, extra: ui.currency(item.revenue) }; }), {
          color: '#a54a32',
          ariaLabel: 'Grafik pendapatan 7 hari terakhir',
          valueFormatter: function (value) {
            if (value >= 1000000) return 'Rp' + (value / 1000000).toFixed(1) + 'jt';
            if (value >= 1000) return 'Rp' + Math.round(value / 1000) + 'rb';
            return 'Rp' + value;
          }
        });
        if (bigValue) bigValue.textContent = ui.currency(revenueWeek);
        if (bigLabel) bigLabel.textContent = 'pendapatan pekan ini';
        if (summaryNote) summaryNote.innerHTML = ui.icon('info') + 'Hanya pembayaran berstatus lunas';
      } else {
        chartHost.innerHTML = ui.lineChart(last7.map(function (item) { return { label: item.label, value: item.visits, extra: item.day }; }), { color: '#0f766e', ariaLabel: 'Grafik kunjungan 7 hari terakhir' });
        if (bigValue) bigValue.textContent = ui.number(sum(last7, function (item) { return item.visits; }));
        if (bigLabel) bigLabel.textContent = 'total kunjungan';
        if (summaryNote) summaryNote.innerHTML = (currentVisits >= prevVisits ? ui.icon('trending-up') + 'Meningkat dari pekan sebelumnya' : ui.icon('trending-down') + 'Lebih rendah dari pekan sebelumnya');
      }
    }
    root.querySelectorAll('[data-chart-mode]').forEach(function (button) {
      button.addEventListener('click', function () { setChart(button.dataset.chartMode); });
    });

    const callButton = root.querySelector('#dashboardCallNext');
    if (callButton) {
      callButton.addEventListener('click', function () {
        try {
          const next = store.callNextQueue(callButton.dataset.poli || null);
          const patient = store.patientById(next.patientId);
          ui.toast('Antrean ' + next.kode + ' · ' + (patient ? patient.nama : 'Pasien') + ' dipanggil ke ' + NS.core.getPoli(next.poli).nama + '.', 'success', 'Antrean dipanggil');
          if (window.PK.announceQueue) window.PK.announceQueue(next);
          render(root);
        } catch (error) {
          ui.showError(error);
        }
      });
    }
  }

  NS.pages = NS.pages || {};
  NS.pages.dashboard = render;
})(window);
