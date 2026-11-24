/* ==========================================================================
   Sehat Bersama - Puskesmas Arbes — Modul pemeriksaan dokter & rekam medis elektronik
   ========================================================================== */
(function (window) {
  'use strict';

  const NS = window.PK;
  const ui = NS.ui;
  const store = NS.store;
  const C = NS.constants;

  const state = {
    tab: 'active',
    date: NS.core.dateKey(),
    start: ui.startOfMonthKey(),
    end: NS.core.dateKey(),
    poli: '',
    search: ''
  };

  document.addEventListener('DOMContentLoaded', function () {
    state.date = NS.core.dateKey();
    state.end = NS.core.dateKey();
  });

  function doctorName(id) {
    const user = store.users().find(function (item) { return item.id === id; });
    return user ? user.name : 'Dokter';
  }

  function patientOf(examOrQueue) {
    return store.patientById(examOrQueue ? examOrQueue.patientId : null);
  }

  function vitalSummary(physical) {
    const values = [];
    if (physical.tekananDarah) values.push({ label: 'TD', value: physical.tekananDarah, tone: 'teal' });
    if (physical.nadi) values.push({ label: 'Nadi', value: physical.nadi, tone: 'blue' });
    if (physical.suhu) values.push({ label: 'Suhu', value: physical.suhu, tone: 'amber' });
    if (physical.respirasi) values.push({ label: 'RR', value: physical.respirasi, tone: 'violet' });
    if (physical.spo2) values.push({ label: 'SpO₂', value: physical.spo2, tone: 'green' });
    return values;
  }

  function examProgress(exam) {
    if (!exam) return { label: 'Belum diperiksa', tone: 'muted' };
    if (exam.status === 'draft') {
      return physicalFilled(exam.pemeriksaanFisik)
        ? { label: 'Draf · vital tercatat', tone: 'warning' }
        : { label: 'Draf · perlu asesmen', tone: 'warning' };
    }
    return { label: 'Selesai diperiksa', tone: 'success' };
  }

  function physicalFilled(physical) {
    return Boolean(physical && (physical.tekananDarah || physical.nadi || physical.suhu || physical.respirasi));
  }

  function tabsMarkup() {
    return ui.pageTabs([
      { id: 'active', label: 'Pasien & asesmen', icon: 'stethoscope' },
      { id: 'history', label: 'Riwayat pemeriksaan', icon: 'clipboard' }
    ], state.tab);
  }

  function statsMarkup() {
    const today = NS.core.dateKey();
    const todayQueues = store.queues({ date: today, status: ['menunggu', 'dipanggil', 'dilayani'] });
    const active = todayQueues;
    const drafts = store.exams().filter(function (exam) { return exam.tanggal === today && exam.status === 'draft'; });
    const completed = store.exams().filter(function (exam) { return exam.tanggal === today && exam.status === 'selesai'; });
    const pendingRx = store.pendingPrescriptions();
    return '<div class="stats-grid stats-grid-compact">' +
      ui.statCard({ label: 'Pasien dalam alur', value: active.length, icon: 'users', tone: 'teal', hint: 'Antrean hari ini' }) +
      ui.statCard({ label: 'Asesmen draf', value: drafts.length, icon: 'activity', tone: 'amber', hint: 'Menunggu diselesaikan dokter' }) +
      ui.statCard({ label: 'Selesai diperiksa', value: completed.length, icon: 'check-circle', tone: 'green', hint: 'Rekam medis terisi hari ini' }) +
      ui.statCard({ label: 'Resep menunggu', value: pendingRx.length, icon: 'pill', tone: 'blue', hint: 'Belum diserahkan farmasi' }) +
      '</div>';
  }

  function activeRows() {
    let queues = store.queues({ date: state.date, poli: state.poli || undefined, status: ['menunggu', 'dipanggil', 'dilayani'] });
    if (state.search) {
      const query = state.search.toLowerCase();
      queues = queues.filter(function (queue) {
        const patient = patientOf(queue);
        return [queue.kode, patient && patient.nama, patient && patient.noRM, patient && patient.nik].some(function (value) {
          return String(value || '').toLowerCase().includes(query);
        });
      });
    }
    return queues.map(function (queue) {
      const exam = store.examForQueue(queue.id);
      return { queue: queue, exam: exam };
    });
  }

  function historyRows() {
    let exams = store.exams().filter(function (exam) {
      return exam.status === 'selesai' && exam.tanggal >= state.start && exam.tanggal <= state.end;
    });
    if (state.poli) exams = exams.filter(function (exam) { return exam.poli === state.poli; });
    if (state.search) {
      const query = state.search.toLowerCase();
      exams = exams.filter(function (exam) {
        const patient = patientOf(exam);
        return [exam.noPemeriksaan, exam.diagnosis, exam.kodeICD10, patient && patient.nama, patient && patient.noRM].some(function (value) {
          return String(value || '').toLowerCase().includes(query);
        });
      });
    }
    return exams;
  }

  function actionForQueue(item) {
    const exam = item.exam;
    const canExam = store.can('exam.manage');
    const canVitals = store.can('vitals.manage');
    if (!canExam && !canVitals) return '<span class="muted small">—</span>';
    if (exam) {
      if (exam.status === 'draft') {
        return '<a href="#/pemeriksaan/' + ui.attr(exam.id) + '" class="btn btn-primary btn-xs">' + ui.icon(canExam ? 'stethoscope' : 'activity') + (canExam ? 'Lanjutkan' : 'Input Vital') + '</a>';
      }
      return '<a href="#/pemeriksaan/' + ui.attr(exam.id) + '" class="btn btn-secondary btn-xs">' + ui.icon('eye') + 'Lihat</a>';
    }
    return '<button type="button" class="btn btn-primary btn-xs" data-start-exam="' + ui.attr(item.queue.id) + '">' + ui.icon(canExam ? 'stethoscope' : 'activity') + (canExam ? 'Mulai Periksa' : 'Input Vital') + '</button>';
  }

  function activeTable(items) {
    if (!items.length) {
      return ui.emptyState('stethoscope', 'Tidak ada pasien', 'Belum ada pasien dalam alur layanan pada filter ini.', '<a href="#/antrean" class="btn btn-secondary btn-sm">Buka antrean</a>');
    }
    return '<div class="responsive-cards">' + items.map(function (item) {
      const queue = item.queue;
      const exam = item.exam;
      const patient = patientOf(queue);
      const progress = examProgress(exam);
      return '<article class="service-card card">' +
        '<div class="service-card-top">' +
          '<div class="service-patient">' +
            '<span class="avatar avatar-md">' + ui.esc(ui.initials(patient ? patient.nama : 'Pasien')) + '</span>' +
            '<div><strong>' + ui.esc(patient ? patient.nama : 'Pasien') + '</strong><small>' + ui.esc(patient ? patient.noRM : '—') + ' · ' + ui.esc(patient ? ui.ageLabel(patient.tanggalLahir) : '') + ' · ' + ui.esc(patient ? (patient.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan') : '') + '</small></div>' +
          '</div>' +
          '<div class="service-badges">' + ui.poliBadge(queue.poli) + ui.statusBadge(queue.status) + '</div>' +
        '</div>' +
        '<div class="service-card-main">' +
          '<div class="service-detail"><span>Antrean</span><strong>' + ui.esc(queue.kode) + ' ' + ui.priorityBadge(queue) + '</strong></div>' +
          '<div class="service-detail"><span>Waktu</span><strong>' + ui.esc(ui.fmtTime(queue.createdAt)) + '</strong></div>' +
          '<div class="service-detail"><span>Status asesmen</span><strong><span class="badge badge-' + progress.tone + '">' + ui.esc(progress.label) + '</span></strong></div>' +
          '<div class="service-detail"><span>Keluhan</span><strong class="small">' + ui.esc(exam && exam.keluhan ? exam.keluhan.slice(0, 68) + (exam.keluhan.length > 68 ? '…' : '') : 'Belum dicatat') + '</strong></div>' +
        '</div>' +
        '<div class="service-card-foot">' +
          '<a href="#/pasien/' + ui.attr(queue.patientId) + '" class="text-link small">' + ui.icon('user') + 'Lihat data pasien</a>' +
          '<div class="service-actions">' +
            (physicalFilled(exam && exam.pemeriksaanFisik) ? '<span class="soft-chip">' + ui.icon('check') + 'Tanda vital tersedia</span>' : '') +
            actionForQueue(item) +
          '</div>' +
        '</div>' +
      '</article>';
    }).join('') + '</div>';
  }

  function historyTable(items) {
    if (!items.length) {
      return ui.emptyState('clipboard', 'Belum ada rekam medis', 'Tidak ada pemeriksaan selesai pada periode dan filter ini.');
    }
    return '<div class="table-responsive"><table class="data-table"><thead><tr><th>No. Pemeriksaan</th><th>Pasien</th><th>Tanggal</th><th>Poli / Dokter</th><th>Diagnosis</th><th>Resep</th><th class="th-actions">Aksi</th></tr></thead><tbody>' +
      items.map(function (exam) {
        const patient = patientOf(exam);
        return '<tr>' +
          '<td data-label="No. Pemeriksaan"><span class="mono small">' + ui.esc(exam.noPemeriksaan) + '</span></td>' +
          '<td data-label="Pasien"><a href="#/pasien/' + ui.attr(exam.patientId) + '" class="person-cell"><span class="avatar avatar-xs">' + ui.esc(ui.initials(patient ? patient.nama : 'Pasien')) + '</span><span class="person-copy"><strong>' + ui.esc(patient ? patient.nama : 'Pasien') + '</strong><small>' + ui.esc(patient ? patient.noRM : '—') + '</small></span></a></td>' +
          '<td data-label="Tanggal"><strong class="small">' + ui.esc(ui.fmtDate(exam.tanggal, 'medium')) + '</strong><small class="table-sub">' + ui.esc(ui.fmtTime(exam.completedAt)) + '</small></td>' +
          '<td data-label="Poli / Dokter">' + ui.poliBadge(exam.poli, true) + '<small class="table-sub">' + ui.esc(doctorName(exam.dokterId)) + '</small></td>' +
          '<td data-label="Diagnosis"><strong class="small">' + ui.esc(exam.diagnosis || '—') + '</strong>' + (exam.kodeICD10 ? '<small class="table-sub mono">' + ui.esc(exam.kodeICD10) + '</small>' : '') + '</td>' +
          '<td data-label="Resep">' + (exam.resep && exam.resep.length ? (exam.resepStatus === 'diserahkan' ? '<span class="badge badge-success">Diserahkan</span>' : '<span class="badge badge-warning">Menunggu</span>') + '<small class="table-sub">' + exam.resep.length + ' jenis obat</small>' : '<span class="muted small">Tanpa resep</span>') + '</td>' +
          '<td data-label="Aksi"><div class="table-actions">' +
            '<a class="icon-btn icon-btn-sm" href="#/pemeriksaan/' + ui.attr(exam.id) + '" title="Lihat rekam medis">' + ui.icon('eye') + '</a>' +
            '<button type="button" class="icon-btn icon-btn-sm" data-print-exam="' + ui.attr(exam.id) + '" title="Cetak rekam medis">' + ui.icon('printer') + '</button>' +
          '</div></td>' +
        '</tr>';
      }).join('') + '</tbody></table></div>';
  }

  function render(root) {
    const active = activeRows();
    const history = historyRows();
    const canExam = store.can('exam.manage');
    const canVitals = store.can('vitals.manage');
    root.innerHTML = ui.pageHeader({
      eyebrow: 'Rekam Medis Elektronik',
      title: canExam ? 'Pemeriksaan Dokter' : canVitals ? 'Asesmen & Tanda Vital' : 'Pemeriksaan Pasien',
      description: canExam ? 'Periksa pasien, catat diagnosis, tindakan, dan susun resep elektronik.' : 'Catat tanda vital dan keluhan awal pasien sebelum pemeriksaan dokter.',
      actions: '<a href="#/antrean" class="btn btn-secondary">' + ui.icon('queue') + 'Buka Antrean</a>'
    }) +
    statsMarkup() +
    '<section class="card exam-workspace">' +
      '<div class="directory-toolbar">' + tabsMarkup() + '</div>' +
      (state.tab === 'active' ?
        '<div class="filter-bar">' +
          '<div class="date-control"><span>' + ui.icon('calendar') + '</span><input type="date" id="examDate" class="input input-auto" value="' + ui.attr(state.date) + '" aria-label="Tanggal pemeriksaan"></div>' +
          '<select id="examPoli" class="input input-auto" aria-label="Filter poli">' + ui.options(C.POLI.map(function (poli) { return { value: poli.id, label: poli.nama }; }), state.poli, 'Semua poli') + '</select>' +
          '<div class="search-field">' + ui.icon('search') + '<input type="search" id="examSearch" class="input" value="' + ui.attr(state.search) + '" placeholder="Cari pasien, nomor RM, atau antrean…" aria-label="Cari pasien pemeriksaan"></div>' +
          '<button type="button" class="btn btn-secondary btn-sm" id="resetExamFilter">' + ui.icon('refresh') + 'Reset</button>' +
        '</div>' +
        activeTable(active) :
        '<div class="filter-bar exam-history-filter">' +
          '<div class="date-range">' +
            '<label for="examStart">Dari <input type="date" id="examStart" class="input input-auto" value="' + ui.attr(state.start) + '"></label>' +
            '<span>—</span>' +
            '<label for="examEnd">Sampai <input type="date" id="examEnd" class="input input-auto" value="' + ui.attr(state.end) + '"></label>' +
          '</div>' +
          '<select id="examHistoryPoli" class="input input-auto" aria-label="Filter poli">' + ui.options(C.POLI.map(function (poli) { return { value: poli.id, label: poli.nama }; }), state.poli, 'Semua poli') + '</select>' +
          '<div class="search-field">' + ui.icon('search') + '<input type="search" id="examHistorySearch" class="input" value="' + ui.attr(state.search) + '" placeholder="Cari pasien, diagnosis, nomor pemeriksaan…" aria-label="Cari riwayat pemeriksaan"></div>' +
        '</div>' +
        '<div class="history-summary"><span>' + ui.icon('clipboard') + history.length + ' pemeriksaan ditemukan</span><span>Periode ' + ui.esc(ui.fmtDate(state.start, 'medium')) + ' – ' + ui.esc(ui.fmtDate(state.end, 'medium')) + '</span></div>' +
        historyTable(history)) +
    '</section>';

    root.querySelectorAll('.tabs .tab[data-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        state.tab = tab.dataset.tab;
        state.search = '';
        render(root);
      });
    });
    const dateInput = root.querySelector('#examDate');
    if (dateInput) dateInput.addEventListener('change', function () { state.date = dateInput.value; render(root); });
    const poliInput = root.querySelector('#examPoli');
    if (poliInput) poliInput.addEventListener('change', function () { state.poli = poliInput.value; render(root); });
    const examSearch = root.querySelector('#examSearch');
    if (examSearch) examSearch.addEventListener('input', ui.debounce(function () { state.search = examSearch.value; render(root); }, 220));
    const reset = root.querySelector('#resetExamFilter');
    if (reset) reset.addEventListener('click', function () {
      state.date = NS.core.dateKey();
      state.poli = '';
      state.search = '';
      render(root);
    });
    const startInput = root.querySelector('#examStart');
    if (startInput) startInput.addEventListener('change', function () { state.start = startInput.value; render(root); });
    const endInput = root.querySelector('#examEnd');
    if (endInput) endInput.addEventListener('change', function () { state.end = endInput.value; render(root); });
    const historyPoli = root.querySelector('#examHistoryPoli');
    if (historyPoli) historyPoli.addEventListener('change', function () { state.poli = historyPoli.value; render(root); });
    const historySearch = root.querySelector('#examHistorySearch');
    if (historySearch) historySearch.addEventListener('input', ui.debounce(function () { state.search = historySearch.value; render(root); }, 220));
    root.querySelectorAll('[data-start-exam]').forEach(function (button) {
      button.addEventListener('click', function () {
        try {
          const exam = store.startExam(button.dataset.startExam);
          location.hash = '#/pemeriksaan/' + exam.id;
        } catch (error) {
          ui.showError(error);
        }
      });
    });
    root.querySelectorAll('[data-print-exam]').forEach(function (button) {
      button.addEventListener('click', function () {
        const exam = store.examById(button.dataset.printExam);
        if (exam) printExam(exam);
      });
    });
  }

  function vitalInput(label, id, value, unit, placeholder, options) {
    const opts = options || {};
    return '<div class="field vital-field">' +
      '<label for="' + id + '">' + ui.esc(label) + (opts.required ? ' <span class="required">*</span>' : '') + '</label>' +
      '<div class="input-suffix"><input id="' + id + '" name="' + id + '" class="input' + (opts.mono ? ' mono' : '') + '" value="' + ui.attr(value || '') + '" placeholder="' + ui.attr(placeholder || '') + '" inputmode="' + (opts.text ? 'text' : 'decimal') + '">' + (unit ? '<span>' + ui.esc(unit) + '</span>' : '') + '</div>' +
      '</div>';
  }

  function vitalsFields(physical) {
    const data = physical || {};
    return '<div class="vitals-grid">' +
      vitalInput('Tekanan darah', 'vitalTd', data.tekananDarah, 'mmHg', '120/80', { text: true }) +
      vitalInput('Nadi', 'vitalNadi', data.nadi, 'x/menit', '80', { text: true }) +
      vitalInput('Respirasi', 'vitalRr', data.respirasi, 'x/menit', '18', { text: true }) +
      vitalInput('Suhu', 'vitalSuhu', data.suhu, '°C', '36,5', { text: true }) +
      vitalInput('SpO₂', 'vitalSpo2', data.spo2, '%', '98', { text: true }) +
      vitalInput('Berat badan', 'vitalBb', data.beratBadan, 'kg', '60') +
      vitalInput('Tinggi badan', 'vitalTb', data.tinggiBadan, 'cm', '165') +
      '<div class="field vital-field"><label>Indeks massa tubuh</label><div class="bmi-box" id="bmiResult"><span>—</span><small>Otomatis dari BB / TB</small></div></div>' +
      '<div class="field full"><label for="vitalCatatan">Catatan pemeriksaan fisik</label><textarea id="vitalCatatan" name="vitalCatatan" class="input textarea" rows="2" placeholder="Kondisi umum, kesadaran, temuan fisik lain…">' + ui.esc(data.catatanFisik || '') + '</textarea></div>' +
    '</div>';
  }

  function setupBmi(form) {
    const weight = form.querySelector('#vitalBb');
    const height = form.querySelector('#vitalTb');
    const result = form.querySelector('#bmiResult');
    function update() {
      if (!result) return;
      const w = parseFloat(String(weight.value).replace(',', '.'));
      const h = parseFloat(String(height.value).replace(',', '.')) / 100;
      if (!w || !h || h <= 0) {
        result.innerHTML = '<span>—</span><small>Otomatis dari BB / TB</small>';
        return;
      }
      const bmi = w / (h * h);
      let category = 'Normal';
      let tone = 'success';
      if (bmi < 18.5) { category = 'Kurang'; tone = 'warning'; }
      else if (bmi >= 25 && bmi < 30) { category = 'Berlebih'; tone = 'warning'; }
      else if (bmi >= 30) { category = 'Obesitas'; tone = 'danger'; }
      result.innerHTML = '<span>' + bmi.toFixed(1) + '</span><small class="text-' + tone + '">' + category + '</small>';
    }
    weight?.addEventListener('input', update);
    height?.addEventListener('input', update);
    update();
  }

  function medicineOptions(selectedId) {
    return '<option value="">Pilih obat…</option>' + store.medicines().map(function (medicine) {
      const status = NS.core.medicineStatus(medicine);
      return '<option value="' + ui.attr(medicine.id) + '"' + (medicine.id === selectedId ? ' selected' : '') + '>' + ui.esc(medicine.nama) + ' · stok ' + medicine.stok + ' ' + ui.esc(medicine.satuan) + (status.key === 'expired' ? ' · KEDALUWARSA' : '') + '</option>';
    }).join('');
  }

  function rxRow(item, index) {
    const medicine = item ? store.medicineById(item.medicineId) : null;
    return '<div class="rx-row" data-rx-row>' +
      '<span class="rx-index">' + (index + 1) + '</span>' +
      '<div class="rx-medicine"><label>Obat</label><select class="input rx-select" aria-label="Pilih obat">' + medicineOptions(item ? item.medicineId : '') + '</select><small class="rx-stock-note">' + medicineInfo(medicine) + '</small></div>' +
      '<div class="rx-qty"><label>Jumlah</label><div class="input-suffix"><input type="number" class="input rx-number" min="1" step="1" value="' + ui.attr(item ? item.jumlah : '') + '" placeholder="0"><span class="rx-unit">' + ui.esc(medicine ? medicine.satuan : 'unit') + '</span></div></div>' +
      '<div class="rx-rule"><label>Aturan pakai</label><input type="text" class="input rx-aturan" value="' + ui.attr(item ? item.aturan : '') + '" placeholder="Contoh: 3 x sehari 1 tablet setelah makan"></div>' +
      '<button type="button" class="icon-btn icon-btn-sm danger rx-remove" aria-label="Hapus obat">' + ui.icon('trash') + '</button>' +
    '</div>';
  }

  function medicineInfo(medicine) {
    if (!medicine) return 'Pilih obat untuk melihat stok.';
    const status = NS.core.medicineStatus(medicine);
    return 'Stok tersedia: ' + medicine.stok + ' ' + medicine.satuan + ' · ' + status.label + ' · ' + ui.currency(medicine.harga) + ' / ' + medicine.satuan;
  }

  function consultationTariff(poli) {
    return store.tariffs().find(function (tariff) { return tariff.aktif && tariff.kategori === 'Konsultasi' && tariff.poli === poli; }) ||
      store.tariffs().find(function (tariff) { return tariff.aktif && tariff.kategori === 'Konsultasi'; });
  }

  function estimateCosts(poli, form) {
    const consultation = consultationTariff(poli);
    const admin = store.tariffs().find(function (tariff) { return tariff.aktif && tariff.kode === 'TRF-003'; });
    let total = (consultation ? consultation.tarif : 0) + (admin ? admin.tarif : 0);
    form.querySelectorAll('[data-rx-row]').forEach(function (row) {
      const select = row.querySelector('.rx-select');
      const qty = Number(row.querySelector('.rx-number').value) || 0;
      const medicine = store.medicineById(select.value);
      if (medicine) total += medicine.harga * qty;
    });
    const host = form.querySelector('#estimateTotal');
    if (host) host.textContent = ui.currency(total);
  }

  function setupRxEditor(form, exam) {
    const container = form.querySelector('#rxRows');
    const empty = form.querySelector('#rxEmpty');
    const addButton = form.querySelector('#addRxBtn');
    let count = 0;
    function bindRow(row) {
      row.querySelector('.rx-select').addEventListener('change', function () {
        const medicine = store.medicineById(this.value);
        row.querySelector('.rx-stock-note').textContent = medicineInfo(medicine);
        row.querySelector('.rx-unit').textContent = medicine ? medicine.satuan : 'unit';
        estimateCosts(exam.poli, form);
      });
      row.querySelector('.rx-number').addEventListener('input', function () { estimateCosts(exam.poli, form); });
      row.querySelector('.rx-remove').addEventListener('click', function () {
        row.remove();
        reindex();
        estimateCosts(exam.poli, form);
      });
    }
    function reindex() {
      const rows = container.querySelectorAll('[data-rx-row]');
      rows.forEach(function (row, index) {
        const indexEl = row.querySelector('.rx-index');
        if (indexEl) indexEl.textContent = index + 1;
      });
      if (empty) empty.hidden = rows.length > 0;
    }
    function addRow(item) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = rxRow(item, count++);
      const row = wrapper.firstElementChild;
      container.appendChild(row);
      bindRow(row);
      reindex();
      if (!item) {
        row.querySelector('.rx-select').focus();
      }
      estimateCosts(exam.poli, form);
    }
    (exam.resep || []).forEach(function (item) { addRow(item); });
    if (!(exam.resep || []).length && empty) empty.hidden = false;
    addButton.addEventListener('click', function () { addRow(null); });
    form.addEventListener('input', function () { estimateCosts(exam.poli, form); });
    estimateCosts(exam.poli, form);
  }

  function collectPrescription(form) {
    const rows = Array.from(form.querySelectorAll('[data-rx-row]'));
    return rows.map(function (row, index) {
      const medicineId = row.querySelector('.rx-select').value;
      const jumlah = Number(row.querySelector('.rx-number').value);
      const aturan = row.querySelector('.rx-aturan').value.trim();
      if (!medicineId && !jumlah) return null;
      if (!medicineId) throw new Error('Pilih obat pada baris resep ke-' + (index + 1) + '.');
      if (!Number.isFinite(jumlah) || jumlah <= 0) throw new Error('Jumlah obat pada baris resep ke-' + (index + 1) + ' harus lebih dari 0.');
      return { medicineId: medicineId, jumlah: jumlah, aturan: aturan || 'Sesuai petunjuk dokter' };
    }).filter(Boolean);
  }

  function collectExamPayload(form) {
    const referralActive = form.querySelector('#rujukanAktif').checked;
    return {
      keluhan: form.querySelector('#keluhan').value,
      riwayatAlergi: form.querySelector('#riwayatAlergi').value,
      pemeriksaanFisik: {
        tekananDarah: form.querySelector('#vitalTd').value,
        nadi: form.querySelector('#vitalNadi').value,
        suhu: form.querySelector('#vitalSuhu').value,
        respirasi: form.querySelector('#vitalRr').value,
        spo2: form.querySelector('#vitalSpo2').value,
        beratBadan: form.querySelector('#vitalBb').value,
        tinggiBadan: form.querySelector('#vitalTb').value,
        catatanFisik: form.querySelector('#vitalCatatan').value
      },
      diagnosis: form.querySelector('#diagnosis').value,
      kodeICD10: form.querySelector('#kodeICD10').value,
      diagnosisSekunder: form.querySelector('#diagnosisSekunder').value,
      tindakan: form.querySelector('#tindakan').value,
      catatanDokter: form.querySelector('#catatanDokter').value,
      kontrolUlang: form.querySelector('#kontrolUlang').value,
      rujukan: referralActive ? {
        tujuan: form.querySelector('#rujukanTujuan').value,
        alasan: form.querySelector('#rujukanAlasan').value,
        tanggal: form.querySelector('#rujukanTanggal').value
      } : null,
      resep: collectPrescription(form)
    };
  }

  function patientMini(patient, queue, exam) {
    return '<section class="card exam-patient-strip">' +
      '<div class="exam-patient-main">' +
        '<span class="avatar avatar-lg">' + ui.esc(ui.initials(patient.nama)) + '</span>' +
        '<div><div class="hero-title-row"><h2>' + ui.esc(patient.nama) + '</h2>' + (patient.jenisKepersertaan === 'BPJS' ? '<span class="badge badge-info">BPJS</span>' : '<span class="badge badge-muted">Umum</span>') + '</div>' +
        '<div class="patient-meta"><span>' + ui.icon('file-text') + ui.esc(patient.noRM) + '</span><span>' + ui.icon('user') + ui.esc(ui.ageLabel(patient.tanggalLahir)) + ' · ' + (patient.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan') + '</span><span>' + ui.icon('phone') + ui.esc(patient.noTelepon) + '</span></div></div>' +
      '</div>' +
      '<div class="exam-patient-info">' +
        '<div><span>Antrean</span><strong>' + ui.esc(queue.kode) + '</strong><small>' + ui.esc(NS.core.getPoli(queue.poli).nama) + '</small></div>' +
        '<div><span>No. Pemeriksaan</span><strong class="mono">' + ui.esc(exam.noPemeriksaan) + '</strong><small>' + ui.esc(ui.fmtDate(exam.tanggal, 'full')) + '</small></div>' +
        '<div><span>Status</span><strong>' + (exam.status === 'draft' ? '<span class="badge badge-warning">Draf pemeriksaan</span>' : '<span class="badge badge-success">Selesai</span>') + '</strong><small>' + ui.esc(doctorName(exam.dokterId)) + '</small></div>' +
      '</div>' +
      '<a href="#/pasien/' + ui.attr(patient.id) + '" class="btn btn-ghost btn-sm exam-patient-link">' + ui.icon('external-link') + 'Profil pasien</a>' +
    '</section>';
  }

  function previousVisits(patientId, excludeExamId) {
    return store.exams().filter(function (exam) {
      return exam.patientId === patientId && exam.id !== excludeExamId && exam.status === 'selesai';
    }).slice(0, 3);
  }

  function examAside(exam, patient) {
    const previous = previousVisits(patient.id, exam.id);
    const consultation = consultationTariff(exam.poli);
    return '<aside class="exam-aside">' +
      '<section class="card aside-summary-card">' +
        '<h3>Ringkasan biaya</h3>' +
        '<div class="estimate-row"><span>Konsultasi</span><strong>' + ui.currency(consultation ? consultation.tarif : 0) + '</strong></div>' +
        '<div class="estimate-row"><span>Administrasi</span><strong>' + ui.currency((store.tariffs().find(function (t) { return t.kode === 'TRF-003'; }) || { tarif: 0 }).tarif) + '</strong></div>' +
        '<div class="estimate-row"><span>Obat (estimasi)</span><strong id="rxEstimateLine">Termasuk resep</strong></div>' +
        '<div class="estimate-total"><span>Perkiraan total</span><strong id="estimateTotal">—</strong></div>' +
        '<p class="aside-note">' + ui.icon('info') + 'Tagihan final dibuat otomatis setelah pemeriksaan diselesaikan.</p>' +
      '</section>' +
      '<section class="card aside-summary-card">' +
        '<h3>Informasi klinis</h3>' +
        '<div class="info-list">' +
          '<div><span>Riwayat alergi</span><strong>' + ui.esc(exam.riwayatAlergi || 'Belum dicatat') + '</strong></div>' +
          '<div><span>Kepesertaan</span><strong>' + ui.esc(patient.jenisKepersertaan) + '</strong></div>' +
          '<div><span>Kontak keluarga</span><strong>' + ui.esc(patient.kontakKeluarga.nama || '—') + '</strong></div>' +
          '<div><span>Kontak darurat</span><strong>' + ui.esc(patient.kontakKeluarga.telepon || '—') + '</strong></div>' +
        '</div>' +
      '</section>' +
      '<section class="card aside-summary-card">' +
        '<h3>Riwayat pemeriksaan</h3>' +
        (previous.length ? '<div class="past-visits">' + previous.map(function (item) {
          return '<a href="#/pemeriksaan/' + ui.attr(item.id) + '" class="past-visit"><span class="past-visit-dot"></span><span><strong>' + ui.esc(item.diagnosis || 'Pemeriksaan') + '</strong><small>' + ui.esc(ui.fmtDate(item.tanggal, 'medium')) + ' · ' + ui.esc(NS.core.getPoli(item.poli).singkat) + '</small></span>' + ui.icon('chevron-right') + '</a>';
        }).join('') + '</div>' : '<p class="aside-empty">Belum ada pemeriksaan sebelumnya untuk pasien ini.</p>') +
      '</section>' +
    '</aside>';
  }

  function renderDoctorEditor(root, exam, patient, queue) {
    const diagnosisOptions = C.COMMON_DIAGNOSES.map(function (item) { return '<option value="' + ui.attr(item.nama) + '">' + ui.esc(item.kode) + '</option>'; }).join('');
    const today = NS.core.dateKey();
    root.innerHTML = ui.pageHeader({
      eyebrow: 'Rekam Medis Elektronik',
      title: 'Pemeriksaan Pasien',
      description: 'Lengkapi anamnesis, pemeriksaan fisik, diagnosis, dan rencana terapi pasien.',
      actions: '<a href="#/pemeriksaan" class="btn btn-ghost">' + ui.icon('arrow-left') + 'Daftar Pasien</a>' +
        '<button type="button" class="btn btn-secondary" id="printDraftBtn">' + ui.icon('printer') + 'Cetak</button>'
    }) +
    patientMini(patient, queue, exam) +
    '<form id="examForm" class="exam-form" novalidate>' +
      '<div class="form-error-host"></div>' +
      '<div class="exam-layout">' +
        '<div class="exam-main">' +
          '<section class="card form-card">' +
            ui.sectionHeader('1. Anamnesis', 'Keluhan dan riwayat yang disampaikan pasien.', '', 'clipboard') +
            '<div class="form-section-body">' +
              '<div class="field full"><label for="keluhan">Keluhan utama <span class="required">*</span></label><textarea id="keluhan" name="keluhan" class="input textarea" rows="3" placeholder="Tuliskan keluhan utama, durasi, dan faktor yang memperberat…" required>' + ui.esc(exam.keluhan) + '</textarea></div>' +
              '<div class="field full"><label for="riwayatAlergi">Riwayat alergi obat / makanan</label><input id="riwayatAlergi" name="riwayatAlergi" class="input" value="' + ui.attr(exam.riwayatAlergi) + '" placeholder="Contoh: alergi penisilin / tidak ada"></div>' +
            '</div>' +
          '</section>' +
          '<section class="card form-card">' +
            ui.sectionHeader('2. Pemeriksaan fisik', 'Catat tanda vital pasien pada kunjungan ini.', '', 'activity') +
            '<div class="form-section-body">' + vitalsFields(exam.pemeriksaanFisik) + '</div>' +
          '</section>' +
          '<section class="card form-card">' +
            ui.sectionHeader('3. Diagnosis & tindakan', 'Gunakan diagnosis yang terukur dan kode ICD-10 bila tersedia.', '', 'stethoscope') +
            '<div class="form-section-body">' +
              '<div class="field full"><label for="diagnosis">Diagnosis utama <span class="required">*</span></label><input id="diagnosis" name="diagnosis" class="input" list="diagnosisList" value="' + ui.attr(exam.diagnosis) + '" placeholder="Ketik diagnosis atau pilih dari saran…" required><datalist id="diagnosisList">' + diagnosisOptions + '</datalist>' +
                '<div class="diagnosis-suggestions">' + C.COMMON_DIAGNOSES.slice(0, 7).map(function (item) { return '<button type="button" class="suggestion-chip" data-diagnosis="' + ui.attr(item.nama) + '" data-code="' + ui.attr(item.kode) + '">' + ui.esc(item.nama) + ' <span>' + ui.esc(item.kode) + '</span></button>'; }).join('') + '</div>' +
              '</div>' +
              '<div class="field"><label for="kodeICD10">Kode ICD-10</label><input id="kodeICD10" name="kodeICD10" class="input mono" value="' + ui.attr(exam.kodeICD10) + '" placeholder="Contoh: J06.9"></div>' +
              '<div class="field"><label for="diagnosisSekunder">Diagnosis sekunder <span class="label-note">opsional</span></label><input id="diagnosisSekunder" name="diagnosisSekunder" class="input" value="' + ui.attr(exam.diagnosisSekunder) + '" placeholder="Diagnosis penyerta"></div>' +
              '<div class="field full"><label for="tindakan">Tindakan medis</label><textarea id="tindakan" name="tindakan" class="input textarea" rows="2" placeholder="Tindakan yang dilakukan pada kunjungan ini…">' + ui.esc(exam.tindakan) + '</textarea></div>' +
              '<div class="field full"><label for="catatanDokter">Catatan dokter / edukasi</label><textarea id="catatanDokter" name="catatanDokter" class="input textarea" rows="2" placeholder="Instruksi, edukasi, atau catatan penting…">' + ui.esc(exam.catatanDokter) + '</textarea></div>' +
              '<div class="field"><label for="kontrolUlang">Kontrol ulang</label><input id="kontrolUlang" name="kontrolUlang" type="date" class="input" min="' + today + '" value="' + ui.attr(exam.kontrolUlang) + '"></div>' +
            '</div>' +
          '</section>' +
          '<section class="card form-card">' +
            ui.sectionHeader('4. Rujukan', 'Isi jika pasien memerlukan layanan lanjutan di fasilitas kesehatan lain.', '', 'arrow-up-right') +
            '<div class="form-section-body">' +
              '<label class="check-card compact" for="rujukanAktif">' +
                '<input type="checkbox" id="rujukanAktif" name="rujukanAktif" value="1"' + (exam.rujukan ? ' checked' : '') + '>' +
                '<span class="check-card-icon">' + ui.icon('building') + '</span>' +
                '<span class="check-card-copy"><strong>Pasien dirujuk</strong><small>Aktifkan untuk mengisi surat rujukan elektronik.</small></span>' +
                '<span class="switch" aria-hidden="true"></span>' +
              '</label>' +
              '<div class="referral-fields form-grid-2" id="referralFields"' + (exam.rujukan ? '' : ' hidden') + '>' +
                '<div class="field"><label for="rujukanTujuan">Fasilitas tujuan</label><input id="rujukanTujuan" class="input" value="' + ui.attr(exam.rujukan ? exam.rujukan.tujuan : '') + '" placeholder="Contoh: RSUD Kota Bandung"></div>' +
                '<div class="field"><label for="rujukanTanggal">Tanggal rujukan</label><input id="rujukanTanggal" type="date" class="input" value="' + ui.attr(exam.rujukan && exam.rujukan.tanggal ? exam.rujukan.tanggal : today) + '"></div>' +
                '<div class="field full"><label for="rujukanAlasan">Alasan / diagnosa rujukan</label><textarea id="rujukanAlasan" class="input textarea" rows="2" placeholder="Alasan klinis dan tindakan yang dibutuhkan…">' + ui.esc(exam.rujukan ? exam.rujukan.alasan : '') + '</textarea></div>' +
              '</div>' +
            '</div>' +
          '</section>' +
          '<section class="card form-card">' +
            ui.sectionHeader('5. Resep elektronik', 'Resep akan langsung diteruskan ke modul farmasi.', '<button type="button" class="btn btn-secondary btn-sm" id="addRxBtn">' + ui.icon('plus') + 'Tambah Obat</button>', 'pill') +
            '<div class="form-section-body">' +
              '<div class="rx-head"><span>#</span><span>Obat</span><span>Jumlah</span><span>Aturan pakai</span><span></span></div>' +
              '<div id="rxRows" class="rx-rows"></div>' +
              '<div class="rx-empty" id="rxEmpty" hidden>' + ui.icon('pill') + '<div><strong>Belum ada obat pada resep</strong><span>Klik “Tambah Obat” jika pasien memerlukan terapi farmasi.</span></div></div>' +
              '<div class="inline-alert inline-alert-info">' + ui.icon('info') + '<span>Farmasi akan memeriksa ketersediaan stok dan tanggal kedaluwarsa sebelum menyerahkan obat.</span></div>' +
            '</div>' +
          '</section>' +
          '<div class="form-actions exam-actions">' +
            '<a href="#/pemeriksaan" class="btn btn-ghost">Batal</a>' +
            '<button type="button" class="btn btn-secondary" id="saveDraftBtn">' + ui.icon('file-text') + 'Simpan Draf</button>' +
            '<button type="submit" class="btn btn-primary" id="finishExamBtn">' + ui.icon('check-circle') + 'Selesaikan & Buat Tagihan</button>' +
          '</div>' +
        '</div>' +
        examAside(exam, patient) +
      '</div>' +
    '</form>';

    const form = root.querySelector('#examForm');
    setupBmi(form);
    setupRxEditor(form, exam);
    root.querySelectorAll('.suggestion-chip').forEach(function (button) {
      button.addEventListener('click', function () {
        form.querySelector('#diagnosis').value = button.dataset.diagnosis;
        form.querySelector('#kodeICD10').value = button.dataset.code;
        form.querySelector('#diagnosis').focus();
      });
    });
    form.querySelector('#diagnosis').addEventListener('input', function () {
      const match = C.COMMON_DIAGNOSES.find(function (item) { return item.nama === this.value; }.bind(this));
      if (match && !form.querySelector('#kodeICD10').value) form.querySelector('#kodeICD10').value = match.kode;
    });
    const refToggle = form.querySelector('#rujukanAktif');
    refToggle.addEventListener('change', function () {
      const fields = form.querySelector('#referralFields');
      fields.hidden = !refToggle.checked;
      fields.querySelectorAll('input, textarea').forEach(function (input) { input.required = refToggle.checked; });
    });
    if (exam.rujukan) {
      form.querySelectorAll('#referralFields input, #referralFields textarea').forEach(function (input) { input.required = true; });
    }
    form.querySelector('#saveDraftBtn').addEventListener('click', function () {
      const button = form.querySelector('#saveDraftBtn');
      try {
        const payload = collectExamPayload(form);
        ui.setSubmitting(button, true, 'Menyimpan…');
        store.saveExamDraft(exam.id, payload);
        ui.setSubmitting(button, false);
        ui.toast('Draf pemeriksaan berhasil disimpan.', 'success');
      } catch (error) {
        ui.setSubmitting(button, false);
        form.querySelector('.form-error-host').innerHTML = ui.formError(error.message);
        form.querySelector('.form-error-host').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (!form.reportValidity()) return;
      let payload;
      try {
        payload = collectExamPayload(form);
        if (!payload.keluhan.trim()) throw new Error('Keluhan utama wajib diisi.');
        if (!payload.diagnosis.trim()) throw new Error('Diagnosis utama wajib diisi.');
        if (payload.rujukan && !payload.rujukan.tujuan.trim()) throw new Error('Fasilitas rujukan tujuan wajib diisi.');
      } catch (error) {
        form.querySelector('.form-error-host').innerHTML = ui.formError(error.message);
        form.querySelector('.form-error-host').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      const confirmed = await ui.confirm('Selesaikan pemeriksaan ' + patient.nama + '? Tagihan akan dibuat otomatis dan rekam medis tidak dapat diubah lagi.', {
        title: 'Selesaikan pemeriksaan',
        okText: 'Ya, selesaikan'
      });
      if (!confirmed) return;
      const button = form.querySelector('#finishExamBtn');
      try {
        ui.setSubmitting(button, true, 'Menyelesaikan…');
        const result = store.completeExam(exam.id, payload);
        ui.toast('Pemeriksaan selesai. Tagihan ' + result.bill.noBill + ' telah dibuat untuk kasir.', 'success', 'Rekam medis tersimpan');
        if (location.hash === '#/pemeriksaan/' + exam.id) {
          renderExam(root, exam.id);
        } else {
          location.hash = '#/pemeriksaan/' + exam.id;
        }
      } catch (error) {
        ui.setSubmitting(button, false);
        form.querySelector('.form-error-host').innerHTML = ui.formError(error.message);
        form.querySelector('.form-error-host').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    root.querySelector('#printDraftBtn').addEventListener('click', function () { printExam(exam, true); });
  }

  function renderNurseForm(root, exam, patient, queue) {
    root.innerHTML = ui.pageHeader({
      eyebrow: 'Asesmen Awal Keperawatan',
      title: 'Catat Tanda Vital',
      description: 'Lengkapi asesmen awal sebelum pasien diperiksa dokter.',
      actions: '<a href="#/pemeriksaan" class="btn btn-ghost">' + ui.icon('arrow-left') + 'Kembali</a>'
    }) +
    patientMini(patient, queue, exam) +
    '<div class="exam-layout">' +
      '<section class="card form-card">' +
        ui.sectionHeader('Asesmen awal', 'Data ini akan tampil pada rekam medis dokter.', '', 'activity') +
        '<form id="vitalsForm" class="form-section-body" novalidate>' +
          '<div class="form-error-host"></div>' +
          '<div class="field full"><label for="nurseKeluhan">Keluhan awal pasien</label><textarea id="nurseKeluhan" class="input textarea" rows="3" placeholder="Keluhan yang disampaikan saat asesmen awal…">' + ui.esc(exam.keluhan) + '</textarea></div>' +
          vitalsFields(exam.pemeriksaanFisik) +
          '<div class="inline-alert inline-alert-info">' + ui.icon('info') + '<span>Tanda vital dapat diperbarui kembali oleh perawat selama dokter belum menyelesaikan pemeriksaan.</span></div>' +
          '<div class="form-actions"><button type="button" class="btn btn-ghost" data-cancel-vitals>Batal</button><button type="submit" class="btn btn-primary">' + ui.icon('check') + 'Simpan Tanda Vital</button></div>' +
        '</form>' +
      '</section>' +
      '<aside class="exam-aside">' +
        '<section class="card aside-summary-card"><h3>Panduan asesmen</h3><div class="guide-list"><div><span>1</span><p>Ukur tekanan darah dalam posisi duduk dan tenang.</p></div><div><span>2</span><p>Catat suhu, nadi, dan frekuensi napas secara akurat.</p></div><div><span>3</span><p>Tanyakan alergi serta keluhan utama pasien.</p></div><div><span>4</span><p>Simpan data sebelum mempersilakan pasien masuk ke ruang dokter.</p></div></div></section>' +
        '<section class="card aside-summary-card"><h3>Status pasien</h3><div class="info-list"><div><span>Antrean</span><strong>' + ui.esc(queue.kode) + '</strong></div><div><span>Poli</span><strong>' + ui.esc(NS.core.getPoli(queue.poli).nama) + '</strong></div><div><span>Dokter</span><strong>' + ui.esc(doctorName(exam.dokterId)) + '</strong></div><div><span>Status antrean</span><strong>' + ui.statusBadge(queue.status) + '</strong></div></div></section>' +
      '</aside>' +
    '</div>';

    const form = root.querySelector('#vitalsForm');
    setupBmi(form);
    form.querySelector('[data-cancel-vitals]').addEventListener('click', function () { location.hash = '#/pemeriksaan'; });
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      try {
        const button = form.querySelector('[type="submit"]');
        ui.setSubmitting(button, true, 'Menyimpan…');
        store.saveVitals(exam.id, {
          keluhan: form.querySelector('#nurseKeluhan').value,
          pemeriksaanFisik: {
            tekananDarah: form.querySelector('#vitalTd').value,
            nadi: form.querySelector('#vitalNadi').value,
            suhu: form.querySelector('#vitalSuhu').value,
            respirasi: form.querySelector('#vitalRr').value,
            spo2: form.querySelector('#vitalSpo2').value,
            beratBadan: form.querySelector('#vitalBb').value,
            tinggiBadan: form.querySelector('#vitalTb').value,
            catatanFisik: form.querySelector('#vitalCatatan').value
          }
        });
        ui.toast('Tanda vital pasien berhasil disimpan.', 'success');
        location.hash = '#/pemeriksaan';
      } catch (error) {
        ui.showError(error);
        form.querySelector('[type="submit"]').disabled = false;
      }
    });
  }

  function renderExamDetail(root, exam, patient, queue) {
    const physical = exam.pemeriksaanFisik || {};
    const bill = store.billForExam(exam.id);
    const canBilling = store.hasAccess('billing');
    const bmi = (function () {
      const w = parseFloat(String(physical.beratBadan || '').replace(',', '.'));
      const h = parseFloat(String(physical.tinggiBadan || '').replace(',', '.')) / 100;
      if (!w || !h) return null;
      const value = w / (h * h);
      return { value: value.toFixed(1), category: value < 18.5 ? 'Kurang' : value < 25 ? 'Normal' : value < 30 ? 'Berlebih' : 'Obesitas' };
    })();
    root.innerHTML = ui.pageHeader({
      eyebrow: 'Rekam Medis Elektronik',
      title: 'Rekam Medis Pasien',
      description: exam.noPemeriksaan + ' · ' + ui.fmtDate(exam.tanggal, 'full'),
      actions: '<a href="#/pemeriksaan" class="btn btn-ghost">' + ui.icon('arrow-left') + 'Kembali</a>' +
        (bill && canBilling ? '<a href="#/pembayaran/' + ui.attr(bill.id) + '" class="btn btn-secondary">' + ui.icon('receipt') + 'Lihat Tagihan</a>' : '') +
        '<button type="button" class="btn btn-primary" id="printExamBtn">' + ui.icon('printer') + 'Cetak Rekam Medis</button>'
    }) +
    patientMini(patient, queue, exam) +
    '<div class="record-status-bar">' +
      '<span>' + ui.statusBadge(queue.status) + ' Antrean ' + ui.esc(queue.kode) + '</span>' +
      '<span>' + (exam.resep && exam.resep.length ? (exam.resepStatus === 'diserahkan' ? '<span class="badge badge-success">' + ui.icon('check') + 'Resep telah diserahkan</span>' : '<span class="badge badge-warning">' + ui.icon('pill') + 'Resep menunggu farmasi</span>') : '<span class="muted">Tanpa resep</span>') + '</span>' +
      '<span>Diperiksa oleh <strong>' + ui.esc(doctorName(exam.dokterId)) + '</strong> · ' + ui.esc(ui.fmtDateTime(exam.completedAt)) + '</span>' +
    '</div>' +
    '<div class="record-grid">' +
      '<div class="record-main">' +
        '<section class="card">' +
          ui.sectionHeader('Anamnesis', 'Keluhan dan riwayat alergi pasien', '', 'clipboard') +
          '<div class="record-section-body">' +
            '<div class="clinical-block"><span>Keluhan utama</span><p>' + ui.esc(exam.keluhan || '—') + '</p></div>' +
            '<div class="clinical-block"><span>Riwayat alergi</span><p>' + ui.esc(exam.riwayatAlergi || 'Tidak ada data') + '</p></div>' +
          '</div>' +
        '</section>' +
        '<section class="card">' +
          ui.sectionHeader('Pemeriksaan fisik', 'Tanda vital dan temuan pemeriksaan', '', 'activity') +
          '<div class="record-section-body">' +
            '<div class="vital-cards">' +
              '<div class="vital-card"><span>Tekanan darah</span><strong>' + ui.esc(physical.tekananDarah || '—') + '</strong><small>mmHg</small></div>' +
              '<div class="vital-card"><span>Nadi</span><strong>' + ui.esc(physical.nadi || '—') + '</strong><small>x/menit</small></div>' +
              '<div class="vital-card"><span>Respirasi</span><strong>' + ui.esc(physical.respirasi || '—') + '</strong><small>x/menit</small></div>' +
              '<div class="vital-card"><span>Suhu</span><strong>' + ui.esc(physical.suhu || '—') + '</strong><small>°C</small></div>' +
              '<div class="vital-card"><span>SpO₂</span><strong>' + ui.esc(physical.spo2 || '—') + '</strong><small>%</small></div>' +
              '<div class="vital-card"><span>IMT</span><strong>' + (bmi ? ui.esc(bmi.value) : '—') + '</strong><small>' + (bmi ? ui.esc(bmi.category) : 'BB/TB') + '</small></div>' +
            '</div>' +
            '<div class="clinical-block"><span>Catatan pemeriksaan fisik</span><p>' + ui.esc(physical.catatanFisik || '—') + '</p></div>' +
          '</div>' +
        '</section>' +
        '<section class="card">' +
          ui.sectionHeader('Diagnosis & tindakan', 'Hasil asesmen dan rencana pelayanan', '', 'stethoscope') +
          '<div class="record-section-body">' +
            '<div class="diagnosis-primary"><span>Diagnosis utama</span><h3>' + ui.esc(exam.diagnosis || '—') + (exam.kodeICD10 ? ' <span class="mono">(' + ui.esc(exam.kodeICD10) + ')</span>' : '') + '</h3></div>' +
            (exam.diagnosisSekunder ? '<div class="clinical-block"><span>Diagnosis sekunder</span><p>' + ui.esc(exam.diagnosisSekunder) + '</p></div>' : '') +
            '<div class="clinical-block"><span>Tindakan medis</span><p>' + ui.esc(exam.tindakan || '—') + '</p></div>' +
            '<div class="clinical-block"><span>Catatan dokter</span><p>' + ui.esc(exam.catatanDokter || '—') + '</p></div>' +
          '</div>' +
        '</section>' +
        '<section class="card">' +
          ui.sectionHeader('Resep elektronik', 'Terapi farmasi yang diberikan', '', 'pill') +
          '<div class="record-section-body">' +
            (exam.resep && exam.resep.length ? '<div class="table-responsive"><table class="data-table"><thead><tr><th>Obat</th><th>Jumlah</th><th>Aturan pakai</th><th>Status</th><th class="align-right">Subtotal</th></tr></thead><tbody>' +
              exam.resep.map(function (item) {
                return '<tr><td data-label="Obat"><strong>' + ui.esc(item.nama) + '</strong></td><td data-label="Jumlah">' + ui.esc(item.jumlah) + ' ' + ui.esc(item.satuan) + '</td><td data-label="Aturan pakai">' + ui.esc(item.aturan) + '</td><td data-label="Status">' + (item.diserahkan ? '<span class="badge badge-success">Diserahkan</span>' : '<span class="badge badge-warning">Menunggu</span>') + '</td><td data-label="Subtotal" class="align-right">' + ui.currency(item.harga * item.jumlah) + '</td></tr>';
              }).join('') + '</tbody></table></div>' : '<div class="empty-inline">' + ui.icon('pill') + '<span>Tidak ada resep pada pemeriksaan ini.</span></div>') +
          '</div>' +
        '</section>' +
      '</div>' +
      '<aside class="record-aside">' +
        '<section class="card aside-summary-card">' +
          '<h3>Rencana lanjutan</h3>' +
          '<div class="info-list">' +
            '<div><span>Kontrol ulang</span><strong>' + (exam.kontrolUlang ? ui.fmtDate(exam.kontrolUlang, 'medium') : 'Tidak dijadwalkan') + '</strong></div>' +
            '<div><span>Rujukan</span><strong>' + (exam.rujukan ? ui.esc(exam.rujukan.tujuan) : 'Tidak ada') + '</strong></div>' +
            (exam.rujukan ? '<div><span>Tanggal rujukan</span><strong>' + ui.esc(ui.fmtDate(exam.rujukan.tanggal, 'medium')) + '</strong></div>' : '') +
          '</div>' +
          (exam.rujukan ? '<div class="referral-note">' + ui.icon('building') + '<div><strong>' + ui.esc(exam.rujukan.tujuan) + '</strong><p>' + ui.esc(exam.rujukan.alasan) + '</p></div></div>' : '') +
        '</section>' +
        '<section class="card aside-summary-card">' +
          '<h3>Berkas pasien</h3>' +
          '<a href="#/pasien/' + ui.attr(patient.id) + '" class="quick-action"><span class="task-icon task-icon-teal">' + ui.icon('user') + '</span><span><strong>Profil pasien</strong><small>Identitas & seluruh riwayat</small></span>' + ui.icon('chevron-right') + '</a>' +
          (bill && canBilling ? '<a href="#/pembayaran/' + ui.attr(bill.id) + '" class="quick-action"><span class="task-icon task-icon-amber">' + ui.icon('receipt') + '</span><span><strong>Tagihan ' + ui.esc(bill.noBill) + '</strong><small>' + ui.esc(ui.currency(bill.total)) + ' · ' + ui.esc(ui.billBadge(bill.status).replace(/<[^>]+>/g, '')) + '</small></span>' + ui.icon('chevron-right') + '</a>' : '') +
          '<button type="button" class="quick-action" id="asidePrintExam"><span class="task-icon task-icon-blue">' + ui.icon('printer') + '</span><span><strong>Cetak rekam medis</strong><small>Dokumen untuk arsip pasien</small></span>' + ui.icon('chevron-right') + '</button>' +
        '</section>' +
        '<section class="card consent-card"><span class="consent-icon">' + ui.icon('lock') + '</span><div><h3>Rekam medis elektronik</h3><p>Dokumen ini hanya dapat diakses oleh tenaga kesehatan berwenang.</p></div></section>' +
      '</aside>' +
    '</div>';

    const print = function () { printExam(exam); };
    root.querySelector('#printExamBtn').addEventListener('click', print);
    root.querySelector('#asidePrintExam').addEventListener('click', print);
  }

  function printExam(exam, draft) {
    const patient = patientOf(exam);
    const queue = store.queueById(exam.queueId);
    const physical = exam.pemeriksaanFisik || {};
    const doctor = doctorName(exam.dokterId);
    const content = ui.printLetterhead('REKAM MEDIS ELEKTRONIK' + (draft || exam.status === 'draft' ? ' · DRAF' : '')) +
      '<div class="print-doc-title"><div><h2>' + ui.esc(patient.nama) + '</h2><p>' + ui.esc(patient.noRM) + ' · NIK ' + ui.esc(patient.nik) + '</p></div><div class="print-doc-meta"><div><span>No. Pemeriksaan</span><strong>' + ui.esc(exam.noPemeriksaan) + '</strong></div><div><span>Tanggal</span><strong>' + ui.esc(ui.fmtDate(exam.tanggal, 'full')) + '</strong></div><div><span>Poli</span><strong>' + ui.esc(NS.core.getPoli(exam.poli).nama) + '</strong></div></div></div>' +
      '<table class="print-table"><tbody>' +
        '<tr><th>Nama pasien</th><td>' + ui.esc(patient.nama) + '</td><th>Tanggal lahir / usia</th><td>' + ui.esc(ui.fmtDate(patient.tanggalLahir, 'medium')) + ' · ' + ui.esc(ui.ageLabel(patient.tanggalLahir)) + '</td></tr>' +
        '<tr><th>Jenis kelamin</th><td>' + (patient.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan') + '</td><th>Kepesertaan</th><td>' + ui.esc(patient.jenisKepersertaan) + (patient.noBPJS ? ' · ' + ui.esc(patient.noBPJS) : '') + '</td></tr>' +
        '<tr><th>Antrean</th><td>' + ui.esc(queue ? queue.kode : '—') + '</td><th>Dokter pemeriksa</th><td>' + ui.esc(doctor) + '</td></tr>' +
        '<tr><th>Keluhan utama</th><td colspan="3">' + ui.esc(exam.keluhan || '—') + '</td></tr>' +
        '<tr><th>Riwayat alergi</th><td colspan="3">' + ui.esc(exam.riwayatAlergi || '—') + '</td></tr>' +
      '</tbody></table>' +
      '<h3 class="print-section-title">Pemeriksaan Fisik</h3>' +
      '<table class="print-table vitals-print"><tbody>' +
        '<tr><th>Tekanan darah</th><td>' + ui.esc(physical.tekananDarah || '—') + ' mmHg</td><th>Nadi</th><td>' + ui.esc(physical.nadi || '—') + ' x/menit</td><th>Respirasi</th><td>' + ui.esc(physical.respirasi || '—') + ' x/menit</td></tr>' +
        '<tr><th>Suhu</th><td>' + ui.esc(physical.suhu || '—') + ' °C</td><th>SpO₂</th><td>' + ui.esc(physical.spo2 || '—') + ' %</td><th>BB / TB</th><td>' + ui.esc(physical.beratBadan || '—') + ' kg / ' + ui.esc(physical.tinggiBadan || '—') + ' cm</td></tr>' +
        '<tr><th>Catatan fisik</th><td colspan="5">' + ui.esc(physical.catatanFisik || '—') + '</td></tr>' +
      '</tbody></table>' +
      '<h3 class="print-section-title">Diagnosis & Tindakan</h3>' +
      '<table class="print-table"><tbody>' +
        '<tr><th>Diagnosis utama</th><td>' + ui.esc(exam.diagnosis || '—') + (exam.kodeICD10 ? ' (' + ui.esc(exam.kodeICD10) + ')' : '') + '</td></tr>' +
        (exam.diagnosisSekunder ? '<tr><th>Diagnosis sekunder</th><td>' + ui.esc(exam.diagnosisSekunder) + '</td></tr>' : '') +
        '<tr><th>Tindakan</th><td>' + ui.esc(exam.tindakan || '—') + '</td></tr>' +
        '<tr><th>Catatan dokter</th><td>' + ui.esc(exam.catatanDokter || '—') + '</td></tr>' +
        '<tr><th>Kontrol ulang</th><td>' + (exam.kontrolUlang ? ui.esc(ui.fmtDate(exam.kontrolUlang, 'medium')) : '—') + '</td></tr>' +
        (exam.rujukan ? '<tr><th>Rujukan</th><td>' + ui.esc(exam.rujukan.tujuan) + ' · ' + ui.esc(exam.rujukan.alasan) + '</td></tr>' : '') +
      '</tbody></table>' +
      '<h3 class="print-section-title">Resep Elektronik</h3>' +
      (exam.resep && exam.resep.length ? '<table class="print-table rx-print"><thead><tr><th>No</th><th>Nama Obat</th><th>Jumlah</th><th>Aturan Pakai</th></tr></thead><tbody>' + exam.resep.map(function (item, index) {
        return '<tr><td>' + (index + 1) + '</td><td>' + ui.esc(item.nama) + '</td><td>' + ui.esc(item.jumlah) + ' ' + ui.esc(item.satuan) + '</td><td>' + ui.esc(item.aturan) + '</td></tr>';
      }).join('') + '</tbody></table>' : '<p class="print-muted">Tidak ada resep pada pemeriksaan ini.</p>') +
      '<div class="print-signatures"><div><span>Tanggal cetak</span><strong>' + ui.esc(ui.fmtDate(new Date().toISOString(), 'full')) + '</strong></div><div class="print-signature-block"><span>Dokter Pemeriksa</span><div class="signature-space"></div><strong>' + ui.esc(doctor) + '</strong></div></div>' +
      (draft || exam.status === 'draft' ? '<div class="print-watermark">DRAF</div>' : '') +
      ui.printFooter();
    ui.printDocument(content, { title: 'Rekam Medis — ' + patient.nama });
  }

  function renderExam(root, examId) {
    const exam = store.examById(examId);
    if (!exam) {
      root.innerHTML = ui.emptyState('search', 'Rekam medis tidak ditemukan', 'Pemeriksaan yang Anda cari tidak tersedia.', '<a href="#/pemeriksaan" class="btn btn-secondary">Kembali</a>');
      return;
    }
    const patient = patientOf(exam);
    const queue = store.queueById(exam.queueId) || { kode: '—', poli: exam.poli, status: 'selesai', patientId: exam.patientId };
    if (!patient) {
      root.innerHTML = ui.emptyState('search', 'Data pasien tidak ditemukan', 'Rekam medis tidak dapat ditampilkan.', '<a href="#/pemeriksaan" class="btn btn-secondary">Kembali</a>');
      return;
    }
    if (exam.status === 'draft' && store.can('exam.manage')) {
      renderDoctorEditor(root, exam, patient, queue);
      return;
    }
    if (exam.status === 'draft' && store.can('vitals.manage')) {
      renderNurseForm(root, exam, patient, queue);
      return;
    }
    renderExamDetail(root, exam, patient, queue);
  }

  NS.pages = NS.pages || {};
  NS.pages.exams = {
    render: render,
    detail: renderExam,
    print: printExam
  };
})(window);
