/* ==========================================================================
   Sehat Bersama - Puskesmas Arbes — Modul laporan & analitik
   ========================================================================== */
(function (window) {
  'use strict';

  const NS = window.PK;
  const ui = NS.ui;
  const store = NS.store;
  const C = NS.constants;

  const TABS = ['ringkasan', 'kunjungan', 'poli', 'penyakit', 'obat', 'petugas'];

  const state = {
    tab: 'ringkasan',
    preset: '30',
    start: NS.core.addDaysKey(NS.core.dateKey(), -29),
    end: NS.core.dateKey(),
    poli: '',
    status: '',
    search: '',
    page: 1,
    perPage: 10,
    medSearch: '',
    medCategory: ''
  };

  function today() {
    return NS.core.dateKey();
  }

  function dateKeyOf(value) {
    if (!value) return '';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : NS.core.dateKey(d);
  }

  function inRange(day) {
    return Boolean(day) && day >= state.start && day <= state.end;
  }

  function rangeDays() {
    const days = [];
    let cursor = state.start;
    let guard = 0;
    while (cursor && cursor <= state.end && guard < 400) {
      days.push(cursor);
      cursor = NS.core.addDaysKey(cursor, 1);
      guard += 1;
    }
    return days;
  }

  function rangeLabel() {
    return ui.fmtDate(state.start, 'medium') + ' – ' + ui.fmtDate(state.end, 'medium');
  }

  function sum(list, getter) {
    return (list || []).reduce(function (total, item) { return total + (Number(getter(item)) || 0); }, 0);
  }

  function average(values) {
    const valid = (values || []).filter(function (value) { return Number.isFinite(Number(value)); }).map(Number);
    if (!valid.length) return 0;
    return valid.reduce(function (total, value) { return total + value; }, 0) / valid.length;
  }

  function minutesBetween(from, to) {
    if (!from || !to) return null;
    const start = new Date(from).getTime();
    const end = new Date(to).getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) return null;
    return Math.max(0, Math.round((end - start) / 60000));
  }

  function patientOf(queue) {
    return store.patientById(queue.patientId);
  }

  function userName(id) {
    const user = store.users().find(function (item) { return item.id === id; });
    return user ? user.name : '—';
  }

  function poliName(id) {
    return id ? NS.core.getPoli(id).nama : 'Semua poli';
  }

  function applyPreset(preset) {
    const now = today();
    state.preset = preset;
    if (preset === 'today') {
      state.start = now;
      state.end = now;
    } else if (preset === '7') {
      state.start = NS.core.addDaysKey(now, -6);
      state.end = now;
    } else if (preset === '30') {
      state.start = NS.core.addDaysKey(now, -29);
      state.end = now;
    } else if (preset === 'month') {
      state.start = ui.startOfMonthKey();
      state.end = now;
    } else if (preset === '90') {
      state.start = NS.core.addDaysKey(now, -89);
      state.end = now;
    }
  }

  function normalizeRange() {
    if (!state.start) state.start = NS.core.addDaysKey(today(), -29);
    if (!state.end) state.end = today();
    if (state.start > state.end) {
      const temporary = state.start;
      state.start = state.end;
      state.end = temporary;
    }
    const span = Math.round((new Date(state.end).getTime() - new Date(state.start).getTime()) / 86400000);
    if (span > 366) {
      state.start = NS.core.addDaysKey(state.end, -365);
      ui.toast('Rentang laporan dibatasi maksimal 366 hari.', 'info');
    }
  }

  /* ------------------------------------------------------------------------
     Kumpulan data dasar
     ------------------------------------------------------------------------ */
  function queueBase() {
    return store.queues().filter(function (queue) {
      return inRange(queue.tanggal) && (!state.poli || queue.poli === state.poli);
    });
  }

  function examBase() {
    return store.exams().filter(function (exam) {
      return inRange(exam.tanggal) && (!state.poli || exam.poli === state.poli);
    });
  }

  function billBase() {
    return store.bills().filter(function (bill) {
      return (!state.poli || bill.poli === state.poli);
    });
  }

  function paidBills() {
    return billBase().filter(function (bill) {
      return (bill.status === 'lunas' || bill.status === 'ditanggung') && inRange(dateKeyOf(bill.paidAt || bill.createdAt));
    });
  }

  function unpaidBills() {
    return billBase().filter(function (bill) {
      return bill.status === 'belum' && inRange(bill.tanggal);
    });
  }

  function visitEntries(filtered) {
    const exams = store.exams();
    const bills = store.bills();
    let queues = queueBase();
    if (filtered) {
      if (state.status) queues = queues.filter(function (queue) { return queue.status === state.status; });
      if (state.search) {
        const query = state.search.toLowerCase();
        queues = queues.filter(function (queue) {
          const patient = patientOf(queue);
          const exam = exams.find(function (item) { return item.queueId === queue.id; });
          return [queue.kode, patient && patient.nama, patient && patient.noRM, patient && patient.nik, exam && exam.diagnosis, exam && exam.noPemeriksaan]
            .some(function (value) { return String(value || '').toLowerCase().includes(query); });
        });
      }
    }
    return queues.map(function (queue) {
      const exam = exams.find(function (item) { return item.queueId === queue.id; }) || null;
      const bill = exam ? bills.find(function (item) { return item.examinationId === exam.id; }) || null : null;
      return { queue: queue, patient: patientOf(queue), exam: exam, bill: bill };
    }).sort(function (a, b) {
      if (a.queue.tanggal !== b.queue.tanggal) return a.queue.tanggal < b.queue.tanggal ? 1 : -1;
      return (b.queue.nomor || 0) - (a.queue.nomor || 0);
    });
  }

  function diagnosisRows() {
    const exams = examBase().filter(function (exam) { return exam.status === 'selesai' && exam.diagnosis; });
    const map = {};
    exams.forEach(function (exam) {
      const key = (exam.kodeICD10 || 'TANPA-KODE') + '|' + exam.diagnosis;
      if (!map[key]) {
        map[key] = {
          key: key,
          nama: exam.diagnosis,
          kode: exam.kodeICD10 || '—',
          count: 0,
          patients: new Set(),
          polis: {}
        };
      }
      map[key].count += 1;
      map[key].patients.add(exam.patientId);
      map[key].polis[exam.poli] = (map[key].polis[exam.poli] || 0) + 1;
    });
    return Object.keys(map).map(function (key) { return map[key]; }).sort(function (a, b) {
      if (b.count !== a.count) return b.count - a.count;
      return a.nama.localeCompare(b.nama, 'id');
    });
  }

  function medicineUsage() {
    const exams = examBase().filter(function (exam) {
      if (exam.status !== 'selesai' || !exam.resep || !exam.resep.length || exam.resepStatus !== 'diserahkan') return false;
      const day = exam.dispensedAt ? dateKeyOf(exam.dispensedAt) : exam.tanggal;
      return inRange(day);
    });
    const map = {};
    exams.forEach(function (exam) {
      exam.resep.forEach(function (item) {
        const key = item.medicineId;
        if (!map[key]) {
          const medicine = store.medicineById(item.medicineId);
          map[key] = {
            medicineId: key,
            nama: medicine ? medicine.nama : item.nama,
            kategori: medicine ? medicine.kategori : 'Tidak diketahui',
            satuan: medicine ? medicine.satuan : item.satuan,
            medicine: medicine || null,
            qty: 0,
            prescriptionIds: new Set(),
            value: 0
          };
        }
        map[key].qty += Number(item.jumlah) || 0;
        map[key].value += (Number(item.jumlah) || 0) * (Number(item.harga) || 0);
        map[key].prescriptionIds.add(exam.id);
      });
    });
    let rows = Object.keys(map).map(function (key) { return map[key]; });
    if (state.medSearch) {
      const query = state.medSearch.toLowerCase();
      rows = rows.filter(function (row) {
        return [row.nama, row.kategori, row.satuan].some(function (value) { return String(value || '').toLowerCase().includes(query); });
      });
    }
    if (state.medCategory) rows = rows.filter(function (row) { return row.kategori === state.medCategory; });
    return {
      rows: rows.sort(function (a, b) { return b.qty - a.qty; }),
      prescriptionCount: exams.length,
      exams: exams
    };
  }

  /* ------------------------------------------------------------------------
     Kerangka halaman
     ------------------------------------------------------------------------ */
  function toolbarMarkup() {
    const presets = [
      { value: 'today', label: 'Hari ini' },
      { value: '7', label: '7 hari terakhir' },
      { value: '30', label: '30 hari terakhir' },
      { value: 'month', label: 'Bulan ini' },
      { value: '90', label: '90 hari terakhir' },
      { value: 'custom', label: 'Rentang kustom' }
    ];
    return '<section class="card report-toolbar">' +
      '<div class="report-toolbar-left">' +
        '<div class="report-company">' +
          '<span class="brand-mark">' + ui.brandMark() + '</span>' +
          '<div class="report-title-block"><h2>Periode laporan</h2><p>' + ui.esc(rangeLabel()) + ' · ' + ui.esc(poliName(state.poli)) + '</p></div>' +
        '</div>' +
        '<span class="report-filter-chip">' + ui.icon('calendar') + ui.esc(rangeDays().length + ' hari') + '</span>' +
        (state.poli ? '<span class="report-filter-chip">' + ui.icon('stethoscope') + ui.esc(poliName(state.poli)) + '</span>' : '') +
      '</div>' +
      '<div class="report-toolbar-right">' +
        '<select id="reportPreset" class="input input-auto" aria-label="Pilih periode cepat">' + ui.options(presets, state.preset) + '</select>' +
        '<div class="date-range">' +
          '<label for="reportStart">Dari <input type="date" id="reportStart" class="input input-auto" value="' + ui.attr(state.start) + '" max="' + ui.attr(today()) + '"></label>' +
          '<span>—</span>' +
          '<label for="reportEnd">Sampai <input type="date" id="reportEnd" class="input input-auto" value="' + ui.attr(state.end) + '" max="' + ui.attr(today()) + '"></label>' +
        '</div>' +
        '<select id="reportPoli" class="input input-auto" aria-label="Filter poli laporan">' + ui.options(C.POLI.map(function (poli) { return { value: poli.id, label: poli.nama }; }), state.poli, 'Semua poli') + '</select>' +
        '<button type="button" class="btn btn-secondary btn-sm" id="reportResetBtn">' + ui.icon('refresh') + 'Reset</button>' +
      '</div>' +
    '</section>';
  }

  function headerMarkup() {
    return ui.pageHeader({
      eyebrow: 'Analitik & Pelaporan',
      title: 'Laporan Puskesmas',
      description: 'Pantau kunjungan, kinerja poli, diagnosis, penggunaan obat, dan aktivitas petugas dalam satu tempat.',
      actions: '<button type="button" class="btn btn-secondary" id="reportExportBtn">' + ui.icon('download') + 'Ekspor CSV</button>' +
        '<button type="button" class="btn btn-primary" id="reportPrintBtn">' + ui.icon('printer') + 'Cetak Laporan</button>'
    });
  }

  function tabsMarkup() {
    return '<div class="pharmacy-toolbar">' +
      ui.pageTabs([
        { id: 'ringkasan', label: 'Ringkasan', icon: 'chart' },
        { id: 'kunjungan', label: 'Kunjungan', icon: 'queue' },
        { id: 'poli', label: 'Per Poli', icon: 'stethoscope' },
        { id: 'penyakit', label: 'Penyakit', icon: 'activity' },
        { id: 'obat', label: 'Obat', icon: 'pill' },
        { id: 'petugas', label: 'Petugas', icon: 'users' }
      ], state.tab) +
      '<div class="pharmacy-toolbar-actions"><span class="report-filter-chip">' + ui.icon('info') + 'Data lokal puskesmas</span></div>' +
    '</div>';
  }

  /* ------------------------------------------------------------------------
     Tab ringkasan
     ------------------------------------------------------------------------ */
  function dailySeries() {
    const queues = queueBase();
    const paid = paidBills();
    return rangeDays().map(function (day) {
      const list = queues.filter(function (queue) { return queue.tanggal === day; });
      const dayBills = paid.filter(function (bill) { return dateKeyOf(bill.paidAt || bill.createdAt) === day; });
      return {
        day: day,
        label: ui.fmtDate(day, 'short'),
        visits: list.length,
        completed: list.filter(function (queue) { return queue.status === 'selesai'; }).length,
        cancelled: list.filter(function (queue) { return queue.status === 'batal'; }).length,
        revenue: sum(dayBills, function (bill) { return bill.total; })
      };
    });
  }

  function kpiMarkup(queues) {
    const total = queues.length;
    const completed = queues.filter(function (queue) { return queue.status === 'selesai'; }).length;
    const cancelled = queues.filter(function (queue) { return queue.status === 'batal'; }).length;
    const unique = new Set(queues.map(function (queue) { return queue.patientId; })).size;
    const newPatients = store.patients().filter(function (patient) {
      return patient.createdAt && inRange(dateKeyOf(patient.createdAt));
    }).length;
    const revenueBills = paidBills();
    const revenue = sum(revenueBills, function (bill) { return bill.total; });
    const outstanding = unpaidBills();
    const completionRate = total ? Math.round((completed / total) * 100) : 0;
    return '<div class="report-kpis">' +
      '<div class="report-kpi"><span>Total kunjungan</span><strong>' + ui.number(total) + '</strong><small>' + ui.number(completed) + ' selesai · ' + ui.number(cancelled) + ' batal</small></div>' +
      '<div class="report-kpi"><span>Pasien unik</span><strong>' + ui.number(unique) + '</strong><small>' + ui.number(newPatients) + ' pasien baru terdaftar</small></div>' +
      '<div class="report-kpi"><span>Tingkat penyelesaian</span><strong>' + completionRate + '%</strong><small>Dari seluruh kunjungan periode ini</small></div>' +
      '<div class="report-kpi"><span>Pendapatan terealisasi</span><strong>' + ui.currency(revenue) + '</strong><small>' + ui.number(revenueBills.length) + ' transaksi lunas / ditanggung</small></div>' +
      '<div class="report-kpi"><span>Tagihan tertunda</span><strong>' + ui.number(outstanding.length) + '</strong><small>' + ui.currency(sum(outstanding, function (bill) { return bill.total; })) + ' belum dibayar</small></div>' +
    '</div>';
  }

  function recentVisitsMarkup(entries) {
    const shown = entries.slice(0, 8);
    return '<section class="card">' +
      ui.sectionHeader('Kunjungan terbaru', 'Delapan kunjungan terakhir pada periode laporan.', '<a href="#/laporan/poli" class="btn btn-ghost btn-sm" data-report-tab="poli">Lihat per poli ' + ui.icon('arrow-right') + '</a>', 'clock') +
      (shown.length ? '<div class="table-responsive"><table class="data-table report-table"><thead><tr><th>Tanggal</th><th>Pasien</th><th>Poli</th><th>Diagnosis</th><th>Status</th></tr></thead><tbody>' +
        shown.map(function (entry) {
          const patient = entry.patient;
          return '<tr>' +
            '<td><strong class="small">' + ui.esc(ui.fmtDate(entry.queue.tanggal, 'medium')) + '</strong><small class="table-sub">' + ui.esc(ui.fmtTime(entry.queue.createdAt)) + '</small></td>' +
            '<td><a href="#/pasien/' + ui.attr(entry.queue.patientId) + '" class="person-cell"><span class="avatar avatar-xs">' + ui.esc(ui.initials(patient ? patient.nama : 'Pasien')) + '</span><span class="person-copy"><strong>' + ui.esc(patient ? patient.nama : 'Pasien') + '</strong><small>' + ui.esc(patient ? patient.noRM : '—') + '</small></span></a></td>' +
            '<td>' + ui.poliBadge(entry.queue.poli, true) + '</td>' +
            '<td><strong class="small">' + ui.esc(entry.exam ? entry.exam.diagnosis || 'Belum diisi' : 'Belum diperiksa') + '</strong>' + (entry.exam && entry.exam.kodeICD10 ? '<small class="table-sub mono">' + ui.esc(entry.exam.kodeICD10) + '</small>' : '') + '</td>' +
            '<td>' + ui.statusBadge(entry.queue.status) + '</td>' +
          '</tr>';
        }).join('') + '</tbody></table></div>' :
        ui.emptyState('clock', 'Belum ada kunjungan', 'Tidak ada kunjungan pada periode dan filter yang dipilih.')) +
    '</section>';
  }

  function stockAlertMarkup() {
    const alerts = store.stockAlerts();
    const rows = []
      .concat(alerts.out.map(function (medicine) { return { medicine: medicine, label: 'Stok habis', tone: 'danger' }; }))
      .concat(alerts.expired.map(function (medicine) { return { medicine: medicine, label: 'Kedaluwarsa', tone: 'danger' }; }))
      .concat(alerts.low.map(function (medicine) { return { medicine: medicine, label: 'Stok menipis', tone: 'warning' }; }))
      .concat(alerts.expiring.map(function (medicine) { return { medicine: medicine, label: 'Segera kedaluwarsa', tone: 'warning' }; }));
    const unique = [];
    const seen = new Set();
    rows.forEach(function (row) {
      if (seen.has(row.medicine.id)) return;
      seen.add(row.medicine.id);
      unique.push(row);
    });
    return '<section class="card">' +
      ui.sectionHeader('Perhatian stok obat', alerts.low.length + alerts.out.length + alerts.expired.length + ' item perlu ditinjau.', '<a href="#/farmasi/stok" class="btn btn-ghost btn-sm">Buka stok ' + ui.icon('arrow-right') + '</a>', 'alert') +
      (unique.length ? '<div class="alert-list">' + unique.slice(0, 5).map(function (row) {
        return '<div class="alert-row"><span class="stat-icon stat-icon-' + (row.tone === 'danger' ? 'rose' : 'amber') + '">' + ui.icon(row.tone === 'danger' ? 'alert' : 'package') + '</span><span><strong>' + ui.esc(row.medicine.nama) + '</strong><small>' + ui.esc(row.medicine.stok + ' ' + row.medicine.satuan + ' · min. ' + row.medicine.stokMinimum) + '</small></span><span class="badge badge-' + ui.attr(row.tone) + '">' + ui.esc(row.label) + '</span></div>';
      }).join('') + '</div>' : '<div class="inline-alert inline-alert-success">' + ui.icon('check-circle') + '<span>Seluruh persediaan obat dalam kondisi aman.</span></div>') +
    '</section>';
  }

  function renderOverview() {
    const queues = queueBase();
    const entries = visitEntries(false);
    const series = dailySeries();
    const poliCounts = C.POLI.map(function (poli) {
      const total = queues.filter(function (queue) { return queue.poli === poli.id; }).length;
      return { label: poli.singkat, value: total, color: poli.warna, poli: poli.id };
    }).filter(function (item) { return item.value > 0; });
    const diagnoses = diagnosisRows().slice(0, 7).map(function (row) {
      return { label: row.nama, value: row.count, extra: row.kode };
    });
    const visitsTotal = sum(series, function (point) { return point.visits; });
    const revenueTotal = sum(series, function (point) { return point.revenue; });
    return {
      html: kpiMarkup(queues) +
        '<div class="report-grid-wide">' +
          '<section class="card chart-card">' +
            ui.sectionHeader('Tren kunjungan harian', 'Jumlah pasien yang dilayani setiap hari.', '<span class="report-filter-chip">' + ui.icon('trending-up') + ui.number(visitsTotal) + ' kunjungan</span>', 'chart') +
            '<div class="chart-summary"><div><strong>' + ui.currency(revenueTotal) + '</strong><span>pendapatan periode ini</span></div><div class="chart-summary-note">' + ui.icon('calendar') + rangeDays().length + ' hari terpantau</div></div>' +
            ui.lineChart(series.map(function (point) { return { label: point.label, value: point.visits, extra: point.day }; }), { color: '#0f766e', ariaLabel: 'Grafik kunjungan harian' }) +
          '</section>' +
          '<section class="card">' +
            ui.sectionHeader('Distribusi per poli', 'Sebaran kunjungan antar poli.', '', 'stethoscope') +
            ui.donutChart(poliCounts, { centerLabel: 'Kunjungan', centerValue: ui.number(visitsTotal) }) +
          '</section>' +
        '</div>' +
        '<div class="report-grid-2">' +
          '<section class="card">' +
            ui.sectionHeader('Diagnosis terbanyak', 'Penyakit yang paling sering didiagnosis.', '', 'activity') +
            ui.barList(diagnoses, { color: '#6d5aa8', showRank: true, valueFormatter: function (value) { return ui.number(value) + ' kasus'; } }) +
          '</section>' +
          '<section class="card">' +
            ui.sectionHeader('Ringkasan poli', 'Perbandingan volume layanan per poli.', '', 'building') +
            '<div class="table-responsive"><table class="data-table report-table"><thead><tr><th>Poli</th><th>Kunjungan</th><th>Selesai</th><th>Batal</th></tr></thead><tbody>' +
              (poliCounts.length ? poliCounts.map(function (item) {
                const list = queues.filter(function (queue) { return queue.poli === item.poli; });
                return '<tr><td>' + ui.poliBadge(item.poli) + '</td><td><strong>' + ui.number(list.length) + '</strong></td><td>' + ui.number(list.filter(function (queue) { return queue.status === 'selesai'; }).length) + '</td><td>' + ui.number(list.filter(function (queue) { return queue.status === 'batal'; }).length) + '</td></tr>';
              }).join('') : '<tr><td colspan="4">' + ui.emptyState('chart', 'Belum ada data', 'Tidak ada kunjungan pada periode ini.') + '</td></tr>') +
            '</tbody></table></div>' +
          '</section>' +
        '</div>' +
        '<div class="report-grid-wide">' +
          recentVisitsMarkup(entries) +
          stockAlertMarkup() +
        '</div>',
      csv: {
        filename: 'ringkasan-' + state.start + '-' + state.end,
        headers: ['Tanggal', 'Kunjungan', 'Selesai', 'Batal', 'Pendapatan'],
        rows: series.map(function (point) { return [point.day, point.visits, point.completed, point.cancelled, point.revenue]; })
      },
      print: function () {
        return printKpiRow([
          ['Total kunjungan', ui.number(queues.length)],
          ['Pasien unik', ui.number(new Set(queues.map(function (queue) { return queue.patientId; })).size)],
          ['Pendapatan', ui.currency(revenueTotal)],
          ['Tagihan tertunda', ui.currency(sum(unpaidBills(), function (bill) { return bill.total; }))]
        ]) +
          '<h3 class="print-section-title">Rekap kunjungan harian</h3>' +
          printTable(['Tanggal', 'Kunjungan', 'Selesai', 'Batal', 'Pendapatan'], series.map(function (point) {
            return [ui.fmtDate(point.day, 'medium'), ui.number(point.visits), ui.number(point.completed), ui.number(point.cancelled), ui.currency(point.revenue)];
          }), ['', 'align-right', 'align-right', 'align-right', 'align-right']) +
          '<h3 class="print-section-title">Distribusi per poli</h3>' +
          printTable(['Poli', 'Kunjungan', 'Selesai', 'Batal'], poliCounts.map(function (item) {
            const list = queues.filter(function (queue) { return queue.poli === item.poli; });
            return [poliName(item.poli), ui.number(list.length), ui.number(list.filter(function (queue) { return queue.status === 'selesai'; }).length), ui.number(list.filter(function (queue) { return queue.status === 'batal'; }).length)];
          }), ['', 'align-right', 'align-right', 'align-right']) +
          '<h3 class="print-section-title">Diagnosis terbanyak</h3>' +
          printTable(['No', 'Diagnosis', 'ICD-10', 'Kasus'], diagnosisRows().slice(0, 15).map(function (row, index) {
            return [index + 1, row.nama, row.kode, ui.number(row.count)];
          }), ['', '', '', 'align-right']);
      }
    };
  }

  /* ------------------------------------------------------------------------
     Tab kunjungan
     ------------------------------------------------------------------------ */
  function statusOptions() {
    return Object.keys(C.STATUS_META).map(function (key) {
      return { value: key, label: C.STATUS_META[key].label };
    });
  }

  function visitRowsMarkup(entries) {
    return entries.map(function (entry) {
      const patient = entry.patient;
      const exam = entry.exam;
      const wait = minutesBetween(entry.queue.createdAt, entry.queue.calledAt);
      return '<tr>' +
        '<td data-label="Antrean"><strong class="mono small">' + ui.esc(entry.queue.kode) + '</strong><small class="table-sub">' + ui.esc(ui.fmtTime(entry.queue.createdAt)) + '</small></td>' +
        '<td data-label="Tanggal">' + ui.esc(ui.fmtDate(entry.queue.tanggal, 'medium')) + '</td>' +
        '<td data-label="Pasien"><a href="#/pasien/' + ui.attr(entry.queue.patientId) + '" class="person-cell"><span class="avatar avatar-xs">' + ui.esc(ui.initials(patient ? patient.nama : 'Pasien')) + '</span><span class="person-copy"><strong>' + ui.esc(patient ? patient.nama : 'Pasien') + '</strong><small>' + ui.esc(patient ? patient.noRM : '—') + '</small></span></a></td>' +
        '<td data-label="Poli">' + ui.poliBadge(entry.queue.poli, true) + '</td>' +
        '<td data-label="Dokter">' + ui.esc(exam ? userName(exam.dokterId) : '—') + '</td>' +
        '<td data-label="Diagnosis"><strong class="small">' + ui.esc(exam ? exam.diagnosis || 'Belum diisi' : 'Belum diperiksa') + '</strong>' + (exam && exam.kodeICD10 ? '<small class="table-sub mono">' + ui.esc(exam.kodeICD10) + '</small>' : '') + '</td>' +
        '<td data-label="Status">' + ui.statusBadge(entry.queue.status) + (entry.queue.prioritas ? '<small class="table-sub">Prioritas</small>' : '') + '</td>' +
        '<td data-label="Tunggu">' + (wait === null ? '<span class="muted">—</span>' : '<strong class="small">' + ui.number(wait) + ' mnt</strong>') + '</td>' +
      '</tr>';
    }).join('');
  }

  function renderVisits() {
    const all = visitEntries(false);
    const filtered = visitEntries(true);
    const totalPages = Math.max(1, Math.ceil(filtered.length / state.perPage));
    if (state.page > totalPages) state.page = totalPages;
    const shown = filtered.slice((state.page - 1) * state.perPage, state.page * state.perPage);
    const totalRevenue = sum(filtered.filter(function (entry) { return entry.bill; }), function (entry) { return entry.bill.total; });
    const completed = filtered.filter(function (entry) { return entry.queue.status === 'selesai'; }).length;
    const canceled = filtered.filter(function (entry) { return entry.queue.status === 'batal'; }).length;
    return {
      html: '<div class="report-summary-grid">' +
          '<div class="report-kpi"><span>Kunjungan terfilter</span><strong>' + ui.number(filtered.length) + '</strong><small>dari ' + ui.number(all.length) + ' kunjungan periode ini</small></div>' +
          '<div class="report-kpi"><span>Selesai</span><strong>' + ui.number(completed) + '</strong><small>pelayanan tuntas</small></div>' +
          '<div class="report-kpi"><span>Dibatalkan</span><strong>' + ui.number(canceled) + '</strong><small>antrean tidak dilanjutkan</small></div>' +
          '<div class="report-kpi"><span>Nilai tagihan</span><strong>' + ui.currency(totalRevenue) + '</strong><small>seluruh tagihan terfilter</small></div>' +
        '</div>' +
        '<section class="card">' +
          '<div class="filter-bar">' +
            '<div class="search-field">' + ui.icon('search') + '<input type="search" id="visitSearch" class="input" placeholder="Cari pasien, nomor RM, diagnosis, antrean…" value="' + ui.attr(state.search) + '" aria-label="Cari kunjungan">' + (state.search ? '<button type="button" class="search-clear" id="visitSearchClear" aria-label="Hapus pencarian">' + ui.icon('x') + '</button>' : '') + '</div>' +
            '<select id="visitStatus" class="input input-auto" aria-label="Filter status kunjungan">' + ui.options(statusOptions(), state.status, 'Semua status') + '</select>' +
            ui.pageSizeSelect(state.perPage, 'visitPageSize') +
            '<button type="button" class="btn btn-secondary btn-sm" id="visitReset">' + ui.icon('refresh') + 'Reset filter</button>' +
          '</div>' +
          (shown.length ? '<div class="table-responsive"><table class="data-table report-table"><thead><tr><th>Antrean</th><th>Tanggal</th><th>Pasien</th><th>Poli</th><th>Dokter</th><th>Diagnosis</th><th>Status</th><th>Tunggu</th></tr></thead><tbody>' + visitRowsMarkup(shown) + '</tbody></table></div>' :
            ui.emptyState('queue', 'Kunjungan tidak ditemukan', 'Ubah filter atau pilih periode lain untuk melihat data kunjungan.', '<button type="button" class="btn btn-secondary btn-sm" id="visitEmptyReset">Reset filter</button>')) +
          (filtered.length ? ui.pagination(filtered.length, state.page, state.perPage) : '') +
        '</section>',
      csv: {
        filename: 'kunjungan-' + state.start + '-' + state.end,
        headers: ['No. Antrean', 'Tanggal', 'No. RM', 'NIK', 'Pasien', 'Poli', 'Dokter', 'Status', 'Prioritas', 'Diagnosis', 'ICD-10', 'No. Tagihan', 'Status Tagihan', 'Total Tagihan', 'Menit Tunggu'],
        rows: filtered.map(function (entry) {
          return [
            entry.queue.kode, entry.queue.tanggal, entry.patient ? entry.patient.noRM : '', entry.patient ? entry.patient.nik : '',
            entry.patient ? entry.patient.nama : '', poliName(entry.queue.poli), entry.exam ? userName(entry.exam.dokterId) : '',
            C.STATUS_META[entry.queue.status].label, entry.queue.prioritas ? 'Ya' : 'Tidak',
            entry.exam ? entry.exam.diagnosis : '', entry.exam ? entry.exam.kodeICD10 : '',
            entry.bill ? entry.bill.noBill : '', entry.bill ? C.BILL_STATUS_META[entry.bill.status].label : '',
            entry.bill ? entry.bill.total : 0, minutesBetween(entry.queue.createdAt, entry.queue.calledAt) || ''
          ];
        })
      },
      print: function () {
        return '<h3 class="print-section-title">Daftar kunjungan pasien</h3>' +
          printTable(['No', 'Tanggal', 'Antrean', 'Pasien', 'Poli', 'Dokter', 'Diagnosis', 'Status'], filtered.map(function (entry, index) {
            return [
              index + 1,
              ui.fmtDate(entry.queue.tanggal, 'short'),
              entry.queue.kode,
              (entry.patient ? entry.patient.nama : 'Pasien') + (entry.patient ? ' (' + entry.patient.noRM + ')' : ''),
              poliName(entry.queue.poli),
              entry.exam ? userName(entry.exam.dokterId) : '—',
              entry.exam ? entry.exam.diagnosis || '—' : 'Belum diperiksa',
              C.STATUS_META[entry.queue.status].label
            ];
          }), ['', '', '', '', '', '', '', '']) +
          '<p class="print-muted">Total ' + ui.number(filtered.length) + ' kunjungan · ' + ui.number(completed) + ' selesai · ' + ui.number(canceled) + ' dibatalkan.</p>';
      }
    };
  }

  /* ------------------------------------------------------------------------
     Tab per poli
     ------------------------------------------------------------------------ */
  function poliStatistics() {
    const queues = queueBase();
    const exams = examBase();
    const paid = paidBills();
    return C.POLI.map(function (poli) {
      if (state.poli && state.poli !== poli.id) return null;
      const list = queues.filter(function (queue) { return queue.poli === poli.id; });
      const poliExams = exams.filter(function (exam) { return exam.poli === poli.id; });
      const bills = paid.filter(function (bill) { return bill.poli === poli.id; });
      const waits = list.map(function (queue) { return minutesBetween(queue.createdAt, queue.calledAt); });
      const services = list.map(function (queue) { return minutesBetween(queue.startedAt, queue.finishedAt); });
      return {
        poli: poli,
        total: list.length,
        completed: list.filter(function (queue) { return queue.status === 'selesai'; }).length,
        cancelled: list.filter(function (queue) { return queue.status === 'batal'; }).length,
        active: list.filter(function (queue) { return ['menunggu', 'dipanggil', 'dilayani'].includes(queue.status); }).length,
        unique: new Set(list.map(function (queue) { return queue.patientId; })).size,
        exams: poliExams.length,
        referrals: poliExams.filter(function (exam) { return exam.rujukan; }).length,
        avgWait: Math.round(average(waits.filter(function (value) { return value !== null; }))),
        avgService: Math.round(average(services.filter(function (value) { return value !== null; }))),
        revenue: sum(bills, function (bill) { return bill.total; })
      };
    }).filter(Boolean);
  }

  function renderPoli() {
    const rows = poliStatistics();
    const totalVisits = sum(rows, function (row) { return row.total; });
    const busiest = rows.slice().sort(function (a, b) { return b.total - a.total; })[0];
    const longestWait = rows.slice().sort(function (a, b) { return b.avgWait - a.avgWait; })[0];
    const revenue = sum(rows, function (row) { return row.revenue; });
    return {
      html: '<div class="report-kpis">' +
          '<div class="report-kpi"><span>Total kunjungan</span><strong>' + ui.number(totalVisits) + '</strong><small>seluruh poli terpilih</small></div>' +
          '<div class="report-kpi"><span>Poli tersibuk</span><strong>' + ui.esc(busiest ? busiest.poli.singkat : '—') + '</strong><small>' + (busiest ? ui.number(busiest.total) + ' kunjungan' : 'belum ada data') + '</small></div>' +
          '<div class="report-kpi"><span>Rata-rata tunggu</span><strong>' + ui.number(rows.length ? Math.round(average(rows.map(function (row) { return row.avgWait; }))) : 0) + ' mnt</strong><small>' + (longestWait ? 'Terlama: ' + longestWait.poli.singkat : '—') + '</small></div>' +
          '<div class="report-kpi"><span>Rujukan</span><strong>' + ui.number(sum(rows, function (row) { return row.referrals; })) + '</strong><small>pasien dirujuk ke fasilitas lain</small></div>' +
          '<div class="report-kpi"><span>Nilai layanan</span><strong>' + ui.currency(revenue) + '</strong><small>pembayaran lunas & ditanggung</small></div>' +
        '</div>' +
        '<div class="report-grid-2">' +
          '<section class="card">' +
            ui.sectionHeader('Volume kunjungan per poli', 'Perbandingan jumlah pasien.', '', 'chart') +
            ui.barList(rows.map(function (row) { return { label: row.poli.nama, value: row.total, color: row.poli.warna }; }), { color: '#0f766e', showRank: true, valueFormatter: function (value) { return ui.number(value) + ' kunjungan'; } }) +
          '</section>' +
          '<section class="card">' +
            ui.sectionHeader('Kasus & rujukan', 'Jumlah pemeriksaan tuntas dan rujukan.', '', 'activity') +
            ui.barList(rows.map(function (row) { return { label: row.poli.nama, value: row.exams, color: row.poli.warna }; }), { color: '#6d5aa8', valueFormatter: function (value) { return ui.number(value) + ' pemeriksaan'; } }) +
          '</section>' +
        '</div>' +
        '<section class="card">' +
          ui.sectionHeader('Tabel kinerja poli', 'Angka kunjungan, waktu tunggu, dan nilai layanan.', '<span class="report-filter-chip">' + ui.icon('calendar') + ui.esc(rangeLabel()) + '</span>', 'building') +
          '<div class="table-responsive"><table class="data-table report-table"><thead><tr><th>Poli</th><th>Kunjungan</th><th>Selesai</th><th>Batal</th><th>Pasien unik</th><th>Rata-rata tunggu</th><th>Rata-rata layanan</th><th>Rujukan</th><th>Nilai layanan</th></tr></thead><tbody>' +
            (rows.length ? rows.map(function (row) {
              return '<tr><td>' + ui.poliBadge(row.poli.id) + '</td><td><strong>' + ui.number(row.total) + '</strong></td><td>' + ui.number(row.completed) + '</td><td>' + ui.number(row.cancelled) + '</td><td>' + ui.number(row.unique) + '</td><td>' + ui.number(row.avgWait) + ' mnt</td><td>' + ui.number(row.avgService) + ' mnt</td><td>' + ui.number(row.referrals) + '</td><td><strong>' + ui.currency(row.revenue) + '</strong></td></tr>';
            }).join('') : '<tr><td colspan="9">' + ui.emptyState('chart', 'Belum ada data poli', 'Tidak ada kunjungan pada periode ini.') + '</td></tr>') +
          '</tbody><tfoot><tr class="report-total-row"><td>Total</td><td>' + ui.number(totalVisits) + '</td><td>' + ui.number(sum(rows, function (row) { return row.completed; })) + '</td><td>' + ui.number(sum(rows, function (row) { return row.cancelled; })) + '</td><td>' + ui.number(sum(rows, function (row) { return row.unique; })) + '</td><td>—</td><td>—</td><td>' + ui.number(sum(rows, function (row) { return row.referrals; })) + '</td><td>' + ui.currency(revenue) + '</td></tr></tfoot></table></div>' +
          '<div class="report-note">' + ui.icon('info') + '<span>Rata-rata waktu tunggu dihitung dari waktu pendaftaran hingga pasien dipanggil. Rata-rata layanan dihitung dari mulai dilayani hingga selesai.</span></div>' +
        '</section>',
      csv: {
        filename: 'laporan-poli-' + state.start + '-' + state.end,
        headers: ['Poli', 'Kunjungan', 'Selesai', 'Batal', 'Aktif', 'Pasien Unik', 'Pemeriksaan', 'Rujukan', 'Rata-rata Tunggu (menit)', 'Rata-rata Layanan (menit)', 'Nilai Layanan'],
        rows: rows.map(function (row) {
          return [row.poli.nama, row.total, row.completed, row.cancelled, row.active, row.unique, row.exams, row.referrals, row.avgWait, row.avgService, row.revenue];
        })
      },
      print: function () {
        return printKpiRow([
          ['Total kunjungan', ui.number(totalVisits)],
          ['Poli tersibuk', busiest ? busiest.poli.singkat : '—'],
          ['Rata-rata tunggu', (rows.length ? Math.round(average(rows.map(function (row) { return row.avgWait; }))) : 0) + ' mnt'],
          ['Nilai layanan', ui.currency(revenue)]
        ]) +
          '<h3 class="print-section-title">Kinerja pelayanan per poli</h3>' +
          printTable(['Poli', 'Kunjungan', 'Selesai', 'Batal', 'Pasien Unik', 'Rata-rata Tunggu', 'Rujukan', 'Nilai Layanan'], rows.map(function (row) {
            return [row.poli.nama, ui.number(row.total), ui.number(row.completed), ui.number(row.cancelled), ui.number(row.unique), ui.number(row.avgWait) + ' mnt', ui.number(row.referrals), ui.currency(row.revenue)];
          }), ['', 'align-right', 'align-right', 'align-right', 'align-right', 'align-right', 'align-right', 'align-right']);
      }
    };
  }

  /* ------------------------------------------------------------------------
     Tab penyakit
     ------------------------------------------------------------------------ */
  function referralRows() {
    return examBase().filter(function (exam) {
      return exam.status === 'selesai' && exam.rujukan && exam.rujukan.tujuan;
    }).sort(function (a, b) { return a.tanggal < b.tanggal ? 1 : -1; });
  }

  function renderDiseases() {
    const rows = diagnosisRows();
    const exams = examBase().filter(function (exam) { return exam.status === 'selesai'; });
    const totalCases = sum(rows, function (row) { return row.count; });
    const referrals = referralRows();
    const withFollowUp = exams.filter(function (exam) { return exam.kontrolUlang; });
    const top = rows[0];
    return {
      html: '<div class="report-kpis">' +
          '<div class="report-kpi"><span>Total kasus</span><strong>' + ui.number(totalCases) + '</strong><small>dari pemeriksaan selesai</small></div>' +
          '<div class="report-kpi"><span>Jenis diagnosis</span><strong>' + ui.number(rows.length) + '</strong><small>kode ICD-10 unik</small></div>' +
          '<div class="report-kpi"><span>Diagnosis teratas</span><strong>' + ui.esc(top ? top.kode : '—') + '</strong><small>' + ui.esc(top ? top.nama : 'Belum ada data') + '</small></div>' +
          '<div class="report-kpi"><span>Rujukan</span><strong>' + ui.number(referrals.length) + '</strong><small>kasus dirujuk</small></div>' +
          '<div class="report-kpi"><span>Kontrol ulang</span><strong>' + ui.number(withFollowUp.length) + '</strong><small>memiliki jadwal kontrol</small></div>' +
        '</div>' +
        '<div class="report-grid-wide">' +
          '<section class="card">' +
            ui.sectionHeader('Peringkat diagnosis', 'Diagnosis terbanyak berdasarkan kode ICD-10.', '<span class="report-filter-chip">' + ui.icon('activity') + ui.number(totalCases) + ' kasus</span>', 'activity') +
            (rows.length ? '<div class="table-responsive"><table class="data-table report-table"><thead><tr><th>#</th><th>Diagnosis</th><th>ICD-10</th><th>Kasus</th><th>Pasien</th><th>Proporsi</th><th>Poli terbanyak</th></tr></thead><tbody>' +
              rows.map(function (row, index) {
                const polis = Object.keys(row.polis).sort(function (a, b) { return row.polis[b] - row.polis[a]; });
                return '<tr><td><span class="bar-rank">' + (index + 1) + '</span></td><td><strong class="small">' + ui.esc(row.nama) + '</strong></td><td><span class="mono small">' + ui.esc(row.kode) + '</span></td><td><strong>' + ui.number(row.count) + '</strong></td><td>' + ui.number(row.patients.size) + '</td><td><span class="stat-inline up">' + Math.round((row.count / totalCases) * 100) + '%</span></td><td>' + (polis.length ? ui.poliBadge(polis[0], true) : '—') + '</td></tr>';
              }).join('') + '</tbody></table></div>' : ui.emptyState('activity', 'Belum ada diagnosis', 'Diagnosis akan tampil setelah dokter menyelesaikan pemeriksaan.')) +
          '</section>' +
          '<section class="card">' +
            ui.sectionHeader('Kasus terbanyak', 'Tujuh diagnosis teratas.', '', 'chart') +
            ui.barList(rows.slice(0, 7).map(function (row) { return { label: row.nama, value: row.count, color: '#6d5aa8' }; }), { showRank: true, color: '#6d5aa8', valueFormatter: function (value) { return ui.number(value) + ' kasus'; } }) +
          '</section>' +
        '</div>' +
        '<section class="card">' +
          ui.sectionHeader('Rujukan pasien', 'Daftar rujukan yang dibuat pada periode laporan.', '<span class="report-filter-chip">' + ui.icon('external-link') + ui.number(referrals.length) + ' rujukan</span>', 'external-link') +
          (referrals.length ? '<div class="table-responsive"><table class="data-table report-table"><thead><tr><th>Tanggal</th><th>Pasien</th><th>Diagnosis</th><th>Tujuan rujukan</th><th>Alasan</th></tr></thead><tbody>' +
            referrals.map(function (exam) {
              const patient = store.patientById(exam.patientId);
              return '<tr><td>' + ui.esc(ui.fmtDate(exam.tanggal, 'medium')) + '</td><td><a href="#/pasien/' + ui.attr(exam.patientId) + '" class="text-link">' + ui.esc(patient ? patient.nama : 'Pasien') + '</a><small class="table-sub">' + ui.esc(ui.fmtDate(exam.rujukan.tanggal, 'medium')) + '</small></td><td><strong class="small">' + ui.esc(exam.diagnosis || '—') + '</strong><small class="table-sub mono">' + ui.esc(exam.kodeICD10 || '') + '</small></td><td>' + ui.esc(exam.rujukan.tujuan) + '</td><td>' + ui.esc(exam.rujukan.alasan || '—') + '</td></tr>';
            }).join('') + '</tbody></table></div>' : ui.emptyState('check-circle', 'Tidak ada rujukan', 'Seluruh pasien ditangani di puskesmas pada periode ini.')) +
        '</section>',
      csv: {
        filename: 'laporan-penyakit-' + state.start + '-' + state.end,
        headers: ['Peringkat', 'Diagnosis', 'ICD-10', 'Kasus', 'Pasien Unik', 'Proporsi (%)', 'Poli Terbanyak'],
        rows: rows.map(function (row, index) {
          const polis = Object.keys(row.polis).sort(function (a, b) { return row.polis[b] - row.polis[a]; });
          return [index + 1, row.nama, row.kode, row.count, row.patients.size, Math.round((row.count / Math.max(1, totalCases)) * 100), polis.length ? poliName(polis[0]) : ''];
        })
      },
      print: function () {
        return printKpiRow([
          ['Total kasus', ui.number(totalCases)],
          ['Jenis diagnosis', ui.number(rows.length)],
          ['Rujukan', ui.number(referrals.length)],
          ['Kontrol ulang', ui.number(withFollowUp.length)]
        ]) +
          '<h3 class="print-section-title">Peringkat diagnosis</h3>' +
          printTable(['No', 'Diagnosis', 'ICD-10', 'Kasus', 'Pasien', 'Proporsi'], rows.map(function (row, index) {
            return [index + 1, row.nama, row.kode, ui.number(row.count), ui.number(row.patients.size), Math.round((row.count / Math.max(1, totalCases)) * 100) + '%'];
          }), ['', '', '', 'align-right', 'align-right', 'align-right']) +
          (referrals.length ? '<h3 class="print-section-title">Rujukan pasien</h3>' + printTable(['Tanggal', 'Pasien', 'Diagnosis', 'Tujuan', 'Alasan'], referrals.map(function (exam) {
            const patient = store.patientById(exam.patientId);
            return [ui.fmtDate(exam.tanggal, 'short'), patient ? patient.nama : 'Pasien', exam.diagnosis || '—', exam.rujukan.tujuan || '—', exam.rujukan.alasan || '—'];
          }), ['', '', '', '', '']) : '');
      }
    };
  }

  /* ------------------------------------------------------------------------
     Tab obat
     ------------------------------------------------------------------------ */
  function medicineStatusBadge(medicine) {
    const status = NS.core.medicineStatus(medicine);
    return ui.badge(status.label, status.tone);
  }

  function renderMedicines() {
    const usage = medicineUsage();
    const alerts = store.stockAlerts();
    const totalQty = sum(usage.rows, function (row) { return row.qty; });
    const totalValue = sum(usage.rows, function (row) { return row.value; });
    const categories = Array.from(new Set(usage.rows.map(function (row) { return row.kategori; }))).sort(function (a, b) { return a.localeCompare(b, 'id'); });
    const top = usage.rows.slice(0, 8).map(function (row) { return { label: row.nama, value: row.qty, color: '#9a6700' }; });
    const critical = alerts.low.length + alerts.out.length + alerts.expired.length + alerts.expiring.length;
    return {
      html: '<div class="report-kpis">' +
          '<div class="report-kpi"><span>Obat diserahkan</span><strong>' + ui.number(totalQty) + '</strong><small>' + ui.number(usage.rows.length) + ' jenis obat</small></div>' +
          '<div class="report-kpi"><span>Resep dilayani</span><strong>' + ui.number(usage.prescriptionCount) + '</strong><small>resep elektronik diserahkan</small></div>' +
          '<div class="report-kpi"><span>Nilai pemakaian</span><strong>' + ui.currency(totalValue) + '</strong><small>harga jual obat keluar</small></div>' +
          '<div class="report-kpi"><span>Stok kritis</span><strong>' + ui.number(critical) + '</strong><small>' + alerts.out.length + ' habis · ' + alerts.low.length + ' menipis</small></div>' +
          '<div class="report-kpi"><span>Kedaluwarsa</span><strong>' + ui.number(alerts.expired.length) + '</strong><small>' + alerts.expiring.length + ' segera kedaluwarsa</small></div>' +
        '</div>' +
        '<div class="report-grid-wide">' +
          '<section class="card usage-chart-card">' +
            ui.sectionHeader('Pemakaian obat terbanyak', 'Berdasarkan jumlah unit yang diserahkan.', '<span class="report-filter-chip">' + ui.icon('pill') + ui.number(totalQty) + ' unit</span>', 'pill') +
            ui.barList(top, { color: '#9a6700', showRank: true, valueFormatter: function (value) { return ui.number(value) + ' unit'; } }) +
          '</section>' +
          '<section class="card">' +
            ui.sectionHeader('Peringatan persediaan', 'Obat yang perlu segera ditindaklanjuti.', '<a href="#/farmasi/stok" class="btn btn-ghost btn-sm">Kelola stok ' + ui.icon('arrow-right') + '</a>', 'alert') +
            (critical ? '<div class="alert-list">' +
              [].concat(alerts.out.map(function (medicine) { return { medicine: medicine, label: 'Stok habis', tone: 'danger' }; }))
                .concat(alerts.expired.map(function (medicine) { return { medicine: medicine, label: 'Kedaluwarsa', tone: 'danger' }; }))
                .concat(alerts.low.map(function (medicine) { return { medicine: medicine, label: 'Stok menipis', tone: 'warning' }; }))
                .concat(alerts.expiring.map(function (medicine) { return { medicine: medicine, label: 'Segera kedaluwarsa', tone: 'warning' }; }))
                .slice(0, 6).map(function (row) {
                  return '<div class="alert-row"><span class="stat-icon stat-icon-' + (row.tone === 'danger' ? 'rose' : 'amber') + '">' + ui.icon(row.tone === 'danger' ? 'alert' : 'package') + '</span><span><strong>' + ui.esc(row.medicine.nama) + '</strong><small>Stok ' + ui.esc(row.medicine.stok + ' ' + row.medicine.satuan) + '</small></span><span class="badge badge-' + ui.attr(row.tone) + '">' + ui.esc(row.label) + '</span></div>';
                }).join('') + '</div>' : '<div class="inline-alert inline-alert-success">' + ui.icon('check-circle') + '<span>Persediaan obat aman.</span></div>') +
          '</section>' +
        '</div>' +
        '<section class="card">' +
          '<div class="filter-bar">' +
            '<div class="search-field">' + ui.icon('search') + '<input type="search" id="medReportSearch" class="input" placeholder="Cari nama atau kategori obat…" value="' + ui.attr(state.medSearch) + '" aria-label="Cari obat">' + (state.medSearch ? '<button type="button" class="search-clear" id="medReportClear" aria-label="Hapus pencarian">' + ui.icon('x') + '</button>' : '') + '</div>' +
            '<select id="medReportCategory" class="input input-auto" aria-label="Filter kategori obat">' + ui.options(categories, state.medCategory, 'Semua kategori') + '</select>' +
            '<button type="button" class="btn btn-secondary btn-sm" id="medReportReset">' + ui.icon('refresh') + 'Reset filter</button>' +
          '</div>' +
          (usage.rows.length ? '<div class="table-responsive"><table class="data-table usage-table"><thead><tr><th>Obat</th><th>Kategori</th><th>Jumlah keluar</th><th>Resep</th><th>Nilai</th><th>Stok saat ini</th><th>Status</th></tr></thead><tbody>' +
            usage.rows.map(function (row) {
              return '<tr><td><span class="medicine-name">' + ui.esc(row.nama) + '</span><span class="medicine-meta">' + ui.esc(row.satuan) + '</span></td><td>' + ui.esc(row.kategori) + '</td><td><strong>' + ui.number(row.qty) + '</strong> ' + ui.esc(row.satuan) + '</td><td>' + ui.number(row.prescriptionIds.size) + '</td><td><strong>' + ui.currency(row.value) + '</strong></td><td>' + (row.medicine ? ui.number(row.medicine.stok) : '—') + '</td><td>' + (row.medicine ? medicineStatusBadge(row.medicine) : ui.badge('Tidak ditemukan', 'muted')) + '</td></tr>';
            }).join('') + '</tbody><tfoot><tr class="report-total-row"><td colspan="2">Total</td><td>' + ui.number(totalQty) + '</td><td>' + ui.number(usage.prescriptionCount) + '</td><td>' + ui.currency(totalValue) + '</td><td>—</td><td>—</td></tr></tfoot></table></div>' : ui.emptyState('pill', 'Belum ada pemakaian obat', 'Resep yang telah diserahkan farmasi akan muncul di sini.')) +
        '</section>',
      csv: {
        filename: 'laporan-obat-' + state.start + '-' + state.end,
        headers: ['Obat', 'Kategori', 'Satuan', 'Jumlah Keluar', 'Jumlah Resep', 'Nilai', 'Stok Saat Ini', 'Status Stok'],
        rows: usage.rows.map(function (row) {
          const status = NS.core.medicineStatus(row.medicine);
          return [row.nama, row.kategori, row.satuan, row.qty, row.prescriptionIds.size, row.value, row.medicine ? row.medicine.stok : '', status.label];
        })
      },
      print: function () {
        return printKpiRow([
          ['Obat keluar', ui.number(totalQty) + ' unit'],
          ['Resep', ui.number(usage.prescriptionCount)],
          ['Nilai pemakaian', ui.currency(totalValue)],
          ['Stok kritis', ui.number(critical)]
        ]) +
          '<h3 class="print-section-title">Laporan pemakaian obat</h3>' +
          printTable(['No', 'Obat', 'Kategori', 'Jumlah', 'Resep', 'Nilai', 'Stok Akhir'], usage.rows.map(function (row, index) {
            return [index + 1, row.nama, row.kategori, ui.number(row.qty) + ' ' + row.satuan, ui.number(row.prescriptionIds.size), ui.currency(row.value), row.medicine ? ui.number(row.medicine.stok) : '—'];
          }), ['', '', '', 'align-right', 'align-right', 'align-right', 'align-right']) +
          '<h3 class="print-section-title">Peringatan persediaan</h3>' +
          printTable(['Obat', 'Stok', 'Minimum', 'Kedaluwarsa', 'Status'], [].concat(alerts.out, alerts.low, alerts.expired, alerts.expiring).filter(function (medicine, index, list) {
            return list.findIndex(function (item) { return item.id === medicine.id; }) === index;
          }).map(function (medicine) {
            return [medicine.nama, ui.number(medicine.stok) + ' ' + medicine.satuan, ui.number(medicine.stokMinimum), ui.fmtDate(medicine.kadaluarsa, 'medium'), medicineStatusBadge(medicine).replace(/<[^>]*>/g, '')];
          }), ['', 'align-right', 'align-right', '', '']);
      }
    };
  }

  /* ------------------------------------------------------------------------
     Tab petugas
     ------------------------------------------------------------------------ */
  function staffStatistics() {
    const users = store.users().filter(function (user) {
      if (state.poli && user.role === 'dokter' && user.poli !== state.poli) return false;
      return true;
    });
    const audits = store.auditLog().filter(function (entry) { return inRange(dateKeyOf(entry.createdAt)); });
    const exams = examBase();
    const queues = queueBase();
    const bills = billBase().filter(function (bill) { return bill.status === 'lunas' || bill.status === 'ditanggung'; });
    return users.map(function (user) {
      const userAudits = audits.filter(function (entry) { return entry.userId === user.id; });
      const userExams = exams.filter(function (exam) { return exam.dokterId === user.id && exam.status === 'selesai'; });
      const dispensed = exams.filter(function (exam) { return exam.dispensedBy === user.id; });
      const createdQueues = queues.filter(function (queue) { return queue.createdBy === user.id; });
      const payments = bills.filter(function (bill) { return bill.kasirId === user.id; });
      let workload = userAudits.length + ' aktivitas';
      if (user.role === 'dokter') workload = userExams.length + ' pemeriksaan';
      else if (user.role === 'pendaftaran') workload = createdQueues.length + ' pendaftaran';
      else if (user.role === 'perawat') workload = userAudits.filter(function (entry) { return entry.action.indexOf('vitals') !== -1; }).length + ' asesmen';
      else if (user.role === 'farmasi') workload = dispensed.length + ' resep';
      else if (user.role === 'kasir') workload = payments.length + ' transaksi';
      const revenue = sum(userExams.map(function (exam) { return bills.find(function (bill) { return bill.examinationId === exam.id; }); }).filter(Boolean), function (bill) { return bill.total; });
      return {
        user: user,
        exams: userExams.length,
        patients: new Set(userExams.map(function (exam) { return exam.patientId; })).size,
        prescriptions: userExams.filter(function (exam) { return exam.resep && exam.resep.length; }).length,
        referrals: userExams.filter(function (exam) { return exam.rujukan; }).length,
        followUps: userExams.filter(function (exam) { return exam.kontrolUlang; }).length,
        revenue: revenue,
        auditCount: userAudits.length,
        lastActivity: userAudits.length ? userAudits.slice().sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); })[0].createdAt : null,
        workload: workload,
        dispensed: dispensed.length,
        createdQueues: createdQueues.length,
        payments: payments.length
      };
    }).sort(function (a, b) {
      const order = C.ROLE_ORDER.indexOf(a.user.role) - C.ROLE_ORDER.indexOf(b.user.role);
      if (order) return order;
      return a.user.name.localeCompare(b.user.name, 'id');
    });
  }

  function renderStaff() {
    const rows = staffStatistics();
    const doctors = rows.filter(function (row) { return row.user.role === 'dokter'; });
    const activeCount = rows.filter(function (row) { return row.user.active; }).length;
    const activityCount = sum(rows, function (row) { return row.auditCount; });
    const activities = rows.slice().sort(function (a, b) { return b.auditCount - a.auditCount; }).slice(0, 7)
      .map(function (row) { return { label: row.user.name, value: row.auditCount, color: '#246b97' }; });
    return {
      html: '<div class="report-kpis">' +
          '<div class="report-kpi"><span>Total petugas</span><strong>' + ui.number(rows.length) + '</strong><small>' + ui.number(activeCount) + ' akun aktif</small></div>' +
          '<div class="report-kpi"><span>Dokter</span><strong>' + ui.number(doctors.length) + '</strong><small>' + ui.number(sum(doctors, function (row) { return row.exams; })) + ' pemeriksaan selesai</small></div>' +
          '<div class="report-kpi"><span>Aktivitas tercatat</span><strong>' + ui.number(activityCount) + '</strong><small>audit log periode ini</small></div>' +
          '<div class="report-kpi"><span>Resep diserahkan</span><strong>' + ui.number(sum(rows, function (row) { return row.dispensed; })) + '</strong><small>oleh petugas farmasi</small></div>' +
          '<div class="report-kpi"><span>Transaksi kasir</span><strong>' + ui.number(sum(rows, function (row) { return row.payments; })) + '</strong><small>pembayaran tercatat</small></div>' +
        '</div>' +
        '<div class="report-grid-wide">' +
          '<section class="card">' +
            ui.sectionHeader('Kinerja dokter', 'Volume pemeriksaan dan tindak lanjut pasien.', '<span class="report-filter-chip">' + ui.icon('stethoscope') + ui.number(doctors.length) + ' dokter</span>', 'stethoscope') +
            (doctors.length ? '<div class="table-responsive"><table class="data-table report-table"><thead><tr><th>Dokter</th><th>Poli</th><th>Pemeriksaan</th><th>Pasien</th><th>Resep</th><th>Rujukan</th><th>Kontrol</th><th>Nilai Layanan</th></tr></thead><tbody>' +
              doctors.map(function (row) {
                return '<tr><td><span class="user-cell"><span class="avatar avatar-xs">' + ui.esc(ui.initials(row.user.name)) + '</span><span class="user-cell-copy"><strong>' + ui.esc(row.user.name) + '</strong><small>@' + ui.esc(row.user.username) + '</small></span></span></td><td>' + (row.user.poli ? ui.poliBadge(row.user.poli, true) : '<span class="muted">Semua</span>') + '</td><td><strong>' + ui.number(row.exams) + '</strong></td><td>' + ui.number(row.patients) + '</td><td>' + ui.number(row.prescriptions) + '</td><td>' + ui.number(row.referrals) + '</td><td>' + ui.number(row.followUps) + '</td><td><strong>' + ui.currency(row.revenue) + '</strong></td></tr>';
              }).join('') + '</tbody></table></div>' : ui.emptyState('stethoscope', 'Belum ada dokter', 'Tidak ada dokter pada poli yang dipilih.')) +
          '</section>' +
          '<section class="card">' +
            ui.sectionHeader('Aktivitas petugas', 'Petugas dengan aktivitas audit terbanyak.', '', 'chart') +
            ui.barList(activities, { color: '#246b97', valueFormatter: function (value) { return ui.number(value) + ' aktivitas'; } }) +
          '</section>' +
        '</div>' +
        '<section class="card">' +
          ui.sectionHeader('Daftar aktivitas & beban kerja', 'Ringkasan kontribusi seluruh petugas.', '<span class="report-filter-chip">' + ui.icon('calendar') + ui.esc(rangeLabel()) + '</span>', 'users') +
          '<div class="table-responsive"><table class="data-table user-table audit-table"><thead><tr><th>Petugas</th><th>Peran</th><th>Poli</th><th>Status</th><th>Beban kerja</th><th>Aktivitas audit</th><th>Aktivitas terakhir</th><th>Login terakhir</th></tr></thead><tbody>' +
            (rows.length ? rows.map(function (row) {
              return '<tr><td><span class="user-cell"><span class="avatar avatar-xs">' + ui.esc(ui.initials(row.user.name)) + '</span><span class="user-cell-copy"><strong>' + ui.esc(row.user.name) + '</strong><small>@' + ui.esc(row.user.username) + '</small></span></span></td><td>' + ui.roleBadge(row.user.role) + '</td><td>' + (row.user.poli ? ui.poliBadge(row.user.poli, true) : '<span class="muted">—</span>') + '</td><td>' + (row.user.active ? '<span class="user-status is-active"><span class="status-dot"></span>Aktif</span>' : '<span class="user-status is-inactive"><span class="status-dot"></span>Nonaktif</span>') + '</td><td><strong class="small">' + ui.esc(row.workload) + '</strong></td><td>' + ui.number(row.auditCount) + '</td><td>' + ui.esc(row.lastActivity ? ui.relativeTime(row.lastActivity) : '—') + '</td><td>' + ui.esc(row.user.lastLogin ? ui.relativeTime(row.user.lastLogin) : 'Belum pernah') + '</td></tr>';
            }).join('') : '<tr><td colspan="8">' + ui.emptyState('users', 'Belum ada petugas', 'Data petugas tidak tersedia.') + '</td></tr>') +
          '</tbody></table></div>' +
        '</section>',
      csv: {
        filename: 'laporan-petugas-' + state.start + '-' + state.end,
        headers: ['Nama', 'Username', 'Peran', 'Poli', 'Status', 'Beban Kerja', 'Aktivitas Audit', 'Pemeriksaan', 'Pasien', 'Resep Diserahkan', 'Transaksi', 'Login Terakhir'],
        rows: rows.map(function (row) {
          return [row.user.name, row.user.username, NS.core.getRoleMeta(row.user.role).label, row.user.poli ? poliName(row.user.poli) : '', row.user.active ? 'Aktif' : 'Nonaktif', row.workload, row.auditCount, row.exams, row.patients, row.dispensed, row.payments, row.user.lastLogin || ''];
        })
      },
      print: function () {
        return printKpiRow([
          ['Total petugas', ui.number(rows.length)],
          ['Dokter', ui.number(doctors.length)],
          ['Aktivitas audit', ui.number(activityCount)],
          ['Resep diserahkan', ui.number(sum(rows, function (row) { return row.dispensed; }))]
        ]) +
          '<h3 class="print-section-title">Kinerja dokter</h3>' +
          printTable(['Dokter', 'Poli', 'Pemeriksaan', 'Pasien', 'Resep', 'Rujukan', 'Nilai Layanan'], doctors.map(function (row) {
            return [row.user.name, row.user.poli ? poliName(row.user.poli) : '—', ui.number(row.exams), ui.number(row.patients), ui.number(row.prescriptions), ui.number(row.referrals), ui.currency(row.revenue)];
          }), ['', '', 'align-right', 'align-right', 'align-right', 'align-right', 'align-right']) +
          '<h3 class="print-section-title">Beban kerja petugas</h3>' +
          printTable(['Petugas', 'Peran', 'Status', 'Beban Kerja', 'Aktivitas Audit', 'Login Terakhir'], rows.map(function (row) {
            return [row.user.name, NS.core.getRoleMeta(row.user.role).label, row.user.active ? 'Aktif' : 'Nonaktif', row.workload, ui.number(row.auditCount), row.user.lastLogin ? ui.fmtDate(row.user.lastLogin, 'medium') : 'Belum pernah'];
          }), ['', '', '', '', 'align-right', '']);
      }
    };
  }

  /* ------------------------------------------------------------------------
     Cetak & ekspor
     ------------------------------------------------------------------------ */
  function printTable(headers, rows, alignments) {
    const aligns = alignments || [];
    return '<table class="print-table"><thead><tr>' + headers.map(function (header, index) {
      return '<th' + (aligns[index] ? ' class="' + ui.attr(aligns[index]) + '"' : '') + '>' + ui.esc(header) + '</th>';
    }).join('') + '</tr></thead><tbody>' +
      (rows.length ? rows.map(function (row) {
        return '<tr>' + row.map(function (cell, index) {
          return '<td' + (aligns[index] ? ' class="' + ui.attr(aligns[index]) + '"' : '') + '>' + ui.esc(cell) + '</td>';
        }).join('') + '</tr>';
      }).join('') : '<tr><td colspan="' + headers.length + '">Tidak ada data pada periode ini.</td></tr>') +
    '</tbody></table>';
  }

  function printKpiRow(items) {
    return '<div class="print-kpi-row">' + items.map(function (item) {
      return '<div class="print-kpi"><span>' + ui.esc(item[0]) + '</span><strong>' + ui.esc(item[1]) + '</strong></div>';
    }).join('') + '</div>';
  }

  function currentReport() {
    if (state.tab === 'kunjungan') return renderVisits();
    if (state.tab === 'poli') return renderPoli();
    if (state.tab === 'penyakit') return renderDiseases();
    if (state.tab === 'obat') return renderMedicines();
    if (state.tab === 'petugas') return renderStaff();
    return renderOverview();
  }

  function exportCurrent() {
    const report = currentReport();
    const data = report.csv;
    if (!data) return;
    ui.exportCsv(data.filename + '.csv', data.headers, data.rows);
  }

  function printCurrent() {
    const report = currentReport();
    const body = report.print();
    const user = store.currentUser();
    const content = ui.printLetterhead('LAPORAN PUSKESMAS') +
      '<div class="print-report-title"><h2>' + ui.esc(tabTitle()) + '</h2><p>Periode ' + ui.esc(rangeLabel()) + ' · ' + ui.esc(poliName(state.poli)) + ' · Dicetak oleh ' + ui.esc(user ? user.name : 'Petugas') + '</p></div>' +
      body +
      '<div class="print-signatures"><div class="print-signature-block"><span>Petugas Pelaporan</span><div class="signature-space"></div><strong>' + ui.esc(user ? user.name : 'Petugas') + '</strong></div>' +
        '<div class="print-signature-block"><span>Kepala Puskesmas</span><div class="signature-space"></div><strong>' + ui.esc(store.clinic.kepala || 'Kepala Puskesmas') + '</strong></div></div>' +
      ui.printFooter();
    ui.printDocument(content, { title: tabTitle() + ' — ' + rangeLabel(), className: 'print-report' });
  }

  function tabTitle() {
    const titles = {
      ringkasan: 'Laporan Ringkasan Puskesmas',
      kunjungan: 'Laporan Kunjungan Pasien',
      poli: 'Laporan Kinerja per Poli',
      penyakit: 'Laporan Penyakit & Diagnosis',
      obat: 'Laporan Penggunaan Obat',
      petugas: 'Laporan Petugas & Kinerja'
    };
    return titles[state.tab] || 'Laporan Puskesmas';
  }

  /* ------------------------------------------------------------------------
     Render
     ------------------------------------------------------------------------ */
  function render(root, tab) {
    normalizeRange();
    if (tab && TABS.includes(tab)) state.tab = tab;
    if (!TABS.includes(state.tab)) state.tab = 'ringkasan';
    const report = currentReport();

    root.innerHTML = headerMarkup() + toolbarMarkup() + tabsMarkup() + '<div id="reportBody">' + report.html + '</div>';
    bindCommon(root);
    bindTab(root);
  }

  function bindCommon(root) {
    const preset = root.querySelector('#reportPreset');
    preset.addEventListener('change', function () {
      applyPreset(preset.value);
      state.page = 1;
      render(root);
    });
    root.querySelector('#reportStart').addEventListener('change', function (event) {
      state.start = event.target.value;
      state.preset = 'custom';
      normalizeRange();
      state.page = 1;
      render(root);
    });
    root.querySelector('#reportEnd').addEventListener('change', function (event) {
      state.end = event.target.value;
      state.preset = 'custom';
      normalizeRange();
      state.page = 1;
      render(root);
    });
    root.querySelector('#reportPoli').addEventListener('change', function (event) {
      state.poli = event.target.value;
      state.page = 1;
      render(root);
    });
    root.querySelector('#reportResetBtn').addEventListener('click', function () {
      state.preset = '30';
      applyPreset('30');
      state.poli = '';
      state.status = '';
      state.search = '';
      state.medSearch = '';
      state.medCategory = '';
      state.page = 1;
      render(root);
    });
    root.querySelector('#reportExportBtn').addEventListener('click', exportCurrent);
    root.querySelector('#reportPrintBtn').addEventListener('click', printCurrent);
    root.querySelectorAll('.tabs .tab[data-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        state.tab = tab.dataset.tab;
        state.page = 1;
        render(root);
      });
    });
    root.querySelectorAll('[data-report-tab]').forEach(function (link) {
      link.addEventListener('click', function (event) {
        event.preventDefault();
        state.tab = link.dataset.reportTab;
        state.page = 1;
        render(root);
      });
    });
  }

  function focusSearch(root, selector) {
    const input = root.querySelector(selector);
    if (!input) return;
    input.focus();
    try { input.setSelectionRange(input.value.length, input.value.length); } catch (error) { /* noop */ }
  }

  function bindTab(root) {
    if (state.tab === 'kunjungan') {
      const search = root.querySelector('#visitSearch');
      search.addEventListener('input', ui.debounce(function () {
        state.search = search.value;
        state.page = 1;
        render(root);
        focusSearch(root, '#visitSearch');
      }, 220));
      const clear = root.querySelector('#visitSearchClear');
      if (clear) clear.addEventListener('click', function () { state.search = ''; state.page = 1; render(root); });
      root.querySelector('#visitStatus').addEventListener('change', function (event) { state.status = event.target.value; state.page = 1; render(root); });
      root.querySelector('#visitPageSize').addEventListener('change', function (event) { state.perPage = Number(event.target.value); state.page = 1; render(root); });
      const reset = function () { state.status = ''; state.search = ''; state.page = 1; render(root); };
      root.querySelector('#visitReset').addEventListener('click', reset);
      const emptyReset = root.querySelector('#visitEmptyReset');
      if (emptyReset) emptyReset.addEventListener('click', reset);
      root.querySelectorAll('[data-page]').forEach(function (button) {
        button.addEventListener('click', function () {
          state.page = Number(button.dataset.page) || 1;
          render(root);
        });
      });
    } else if (state.tab === 'obat') {
      const search = root.querySelector('#medReportSearch');
      search.addEventListener('input', ui.debounce(function () {
        state.medSearch = search.value;
        render(root);
        focusSearch(root, '#medReportSearch');
      }, 220));
      const clear = root.querySelector('#medReportClear');
      if (clear) clear.addEventListener('click', function () { state.medSearch = ''; render(root); });
      root.querySelector('#medReportCategory').addEventListener('change', function (event) { state.medCategory = event.target.value; render(root); });
      root.querySelector('#medReportReset').addEventListener('click', function () { state.medSearch = ''; state.medCategory = ''; render(root); });
    }
  }

  NS.pages = NS.pages || {};
  NS.pages.reports = { render: render };
})(window);
