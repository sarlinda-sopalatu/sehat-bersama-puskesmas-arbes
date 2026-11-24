/* ==========================================================================
   Sehat Bersama - Puskesmas Arbes — Modul farmasi, persediaan obat, dan resep elektronik
   ========================================================================== */
(function (window) {
  'use strict';

  const NS = window.PK;
  const ui = NS.ui;
  const store = NS.store;

  const state = {
    tab: 'resep',
    rxMode: 'menunggu',
    rxSearch: '',
    rxPage: 1,
    rxPerPage: 6,
    medSearch: '',
    medCategory: '',
    medStatus: '',
    medPage: 1,
    medPerPage: 8,
    mutType: '',
    mutMedicine: '',
    mutSearch: '',
    mutPage: 1,
    mutPerPage: 12,
    reportStart: NS.core.addDaysKey(NS.core.dateKey(), -29),
    reportEnd: NS.core.dateKey()
  };

  let currentRoot = null;

  function sum(list, getter) {
    return (list || []).reduce(function (total, item) { return total + (Number(getter(item)) || 0); }, 0);
  }

  function today() {
    return NS.core.dateKey();
  }

  function dateKeyOf(value) {
    if (!value) return '';
    return NS.core.dateKey(new Date(value));
  }

  function userName(id) {
    const user = store.users().find(function (item) { return item.id === id; });
    return user ? user.name : 'Sistem';
  }

  function patientOf(exam) {
    return store.patientById(exam.patientId);
  }

  function poliName(id) {
    return NS.core.getPoli(id).nama;
  }

  function medicineStatusBadge(medicine) {
    const status = NS.core.medicineStatus(medicine);
    return ui.badge(status.label, status.tone);
  }

  function stockMeter(medicine) {
    const stock = Number(medicine.stok) || 0;
    const minimum = Number(medicine.stokMinimum) || 0;
    const target = Math.max(minimum * 3, 1);
    const ratio = Math.min(100, Math.round((stock / target) * 100));
    const status = NS.core.medicineStatus(medicine);
    const cls = status.key === 'out' ? 'is-out' : (status.key === 'low' || status.key === 'expiring' || status.key === 'expired' ? 'is-low' : '');
    return '<div class="stock-meter">' +
      '<span class="stock-meter-track"><span class="stock-meter-fill ' + cls + '" style="width:' + ratio + '%"></span></span>' +
      '<span>' + ui.number(stock) + ' ' + ui.esc(medicine.satuan) + '</span>' +
      '</div>';
  }

  function categoryOptions(selected) {
    const categories = Array.from(new Set(store.medicines().map(function (medicine) { return medicine.kategori; }))).sort(function (a, b) { return a.localeCompare(b, 'id'); });
    return ui.options(categories, selected, 'Semua kategori');
  }

  function medicineOptions(selected) {
    return '<option value="">Pilih obat…</option>' + store.medicines().filter(function (medicine) { return medicine.aktif !== false; }).map(function (medicine) {
      return '<option value="' + ui.attr(medicine.id) + '"' + (medicine.id === selected ? ' selected' : '') + '>' +
        ui.esc(medicine.nama + ' · stok ' + medicine.stok + ' ' + medicine.satuan) + '</option>';
    }).join('');
  }

  /* ------------------------------------------------------------------------
     Resep elektronik
     ------------------------------------------------------------------------ */
  function filteredExams() {
    let list;
    if (state.rxMode === 'menunggu') list = store.pendingPrescriptions();
    else if (state.rxMode === 'diserahkan') list = store.dispensedPrescriptions();
    else list = store.exams().filter(function (exam) { return exam.resep && exam.resep.length && exam.status === 'selesai'; });

    if (state.rxSearch) {
      const query = state.rxSearch.toLowerCase();
      list = list.filter(function (exam) {
        const patient = patientOf(exam);
        return [exam.noPemeriksaan, exam.diagnosis, patient ? patient.nama : '', patient ? patient.noRM : ''].some(function (value) {
          return String(value || '').toLowerCase().includes(query);
        });
      });
    }
    list.sort(function (a, b) {
      const left = a.resepStatus === 'menunggu' ? (a.completedAt || a.createdAt) : (a.dispensedAt || a.completedAt || a.createdAt);
      const right = b.resepStatus === 'menunggu' ? (b.completedAt || b.createdAt) : (b.dispensedAt || b.completedAt || b.createdAt);
      return new Date(right) - new Date(left);
    });
    return list;
  }

  function prescriptionStockProblems(exam) {
    const problems = [];
    (exam.resep || []).forEach(function (item) {
      const medicine = store.medicineById(item.medicineId);
      if (!medicine) {
        problems.push({ item: item, text: item.nama + ' tidak ditemukan pada master obat.' });
        return;
      }
      if (medicine.kadaluarsa && medicine.kadaluarsa < today()) {
        problems.push({ item: item, text: medicine.nama + ' sudah kedaluwarsa sejak ' + ui.fmtDate(medicine.kadaluarsa, 'medium') + '.' });
      }
      if (Number(medicine.stok) < Number(item.jumlah)) {
        problems.push({ item: item, text: medicine.nama + ' kurang ' + (Number(item.jumlah) - Number(medicine.stok)) + ' ' + medicine.satuan + ' (tersedia ' + medicine.stok + ').' });
      }
    });
    return problems;
  }

  function prescriptionCard(exam, canDispense) {
    const patient = patientOf(exam);
    const problems = exam.resepStatus === 'menunggu' ? prescriptionStockProblems(exam) : [];
    const total = sum(exam.resep, function (item) { return (Number(item.jumlah) || 0) * (Number(item.harga) || 0); });
    return '<article class="card rx-card ' + (exam.resepStatus === 'menunggu' ? 'is-pending' : '') + '">' +
      '<div class="rx-card-head">' +
        '<div class="rx-patient">' +
          '<span class="avatar avatar-sm">' + ui.esc(ui.initials(patient ? patient.nama : 'Pasien')) + '</span>' +
          '<div><strong>' + ui.esc(patient ? patient.nama : 'Pasien') + '</strong><small>' + ui.esc(patient ? patient.noRM : '—') + ' · ' + ui.esc(patient ? ui.ageLabel(patient.tanggalLahir) : '') + '</small></div>' +
        '</div>' +
        (exam.resepStatus === 'diserahkan' ? '<span class="badge badge-success">' + ui.icon('check') + 'Diserahkan</span>' : '<span class="badge badge-warning">Menunggu obat</span>') +
      '</div>' +
      '<div class="rx-card-body">' +
        '<div class="rx-meta-grid">' +
          '<div><span>No. Pemeriksaan</span><strong class="mono">' + ui.esc(exam.noPemeriksaan) + '</strong></div>' +
          '<div><span>Poli / Dokter</span><strong>' + ui.esc(NS.core.getPoli(exam.poli).singkat) + ' · ' + ui.esc(userName(exam.dokterId)) + '</strong></div>' +
          '<div><span>Tanggal resep</span><strong>' + ui.esc(ui.fmtDate(exam.completedAt || exam.createdAt, 'medium')) + '</strong></div>' +
          '<div><span>Diagnosis</span><strong>' + ui.esc(exam.diagnosis || 'Belum diisi') + '</strong></div>' +
        '</div>' +
        '<div class="rx-items">' +
          (exam.resep || []).slice(0, 4).map(function (item) {
            const medicine = store.medicineById(item.medicineId);
            const short = medicine && Number(medicine.stok) < Number(item.jumlah);
            return '<div class="rx-item-row">' +
              '<span class="rx-item-name">' + ui.esc(item.nama) + '<small>' + ui.esc(item.aturan) + '</small></span>' +
              '<span class="rx-item-qty">' + ui.number(item.jumlah) + ' ' + ui.esc(item.satuan) + (short ? ' <span class="stock-warning">!</span>' : '') + '</span>' +
            '</div>';
          }).join('') +
          ((exam.resep || []).length > 4 ? '<div class="rx-item-row"><span class="rx-item-name muted">+' + ((exam.resep || []).length - 4) + ' obat lainnya</span><span class="rx-item-qty">' + ui.currency(total) + '</span></div>' : '') +
        '</div>' +
        (problems.length ? '<div class="inline-alert inline-alert-warning" style="margin-top:10px">' + ui.icon('alert') + '<span>' + problems.length + ' item perlu perhatian stok / kedaluwarsa sebelum diserahkan.</span></div>' : '') +
      '</div>' +
      '<div class="rx-card-foot">' +
        '<span class="rx-empty-note">' + (exam.resepStatus === 'diserahkan' ? 'Oleh ' + ui.esc(userName(exam.dispensedBy)) + ' · ' + ui.esc(ui.fmtTime(exam.dispensedAt)) : 'Total obat ' + ui.currency(total)) + '</span>' +
        '<div class="table-actions">' +
          '<button type="button" class="btn btn-ghost btn-xs" data-rx-action="print" data-id="' + ui.attr(exam.id) + '">' + ui.icon('printer') + 'Cetak</button>' +
          '<button type="button" class="btn btn-secondary btn-xs" data-rx-action="detail" data-id="' + ui.attr(exam.id) + '">' + ui.icon('eye') + 'Detail</button>' +
          (exam.resepStatus === 'menunggu' && canDispense ? '<button type="button" class="btn btn-primary btn-xs" data-rx-action="dispense" data-id="' + ui.attr(exam.id) + '">' + ui.icon('check-circle') + 'Serahkan</button>' : '') +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function renderPrescriptions(root) {
    const canDispense = store.can('prescription.dispense') || store.can('pharmacy.manage');
    const list = filteredExams();
    const totalPages = Math.max(1, Math.ceil(list.length / state.rxPerPage));
    if (state.rxPage > totalPages) state.rxPage = totalPages;
    const shown = list.slice((state.rxPage - 1) * state.rxPerPage, state.rxPage * state.rxPerPage);

    root.innerHTML = ui.pageHeader({
      eyebrow: 'Farmasi & Terapi',
      title: 'Resep Elektronik',
      description: 'Siapkan, verifikasi ketersediaan, dan serahkan obat sesuai resep dokter.',
      actions: '<a href="#/farmasi/obat" class="btn btn-secondary">' + ui.icon('package') + 'Master Obat</a>' +
        '<button type="button" class="btn btn-primary" id="rxRefreshBtn">' + ui.icon('refresh') + 'Muat Ulang</button>'
    }) +
    pharmacyStats() +
    '<div class="pharmacy-toolbar">' + ui.pageTabs([
      { id: 'menunggu', label: 'Menunggu diserahkan', count: store.pendingPrescriptions().length, icon: 'clock' },
      { id: 'diserahkan', label: 'Sudah diserahkan', count: store.dispensedPrescriptions().length, icon: 'check-circle' },
      { id: 'semua', label: 'Semua resep', icon: 'pill' }
    ], state.rxMode) + '<div class="pharmacy-toolbar-actions">' +
      '<div class="search-field" style="min-width:250px">' + ui.icon('search') + '<input type="search" id="rxSearch" class="input input-sm" placeholder="Cari pasien / no. pemeriksaan…" value="' + ui.attr(state.rxSearch) + '" aria-label="Cari resep">' + (state.rxSearch ? '<button type="button" class="search-clear" id="rxSearchClear" aria-label="Hapus pencarian">' + ui.icon('x') + '</button>' : '') + '</div>' +
      '<button type="button" class="btn btn-secondary btn-sm" id="rxExportBtn">' + ui.icon('download') + 'CSV</button>' +
    '</div></div>' +
    (shown.length ? '<div class="rx-list">' + shown.map(function (exam) { return prescriptionCard(exam, canDispense); }).join('') + '</div>' +
      (list.length > state.rxPerPage ? ui.pagination(list.length, state.rxPage, state.rxPerPage) : '') :
      ui.emptyState('pill', state.rxMode === 'menunggu' ? 'Tidak ada resep menunggu' : 'Resep tidak ditemukan', state.rxSearch ? 'Coba kata kunci lain atau ubah filter status resep.' : 'Resep yang dibuat dokter akan tampil di sini secara otomatis.', '<a href="#/farmasi/obat" class="btn btn-secondary btn-sm">Lihat Master Obat</a>'));

    root.querySelectorAll('.tabs .tab[data-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        state.rxMode = tab.dataset.tab;
        state.rxPage = 1;
        renderPrescriptions(root);
      });
    });
    const search = root.querySelector('#rxSearch');
    search.addEventListener('input', ui.debounce(function () {
      state.rxSearch = search.value;
      state.rxPage = 1;
      renderPrescriptions(root);
      const nextSearch = root.querySelector('#rxSearch');
      if (nextSearch) {
        nextSearch.focus();
        nextSearch.setSelectionRange(nextSearch.value.length, nextSearch.value.length);
      }
    }, 240));
    const clear = root.querySelector('#rxSearchClear');
    if (clear) clear.addEventListener('click', function () { state.rxSearch = ''; state.rxPage = 1; renderPrescriptions(root); });
    const refresh = root.querySelector('#rxRefreshBtn');
    if (refresh) refresh.addEventListener('click', function () { store.reload(); renderPrescriptions(root); ui.toast('Data resep dimuat ulang.', 'success'); });
    root.querySelector('#rxExportBtn').addEventListener('click', function () {
      const rows = list.map(function (exam) {
        const patient = patientOf(exam);
        return [
          exam.noPemeriksaan,
          patient ? patient.noRM : '',
          patient ? patient.nama : '',
          NS.core.getPoli(exam.poli).nama,
          exam.diagnosis || '',
          exam.resepStatus === 'diserahkan' ? 'Diserahkan' : 'Menunggu',
          (exam.resep || []).length,
          sum(exam.resep, function (item) { return Number(item.jumlah) || 0; }),
          ui.fmtDate(exam.completedAt || exam.createdAt, 'medium'),
          exam.dispensedAt ? ui.fmtDate(exam.dispensedAt, 'medium') : ''
        ];
      });
      ui.exportCsv('resep-farmasi-' + today() + '.csv', ['No. Pemeriksaan', 'No. RM', 'Pasien', 'Poli', 'Diagnosis', 'Status Resep', 'Jenis Obat', 'Total Unit', 'Tanggal Resep', 'Tanggal Serah'], rows);
    });
    root.querySelectorAll('[data-page]').forEach(function (button) {
      button.addEventListener('click', function () { state.rxPage = Number(button.dataset.page) || 1; renderPrescriptions(root); root.querySelector('.rx-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    });
    root.querySelectorAll('[data-rx-action]').forEach(function (button) {
      button.addEventListener('click', function () {
        const id = button.dataset.id;
        if (button.dataset.rxAction === 'detail') openPrescriptionDetail(id);
        else if (button.dataset.rxAction === 'print') printPrescription(id);
        else if (button.dataset.rxAction === 'dispense') dispense(id, root);
      });
    });
  }

  function dispense(examId, root) {
    const exam = store.examById(examId);
    if (!exam) {
      ui.toast('Resep tidak ditemukan.', 'error');
      return;
    }
    const patient = patientOf(exam);
    const problems = prescriptionStockProblems(exam);
    if (problems.length) {
      ui.modal({
        title: 'Stok belum mencukupi',
        subtitle: 'Resep belum dapat diserahkan.',
        icon: 'alert-circle',
        size: 'sm',
        content: '<div class="inline-alert inline-alert-error">' + ui.icon('alert') + '<span>Lengkapi persediaan berikut melalui penerimaan stok atau sesuaikan resep dokter.</span></div>' +
          '<div class="alert-list" style="margin-top:12px">' + problems.map(function (problem) {
            return '<div class="alert-row"><span class="alert-card-icon is-danger">' + ui.icon('alert') + '</span><span><strong>' + ui.esc(problem.item.nama) + '</strong><small>' + ui.esc(problem.text) + '</small></span></div>';
          }).join('') + '</div>',
        footer: '<button type="button" class="btn btn-secondary" data-modal-close>Tutup</button><a href="#/farmasi/stok" class="btn btn-primary">' + ui.icon('package') + 'Kelola Stok</a>'
      });
      return;
    }
    ui.confirm('Serahkan ' + (exam.resep || []).length + ' jenis obat kepada ' + (patient ? patient.nama : 'pasien') + '? Stok akan otomatis berkurang dan resep ditandai diserahkan.', {
      title: 'Serahkan obat',
      okText: 'Ya, serahkan',
      danger: false
    }).then(function (confirmed) {
      if (!confirmed) return;
      try {
        store.dispensePrescription(exam.id);
        ui.toast('Obat untuk ' + (patient ? patient.nama : 'pasien') + ' berhasil diserahkan. Stok telah diperbarui.', 'success', 'Penyerahan selesai');
        renderPrescriptions(root);
      } catch (error) {
        ui.showError(error);
      }
    });
  }

  function openPrescriptionDetail(examId) {
    const exam = store.examById(examId);
    if (!exam) return;
    const patient = patientOf(exam);
    const total = sum(exam.resep, function (item) { return (Number(item.jumlah) || 0) * (Number(item.harga) || 0); });
    ui.modal({
      title: 'Detail Resep ' + exam.noPemeriksaan,
      subtitle: (patient ? patient.nama : 'Pasien') + ' · ' + NS.core.getPoli(exam.poli).nama,
      icon: 'pill',
      size: 'lg',
      content: '<div class="rx-detail-head"><div>' +
          '<h3>' + ui.esc(patient ? patient.nama : 'Pasien') + '</h3>' +
          '<p>' + ui.esc(patient ? patient.noRM + ' · ' + ui.ageLabel(patient.tanggalLahir) + ' · ' + patient.noTelepon : '—') + '</p>' +
          '<div style="margin-top:6px">' + (patient && patient.jenisKepersertaan === 'BPJS' ? '<span class="badge badge-info">BPJS</span>' : '<span class="badge badge-muted">Umum</span>') + ' ' + ui.poliBadge(exam.poli) + '</div>' +
        '</div>' +
        '<div class="table-actions">' +
          '<button type="button" class="btn btn-secondary btn-sm" id="rxModalPrint">' + ui.icon('printer') + 'Cetak Resep</button>' +
          (exam.resepStatus === 'menunggu' ? '<button type="button" class="btn btn-primary btn-sm" id="rxModalDispense">' + ui.icon('check-circle') + 'Serahkan Obat</button>' : '') +
        '</div>' +
      '</div>' +
      '<div class="rx-detail-grid">' +
        '<div>' +
          '<div class="table-responsive"><table class="data-table"><thead><tr><th>Obat</th><th>Jumlah</th><th>Harga</th><th>Aturan pakai</th><th>Stok</th></tr></thead><tbody>' +
          (exam.resep || []).map(function (item) {
            const medicine = store.medicineById(item.medicineId);
            const enough = medicine && Number(medicine.stok) >= Number(item.jumlah);
            return '<tr><td><strong>' + ui.esc(item.nama) + '</strong><small class="table-sub">' + ui.esc(medicine ? medicine.kode : '—') + '</small></td>' +
              '<td>' + ui.number(item.jumlah) + ' ' + ui.esc(item.satuan) + '</td>' +
              '<td>' + ui.currency((Number(item.harga) || 0) * (Number(item.jumlah) || 0)) + '</td>' +
              '<td>' + ui.esc(item.aturan) + '</td>' +
              '<td>' + (medicine ? (enough ? '<span class="badge badge-success">Cukup</span>' : '<span class="badge badge-danger">Kurang</span>') : '<span class="badge badge-muted">—</span>') + '</td></tr>';
          }).join('') + '</tbody></table></div>' +
          '<div class="bill-totals"><div class="bill-total-row"><span>Total nilai obat</span><strong>' + ui.currency(total) + '</strong></div>' +
          '<div class="bill-total-row"><span>Status penyerahan</span><strong>' + (exam.resepStatus === 'diserahkan' ? 'Diserahkan ' + ui.esc(ui.fmtDateTime(exam.dispensedAt)) : 'Menunggu diserahkan') + '</strong></div></div>' +
          '<div class="inline-alert inline-alert-info" style="margin-top:12px">' + ui.icon('info') + '<span>Diagnosis: <strong>' + ui.esc(exam.diagnosis || '—') + '</strong> · Dokter: ' + ui.esc(userName(exam.dokterId)) + '</span></div>' +
        '</div>' +
        '<div class="rx-detail-patient">' +
          '<h3 style="font-size:.82rem;margin-bottom:8px">Ringkasan pasien</h3>' +
          '<div class="rx-detail-list">' +
            '<div><span>No. RM</span><strong>' + ui.esc(patient ? patient.noRM : '—') + '</strong></div>' +
            '<div><span>Umur</span><strong>' + ui.esc(patient ? ui.ageLabel(patient.tanggalLahir) : '—') + '</strong></div>' +
            '<div><span>Jenis kelamin</span><strong>' + ui.esc(patient ? (patient.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan') : '—') + '</strong></div>' +
            '<div><span>Alergi</span><strong>' + ui.esc(exam.riwayatAlergi || 'Tidak ada') + '</strong></div>' +
            '<div><span>Tanggal</span><strong>' + ui.esc(ui.fmtDate(exam.completedAt || exam.createdAt, 'medium')) + '</strong></div>' +
            '<div><span>Kontrol ulang</span><strong>' + ui.esc(exam.kontrolUlang ? ui.fmtDate(exam.kontrolUlang, 'medium') : '—') + '</strong></div>' +
          '</div>' +
          '<a href="#/pemeriksaan/' + ui.attr(exam.id) + '" class="btn btn-ghost btn-sm btn-block" style="margin-top:12px">' + ui.icon('file-text') + 'Buka rekam medis</a>' +
        '</div>' +
      '</div>',
      onMount: function (layer) {
        layer.querySelector('#rxModalPrint').addEventListener('click', function () { printPrescription(exam.id); });
        const dispenseButton = layer.querySelector('#rxModalDispense');
        if (dispenseButton) {
          dispenseButton.addEventListener('click', function () {
            ui.closeModal();
            dispense(exam.id, currentRoot);
          });
        }
      }
    });
  }

  function printPrescription(examId) {
    const exam = store.examById(examId);
    if (!exam) return;
    const patient = patientOf(exam);
    const clinic = store.clinic;
    const total = sum(exam.resep, function (item) { return (Number(item.jumlah) || 0) * (Number(item.harga) || 0); });
    const content = ui.printLetterhead('RESEP ELEKTRONIK') +
      '<div class="print-doc-meta">' +
        '<div class="print-doc-meta-block"><span>No. Pemeriksaan</span><strong>' + ui.esc(exam.noPemeriksaan) + '</strong></div>' +
        '<div class="print-doc-meta-block"><span>Tanggal Resep</span><strong>' + ui.esc(ui.fmtDate(exam.completedAt || exam.createdAt, 'full')) + '</strong></div>' +
        '<div class="print-doc-meta-block"><span>Poli</span><strong>' + ui.esc(poliName(exam.poli)) + '</strong></div>' +
      '</div>' +
      '<div class="print-patient-box">' +
        '<div><span>Nama Pasien</span><strong>' + ui.esc(patient ? patient.nama : '—') + '</strong></div>' +
        '<div><span>No. RM</span><strong>' + ui.esc(patient ? patient.noRM : '—') + '</strong></div>' +
        '<div><span>Umur / JK</span><strong>' + ui.esc(patient ? ui.ageLabel(patient.tanggalLahir) + ' · ' + (patient.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan') : '—') + '</strong></div>' +
        '<div><span>Alamat</span><strong>' + ui.esc(patient ? patient.alamat : '—') + '</strong></div>' +
        '<div><span>Diagnosis</span><strong>' + ui.esc(exam.diagnosis || '—') + ' ' + (exam.kodeICD10 ? '(' + ui.esc(exam.kodeICD10) + ')' : '') + '</strong></div>' +
        '<div><span>Alergi</span><strong>' + ui.esc(exam.riwayatAlergi || 'Tidak ada') + '</strong></div>' +
      '</div>' +
      '<h3 class="print-section-title">Daftar Obat</h3>' +
      '<table class="print-table"><thead><tr><th>No</th><th>Nama Obat</th><th>Jumlah</th><th>Aturan Pakai</th><th>Harga</th></tr></thead><tbody>' +
      (exam.resep || []).map(function (item, index) {
        return '<tr><td>' + (index + 1) + '</td><td>' + ui.esc(item.nama) + '</td><td>' + ui.number(item.jumlah) + ' ' + ui.esc(item.satuan) + '</td><td>' + ui.esc(item.aturan) + '</td><td>' + ui.currency((Number(item.harga) || 0) * (Number(item.jumlah) || 0)) + '</td></tr>';
      }).join('') +
      '</tbody><tfoot><tr><td colspan="4" style="text-align:right;font-weight:700">Total estimasi</td><td style="font-weight:700">' + ui.currency(total) + '</td></tr></tfoot></table>' +
      '<div class="print-note">' + ui.icon('info') + '<span>Obat telah diverifikasi ketersediaan dan tanggal kedaluwarsanya oleh petugas farmasi. Simpan resep ini sebagai bukti pelayanan.</span></div>' +
      '<div class="print-signatures">' +
        '<div><span>Petugas Farmasi</span><div class="signature-space"></div><strong>' + ui.esc(store.currentUser().name) + '</strong></div>' +
        '<div><span>Dokter Penulis Resep</span><div class="signature-space"></div><strong>' + ui.esc(userName(exam.dokterId)) + '</strong></div>' +
      '</div>' + ui.printFooter();
    ui.printDocument(content, { title: 'Resep — ' + (patient ? patient.nama : exam.noPemeriksaan) });
  }

  /* ------------------------------------------------------------------------
     Master obat
     ------------------------------------------------------------------------ */
  function filteredMedicines() {
    let list = store.medicines();
    if (state.medSearch) {
      const query = state.medSearch.toLowerCase();
      list = list.filter(function (medicine) {
        return [medicine.nama, medicine.kode, medicine.kategori, medicine.batch, medicine.lokasi].some(function (value) {
          return String(value || '').toLowerCase().includes(query);
        });
      });
    }
    if (state.medCategory) list = list.filter(function (medicine) { return medicine.kategori === state.medCategory; });
    if (state.medStatus) list = list.filter(function (medicine) { return NS.core.medicineStatus(medicine).key === state.medStatus; });
    return list;
  }

  function medicineRow(medicine) {
    const status = NS.core.medicineStatus(medicine);
    const canManage = store.can('pharmacy.manage');
    return '<tr>' +
      '<td data-label="Obat"><span class="medicine-name">' + ui.esc(medicine.nama) + '</span><span class="medicine-meta">' + ui.esc(medicine.kode) + ' · Batch ' + ui.esc(medicine.batch || '—') + '</span></td>' +
      '<td data-label="Kategori">' + ui.esc(medicine.kategori) + '<small class="table-sub">Rak ' + ui.esc(medicine.lokasi || '—') + '</small></td>' +
      '<td data-label="Stok">' + stockMeter(medicine) + '<span class="table-sub">Min. ' + ui.number(medicine.stokMinimum) + ' ' + ui.esc(medicine.satuan) + '</span></td>' +
      '<td data-label="Harga">' + ui.currency(medicine.harga) + '<small class="table-sub">per ' + ui.esc(medicine.satuan) + '</small></td>' +
      '<td data-label="Kedaluwarsa">' + ui.esc(ui.fmtDate(medicine.kadaluarsa, 'medium')) + '<small class="table-sub">' + (medicine.kadaluarsa && medicine.kadaluarsa < today() ? 'Sudah kedaluwarsa' : 'Batch ' + ui.esc(medicine.batch || '—')) + '</small></td>' +
      '<td data-label="Status">' + medicineStatusBadge(medicine) + (medicine.aktif === false ? ' <span class="badge badge-muted">Nonaktif</span>' : '') + '</td>' +
      '<td data-label="Aksi"><div class="table-actions">' +
        (canManage ? '<button type="button" class="icon-btn icon-btn-sm" title="Ubah obat" aria-label="Ubah ' + ui.attr(medicine.nama) + '" data-med-action="edit" data-id="' + ui.attr(medicine.id) + '">' + ui.icon('edit') + '</button>' : '') +
        (canManage ? '<button type="button" class="icon-btn icon-btn-sm accent" title="Terima stok" aria-label="Terima stok ' + ui.attr(medicine.nama) + '" data-med-action="receive" data-id="' + ui.attr(medicine.id) + '">' + ui.icon('plus') + '</button>' : '') +
        (canManage ? '<button type="button" class="icon-btn icon-btn-sm" title="Keluarkan stok" aria-label="Keluarkan stok ' + ui.attr(medicine.nama) + '" data-med-action="issue" data-id="' + ui.attr(medicine.id) + '">' + ui.icon('minus') + '</button>' : '') +
        '<button type="button" class="icon-btn icon-btn-sm" title="Riwayat stok" aria-label="Riwayat stok ' + ui.attr(medicine.nama) + '" data-med-action="history" data-id="' + ui.attr(medicine.id) + '">' + ui.icon('clock') + '</button>' +
      '</div></td>' +
    '</tr>';
  }

  function renderMedicines(root) {
    const all = store.medicines();
    const list = filteredMedicines();
    const totalPages = Math.max(1, Math.ceil(list.length / state.medPerPage));
    if (state.medPage > totalPages) state.medPage = totalPages;
    const shown = list.slice((state.medPage - 1) * state.medPerPage, state.medPage * state.medPerPage);
    const canManage = store.can('pharmacy.manage');
    const inventoryValue = sum(all, function (medicine) { return (Number(medicine.stok) || 0) * (Number(medicine.harga) || 0); });

    root.innerHTML = ui.pageHeader({
      eyebrow: 'Farmasi & Persediaan',
      title: 'Master Obat',
      description: 'Kelola katalog obat, harga, batch, lokasi penyimpanan, dan batas stok minimum.',
      actions: (canManage ? '<button type="button" class="btn btn-secondary" id="receiveStockBtn">' + ui.icon('upload') + 'Terima Stok</button>' +
        '<button type="button" class="btn btn-primary" id="newMedicineBtn">' + ui.icon('plus') + 'Obat Baru</button>' : '') +
        '<button type="button" class="btn btn-ghost" id="exportMedicineBtn">' + ui.icon('download') + 'CSV</button>'
    }) +
    '<div class="stats-grid stats-grid-compact">' +
      ui.statCard({ label: 'Jenis obat aktif', value: all.filter(function (medicine) { return medicine.aktif !== false; }).length, icon: 'pill', tone: 'teal', hint: all.length + ' item dalam katalog' }) +
      ui.statCard({ label: 'Nilai persediaan', value: ui.currency(inventoryValue), icon: 'wallet', tone: 'green', hint: 'Stok berjalan × harga satuan' }) +
      ui.statCard({ label: 'Perlu restock', value: all.filter(function (medicine) { const status = NS.core.medicineStatus(medicine).key; return status === 'low' || status === 'out'; }).length, icon: 'package', tone: 'amber', hint: 'Stok menipis atau habis' }) +
      ui.statCard({ label: 'Kedaluwarsa', value: all.filter(function (medicine) { const status = NS.core.medicineStatus(medicine).key; return status === 'expired' || status === 'expiring'; }).length, icon: 'alert', tone: 'rose', hint: 'Kedaluwarsa / ≤ 60 hari' }) +
    '</div>' +
    '<section class="card">' +
      '<div class="filter-bar">' +
        '<div class="search-field">' + ui.icon('search') + '<input type="search" id="medSearch" class="input" placeholder="Cari nama obat, kode, batch, atau rak…" value="' + ui.attr(state.medSearch) + '" aria-label="Cari obat">' + (state.medSearch ? '<button type="button" class="search-clear" id="medSearchClear" aria-label="Hapus pencarian">' + ui.icon('x') + '</button>' : '') + '</div>' +
        '<select id="medCategory" class="input input-auto" aria-label="Filter kategori">' + categoryOptions(state.medCategory) + '</select>' +
        '<select id="medStatus" class="input input-auto" aria-label="Filter status stok">' + ui.options([
          { value: 'safe', label: 'Stok aman' },
          { value: 'low', label: 'Stok menipis' },
          { value: 'out', label: 'Stok habis' },
          { value: 'expiring', label: 'Segera kedaluwarsa' },
          { value: 'expired', label: 'Kedaluwarsa' }
        ], state.medStatus, 'Semua status') + '</select>' +
        ui.pageSizeSelect(state.medPerPage, 'medPageSize') +
        '<button type="button" class="btn btn-secondary btn-sm" id="resetMedFilter">' + ui.icon('refresh') + 'Reset</button>' +
      '</div>' +
      '<div class="table-responsive">' +
        (shown.length ? '<table class="data-table medicine-table"><thead><tr><th>Obat</th><th>Kategori</th><th>Stok</th><th>Harga</th><th>Kedaluwarsa</th><th>Status</th><th class="th-actions">Aksi</th></tr></thead><tbody>' + shown.map(medicineRow).join('') + '</tbody></table>' :
          ui.emptyState('package', 'Obat tidak ditemukan', 'Ubah kata kunci atau filter yang digunakan.', '<button type="button" class="btn btn-secondary btn-sm" id="emptyResetMed">Reset filter</button>')) +
      '</div>' +
      (list.length ? ui.pagination(list.length, state.medPage, state.medPerPage) : '') +
    '</section>';

    const search = root.querySelector('#medSearch');
    search.addEventListener('input', ui.debounce(function () {
      state.medSearch = search.value;
      state.medPage = 1;
      renderMedicines(root);
      const next = root.querySelector('#medSearch');
      if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
    }, 220));
    const clear = root.querySelector('#medSearchClear');
    if (clear) clear.addEventListener('click', function () { state.medSearch = ''; state.medPage = 1; renderMedicines(root); });
    root.querySelector('#medCategory').addEventListener('change', function (event) { state.medCategory = event.target.value; state.medPage = 1; renderMedicines(root); });
    root.querySelector('#medStatus').addEventListener('change', function (event) { state.medStatus = event.target.value; state.medPage = 1; renderMedicines(root); });
    root.querySelector('#medPageSize').addEventListener('change', function (event) { state.medPerPage = Number(event.target.value); state.medPage = 1; renderMedicines(root); });
    function resetFilters() { state.medSearch = ''; state.medCategory = ''; state.medStatus = ''; state.medPage = 1; renderMedicines(root); }
    root.querySelector('#resetMedFilter').addEventListener('click', resetFilters);
    const emptyReset = root.querySelector('#emptyResetMed');
    if (emptyReset) emptyReset.addEventListener('click', resetFilters);
    root.querySelectorAll('[data-page]').forEach(function (button) {
      button.addEventListener('click', function () { state.medPage = Number(button.dataset.page) || 1; renderMedicines(root); });
    });
    root.querySelectorAll('[data-med-action]').forEach(function (button) {
      button.addEventListener('click', function () {
        const id = button.dataset.id;
        if (button.dataset.medAction === 'edit') openMedicineModal(id, root);
        if (button.dataset.medAction === 'receive') openStockModal('masuk', id, root);
        if (button.dataset.medAction === 'issue') openStockModal('keluar', id, root);
        if (button.dataset.medAction === 'history') openMedicineHistory(id);
      });
    });
    const newButton = root.querySelector('#newMedicineBtn');
    if (newButton) newButton.addEventListener('click', function () { openMedicineModal(null, root); });
    const receiveButton = root.querySelector('#receiveStockBtn');
    if (receiveButton) receiveButton.addEventListener('click', function () { openStockModal('masuk', null, root); });
    root.querySelector('#exportMedicineBtn').addEventListener('click', function () {
      ui.exportCsv('master-obat-' + today() + '.csv', ['Kode', 'Nama Obat', 'Kategori', 'Satuan', 'Stok', 'Stok Minimum', 'Harga', 'Batch', 'Kedaluwarsa', 'Lokasi', 'Status', 'Aktif'], list.map(function (medicine) {
        return [medicine.kode, medicine.nama, medicine.kategori, medicine.satuan, medicine.stok, medicine.stokMinimum, medicine.harga, medicine.batch, medicine.kadaluarsa, medicine.lokasi, NS.core.medicineStatus(medicine).label, medicine.aktif === false ? 'Tidak' : 'Ya'];
      }));
    });
  }

  function openMedicineModal(id, root) {
    const medicine = id ? store.medicineById(id) : null;
    const defaultExpiry = NS.core.addDaysKey(today(), 365);
    ui.modal({
      title: medicine ? 'Ubah Data Obat' : 'Tambah Obat Baru',
      subtitle: medicine ? medicine.kode + ' · ' + medicine.nama : 'Lengkapi identitas dan persediaan awal obat.',
      icon: 'pill',
      size: 'lg',
      content: '<form id="medicineForm" novalidate>' +
        '<div class="form-error-host"></div>' +
        '<div class="form-grid-2">' +
          '<div class="field full"><label for="medNama">Nama obat <span class="required">*</span></label><input id="medNama" name="nama" class="input" value="' + ui.attr(medicine ? medicine.nama : '') + '" placeholder="Contoh: Paracetamol 500 mg" required></div>' +
          '<div class="field"><label for="medKode">Kode obat</label><input id="medKode" name="kode" class="input mono" value="' + ui.attr(medicine ? medicine.kode : '') + '" placeholder="Otomatis jika kosong"></div>' +
          '<div class="field"><label for="medKategori">Kategori <span class="required">*</span></label><input id="medKategori" name="kategori" class="input" list="medicineCategories" value="' + ui.attr(medicine ? medicine.kategori : '') + '" placeholder="Analgesik / Antibiotik / …" required><datalist id="medicineCategories">' + Array.from(new Set(store.medicines().map(function (item) { return item.kategori; }))).map(function (category) { return '<option value="' + ui.attr(category) + '"></option>'; }).join('') + '</datalist></div>' +
          '<div class="field"><label for="medSatuan">Satuan <span class="required">*</span></label><input id="medSatuan" name="satuan" class="input" value="' + ui.attr(medicine ? medicine.satuan : '') + '" placeholder="Tablet / Kapsul / Botol" required></div>' +
          '<div class="field"><label for="medHarga">Harga satuan (Rp) <span class="required">*</span></label><input id="medHarga" name="harga" type="number" min="0" step="1" class="input" value="' + ui.attr(medicine ? medicine.harga : '') + '" required></div>' +
          '<div class="field"><label for="medMin">Stok minimum <span class="required">*</span></label><input id="medMin" name="stokMinimum" type="number" min="0" step="1" class="input" value="' + ui.attr(medicine ? medicine.stokMinimum : 10) + '" required></div>' +
          (medicine ? '<div class="field"><label>Stok saat ini</label><input class="input" value="' + ui.attr(medicine.stok + ' ' + medicine.satuan) + '" disabled></div>' :
            '<div class="field"><label for="medStok">Stok awal</label><input id="medStok" name="stok" type="number" min="0" step="1" class="input" value="0"></div>') +
          '<div class="field"><label for="medBatch">Nomor batch</label><input id="medBatch" name="batch" class="input mono" value="' + ui.attr(medicine ? medicine.batch : '') + '" placeholder="Contoh: PCM-2611"></div>' +
          '<div class="field"><label for="medExpiry">Tanggal kedaluwarsa <span class="required">*</span></label><input id="medExpiry" name="kadaluarsa" type="date" class="input" value="' + ui.attr(medicine ? medicine.kadaluarsa : defaultExpiry) + '" required></div>' +
          '<div class="field"><label for="medLokasi">Lokasi penyimpanan</label><input id="medLokasi" name="lokasi" class="input" value="' + ui.attr(medicine ? medicine.lokasi : '') + '" placeholder="Contoh: Rak A-1"></div>' +
          (medicine ? '' : '<div class="field"><label for="medSupplier">Supplier / distributor</label><input id="medSupplier" name="supplier" class="input" value="" placeholder="Pengadaan awal"></div>') +
          '<div class="field full"><label class="check-card compact" for="medAktif"><input type="checkbox" id="medAktif" name="aktif" value="1"' + (!medicine || medicine.aktif !== false ? ' checked' : '') + '><span class="check-card-copy"><strong>Obat aktif</strong><small>Obat nonaktif tidak ditampilkan pada pilihan resep.</small></span><span class="switch" aria-hidden="true"></span></label></div>' +
        '</div>' +
      '</form>',
      footer: '<button type="button" class="btn btn-secondary" data-modal-close>Batal</button><button type="submit" form="medicineForm" class="btn btn-primary">' + ui.icon('check') + (medicine ? 'Simpan Perubahan' : 'Tambah Obat') + '</button>',
      onMount: function (layer) {
        const form = layer.querySelector('#medicineForm');
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          if (!form.reportValidity()) return;
          const values = ui.readForm(form);
          const button = layer.querySelector('[form="medicineForm"]');
          ui.setSubmitting(button, true, 'Menyimpan…');
          try {
            store.saveMedicine({
              nama: values.nama,
              kode: values.kode,
              kategori: values.kategori,
              satuan: values.satuan,
              stok: medicine ? medicine.stok : values.stok,
              stokMinimum: values.stokMinimum,
              harga: values.harga,
              batch: values.batch,
              kadaluarsa: values.kadaluarsa,
              lokasi: values.lokasi,
              supplier: values.supplier,
              aktif: Boolean(form.querySelector('#medAktif').checked)
            }, medicine ? medicine.id : null);
            ui.closeModal();
            ui.toast(medicine ? 'Data obat berhasil diperbarui.' : 'Obat baru berhasil ditambahkan.', 'success');
            renderMedicines(root);
          } catch (error) {
            ui.setSubmitting(button, false);
            form.querySelector('.form-error-host').innerHTML = ui.formError(error.message);
          }
        });
      }
    });
  }

  function openStockModal(type, medicineId, root) {
    const isIn = type === 'masuk';
    const medicine = medicineId ? store.medicineById(medicineId) : null;
    if (!store.can('pharmacy.manage')) {
      ui.toast('Anda tidak memiliki akses mengelola stok obat.', 'error');
      return;
    }
    const defaultExpiry = medicine ? medicine.kadaluarsa : NS.core.addDaysKey(today(), 365);
    ui.modal({
      title: isIn ? 'Penerimaan Stok Obat' : 'Pengeluaran Stok Obat',
      subtitle: isIn ? 'Catat obat masuk dari distributor atau gudang farmasi.' : 'Catat pengeluaran untuk penyesuaian, kerusakan, atau kedaluwarsa.',
      icon: isIn ? 'upload' : 'download',
      content: '<form id="stockForm" novalidate>' +
        '<div class="form-error-host"></div>' +
        '<div class="form-grid-2">' +
          '<div class="field full"><label for="stockMedicine">Obat <span class="required">*</span></label><select id="stockMedicine" name="medicineId" class="input" required>' + medicineOptions(medicineId) + '</select><div class="field-feedback" id="stockInfo">' + (medicine ? 'Stok saat ini ' + medicine.stok + ' ' + medicine.satuan + '.' : 'Pilih obat yang akan dicatat pergerakannya.') + '</div></div>' +
          '<div class="field"><label for="stockQty">Jumlah (' + (medicine ? ui.esc(medicine.satuan) : 'unit') + ') <span class="required">*</span></label><input id="stockQty" name="jumlah" type="number" min="1" step="1" class="input" value="1" required></div>' +
          (isIn ? '<div class="field"><label for="stockSupplier">Supplier</label><input id="stockSupplier" name="supplier" class="input" value="" placeholder="PT / distributor"></div>' +
            '<div class="field"><label for="stockBatch">Nomor batch</label><input id="stockBatch" name="batch" class="input mono" value="' + ui.attr(medicine ? medicine.batch : '') + '" placeholder="Batch penerimaan"></div>' +
            '<div class="field"><label for="stockExpiry">Kedaluwarsa batch <span class="required">*</span></label><input id="stockExpiry" name="kadaluarsa" type="date" class="input" value="' + ui.attr(defaultExpiry) + '" required></div>' +
            '<div class="field"><label for="stockRef">Nomor referensi</label><input id="stockRef" name="referensi" class="input mono" value="" placeholder="No. faktur / surat jalan"></div>' :
            '<div class="field"><label for="stockReason">Alasan pengeluaran <span class="required">*</span></label><select id="stockReason" name="alasan" class="input" required>' + ui.options(['Penyesuaian stok opname', 'Obat rusak', 'Obat kedaluwarsa', 'Retur / pemusnahan', 'Lainnya'], 'Penyesuaian stok opname') + '</select></div>' +
            '<div class="field"><label for="stockRef">Nomor referensi</label><input id="stockRef" name="referensi" class="input mono" value="" placeholder="No. berita acara"></div>') +
          '<div class="field full"><label for="stockNote">Catatan</label><textarea id="stockNote" name="catatan" class="input textarea" rows="2" placeholder="Keterangan tambahan…"></textarea></div>' +
        '</div>' +
        (isIn ? '<div class="inline-alert inline-alert-info" style="margin-top:12px">' + ui.icon('info') + '<span>Stok dan batch aktif obat akan diperbarui. Riwayat mutasi tersimpan pada buku stok.</span></div>' : '') +
      '</form>',
      footer: '<button type="button" class="btn btn-secondary" data-modal-close>Batal</button><button type="submit" form="stockForm" class="btn btn-primary">' + ui.icon(isIn ? 'upload' : 'download') + (isIn ? 'Simpan Penerimaan' : 'Simpan Pengeluaran') + '</button>',
      onMount: function (layer) {
        const form = layer.querySelector('#stockForm');
        const select = form.querySelector('#stockMedicine');
        const info = form.querySelector('#stockInfo');
        select.addEventListener('change', function () {
          const selected = store.medicineById(select.value);
          info.textContent = selected ? 'Stok saat ini ' + selected.stok + ' ' + selected.satuan + ' · min. ' + selected.stokMinimum + ' · kedaluwarsa ' + ui.fmtDate(selected.kadaluarsa, 'medium') + '.' : 'Pilih obat yang akan dicatat pergerakannya.';
          if (isIn) {
            const batch = form.querySelector('#stockBatch');
            if (batch && selected) batch.value = selected.batch || '';
            const expiry = form.querySelector('#stockExpiry');
            if (expiry && selected) expiry.value = selected.kadaluarsa || defaultExpiry;
          }
        });
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          if (!form.reportValidity()) return;
          const values = ui.readForm(form);
          if (!values.medicineId) {
            form.querySelector('.form-error-host').innerHTML = ui.formError('Pilih obat terlebih dahulu.');
            return;
          }
          const button = layer.querySelector('[form="stockForm"]');
          ui.setSubmitting(button, true, 'Menyimpan…');
          try {
            const payload = {
              jumlah: values.jumlah,
              supplier: values.supplier,
              batch: values.batch,
              kadaluarsa: values.kadaluarsa,
              referensi: values.referensi,
              catatan: isIn ? (values.catatan || 'Penerimaan stok obat') : ((values.alasan || 'Pengeluaran stok') + (values.catatan ? ' · ' + values.catatan : ''))
            };
            if (isIn) store.addStock(values.medicineId, payload);
            else store.removeStock(values.medicineId, payload);
            ui.closeModal();
            ui.toast(isIn ? 'Penerimaan stok berhasil dicatat.' : 'Pengeluaran stok berhasil dicatat.', 'success');
            renderMedicines(root);
          } catch (error) {
            ui.setSubmitting(button, false);
            form.querySelector('.form-error-host').innerHTML = ui.formError(error.message);
          }
        });
      }
    });
  }

  function openMedicineHistory(medicineId) {
    const medicine = store.medicineById(medicineId);
    if (!medicine) return;
    const list = store.mutations().filter(function (mutation) { return mutation.medicineId === medicineId; });
    ui.modal({
      title: 'Riwayat Stok · ' + medicine.nama,
      subtitle: 'Stok saat ini ' + medicine.stok + ' ' + medicine.satuan + ' · minimum ' + medicine.stokMinimum,
      icon: 'clock',
      size: 'lg',
      content: list.length ? '<div class="table-responsive"><table class="data-table stock-history-table"><thead><tr><th>Tanggal</th><th>Tipe</th><th>Jumlah</th><th>Stok</th><th>Referensi</th><th>Petugas</th></tr></thead><tbody>' +
        list.map(function (mutation) {
          return '<tr><td>' + ui.esc(ui.fmtDateTime(mutation.createdAt)) + '</td>' +
            '<td><span class="stock-type ' + (mutation.tipe === 'masuk' ? 'in' : 'out') + '">' + ui.icon(mutation.tipe === 'masuk' ? 'arrow-down' : 'arrow-up') + (mutation.tipe === 'masuk' ? 'Masuk' : 'Keluar') + '</span></td>' +
            '<td>' + (mutation.tipe === 'masuk' ? '+' : '−') + ui.number(mutation.jumlah) + '</td>' +
            '<td>' + ui.number(mutation.stokSesudah) + '</td>' +
            '<td><span class="mono small">' + ui.esc(mutation.referensi || '—') + '</span><small class="table-sub">' + ui.esc(mutation.catatan) + '</small></td>' +
            '<td>' + ui.esc(mutation.userName || '—') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : ui.emptyState('package', 'Belum ada mutasi', 'Belum ada penerimaan atau pengeluaran untuk obat ini.'),
      footer: '<button type="button" class="btn btn-secondary" data-modal-close>Tutup</button>'
    });
  }

  /* ------------------------------------------------------------------------
     Buku stok
     ------------------------------------------------------------------------ */
  function filteredMutations() {
    let list = store.mutations();
    if (state.mutType) list = list.filter(function (mutation) { return mutation.tipe === state.mutType; });
    if (state.mutMedicine) list = list.filter(function (mutation) { return mutation.medicineId === state.mutMedicine; });
    if (state.mutSearch) {
      const query = state.mutSearch.toLowerCase();
      list = list.filter(function (mutation) {
        const medicine = store.medicineById(mutation.medicineId);
        return [mutation.referensi, mutation.catatan, mutation.userName, medicine ? medicine.nama : '', medicine ? medicine.kode : ''].some(function (value) {
          return String(value || '').toLowerCase().includes(query);
        });
      });
    }
    return list;
  }

  function mutationRow(mutation) {
    const medicine = store.medicineById(mutation.medicineId);
    return '<tr>' +
      '<td data-label="Waktu">' + ui.esc(ui.fmtDateTime(mutation.createdAt)) + '</td>' +
      '<td data-label="Obat"><strong>' + ui.esc(medicine ? medicine.nama : 'Obat dihapus') + '</strong><small class="table-sub">' + ui.esc(medicine ? medicine.kode + ' · ' + medicine.satuan : '—') + '</small></td>' +
      '<td data-label="Tipe"><span class="stock-type ' + (mutation.tipe === 'masuk' ? 'in' : 'out') + '">' + ui.icon(mutation.tipe === 'masuk' ? 'arrow-down' : 'arrow-up') + (mutation.tipe === 'masuk' ? 'Masuk' : 'Keluar') + '</span></td>' +
      '<td data-label="Jumlah"><strong>' + (mutation.tipe === 'masuk' ? '+' : '−') + ui.number(mutation.jumlah) + '</strong></td>' +
      '<td data-label="Stok">' + ui.number(mutation.stokSebelum) + ' → <strong>' + ui.number(mutation.stokSesudah) + '</strong></td>' +
      '<td data-label="Referensi"><span class="mono small">' + ui.esc(mutation.referensi || '—') + '</span><small class="table-sub">' + ui.esc(mutation.catatan) + '</small></td>' +
      '<td data-label="Petugas">' + ui.esc(mutation.userName || 'Sistem') + '</td>' +
    '</tr>';
  }

  function alertCard(type, count, label, detail, iconName, tone) {
    return '<button type="button" class="alert-card" data-alert-filter="' + ui.attr(type) + '">' +
      '<span class="alert-card-icon ' + (tone || '') + '">' + ui.icon(iconName) + '</span>' +
      '<span class="alert-card-copy"><strong>' + ui.number(count) + '</strong><span>' + ui.esc(label) + '</span></span>' +
    '</button>';
  }

  function renderStock(root) {
    const alerts = store.stockAlerts();
    const allMutations = store.mutations();
    const list = filteredMutations();
    const totalPages = Math.max(1, Math.ceil(list.length / state.mutPerPage));
    if (state.mutPage > totalPages) state.mutPage = totalPages;
    const shown = list.slice((state.mutPage - 1) * state.mutPerPage, state.mutPage * state.mutPerPage);
    const canManage = store.can('pharmacy.manage');
    const todayMutations = allMutations.filter(function (mutation) { return dateKeyOf(mutation.createdAt) === today(); });
    const incomingToday = sum(todayMutations.filter(function (mutation) { return mutation.tipe === 'masuk'; }), function (mutation) { return mutation.jumlah; });
    const outgoingToday = sum(todayMutations.filter(function (mutation) { return mutation.tipe === 'keluar'; }), function (mutation) { return mutation.jumlah; });

    root.innerHTML = ui.pageHeader({
      eyebrow: 'Farmasi & Persediaan',
      title: 'Buku Stok Obat',
      description: 'Pantau pergerakan stok, penerimaan, pengeluaran, dan peringatan persediaan farmasi.',
      actions: (canManage ? '<button type="button" class="btn btn-secondary" id="stockIssueTop">' + ui.icon('download') + 'Stok Keluar</button>' +
        '<button type="button" class="btn btn-primary" id="stockReceiveTop">' + ui.icon('upload') + 'Terima Stok</button>' : '') +
        '<button type="button" class="btn btn-ghost" id="stockExportBtn">' + ui.icon('download') + 'CSV</button>'
    }) +
    '<div class="alert-grid">' +
      alertCard('low', alerts.low.length, 'Stok menipis', 'Di bawah batas minimum', 'package', '') +
      alertCard('out', alerts.out.length, 'Stok habis', 'Perlu pengadaan segera', 'alert', 'is-danger') +
      alertCard('expiring', alerts.expiring.length, 'Segera kedaluwarsa', 'Dalam 60 hari ke depan', 'clock', 'is-info') +
      alertCard('expired', alerts.expired.length, 'Kedaluwarsa', 'Harus segera dikeluarkan', 'alert-circle', 'is-danger') +
    '</div>' +
    '<div class="stock-layout">' +
      '<div class="stock-main">' +
        '<section class="card">' +
          ui.sectionHeader('Mutasi stok', 'Seluruh penerimaan dan pengeluaran obat tercatat kronologis.', '<span class="soft-chip">' + ui.icon('activity') + 'Masuk hari ini ' + ui.number(incomingToday) + ' · Keluar ' + ui.number(outgoingToday) + '</span>', 'package') +
          '<div class="filter-bar">' +
            '<div class="search-field">' + ui.icon('search') + '<input type="search" id="mutSearch" class="input" placeholder="Cari obat, referensi, petugas…" value="' + ui.attr(state.mutSearch) + '" aria-label="Cari mutasi stok">' + (state.mutSearch ? '<button type="button" class="search-clear" id="mutSearchClear" aria-label="Hapus pencarian">' + ui.icon('x') + '</button>' : '') + '</div>' +
            '<select id="mutType" class="input input-auto" aria-label="Filter tipe mutasi">' + ui.options([{ value: 'masuk', label: 'Penerimaan' }, { value: 'keluar', label: 'Pengeluaran' }], state.mutType, 'Semua tipe') + '</select>' +
            '<select id="mutMedicine" class="input input-auto" aria-label="Filter obat">' + '<option value="">Semua obat</option>' + store.medicines().map(function (medicine) { return '<option value="' + ui.attr(medicine.id) + '"' + (medicine.id === state.mutMedicine ? ' selected' : '') + '>' + ui.esc(medicine.nama) + '</option>'; }).join('') + '</select>' +
            '<button type="button" class="btn btn-secondary btn-sm" id="resetMutFilter">' + ui.icon('refresh') + 'Reset</button>' +
          '</div>' +
          '<div class="table-responsive">' +
            (shown.length ? '<table class="data-table stock-history-table"><thead><tr><th>Waktu</th><th>Obat</th><th>Tipe</th><th>Jumlah</th><th>Stok</th><th>Referensi</th><th>Petugas</th></tr></thead><tbody>' + shown.map(mutationRow).join('') + '</tbody></table>' :
              ui.emptyState('package', 'Belum ada mutasi', 'Penerimaan atau pengeluaran obat akan tercatat di sini.')) +
          '</div>' +
          (list.length ? ui.pagination(list.length, state.mutPage, state.mutPerPage) : '') +
        '</section>' +
      '</div>' +
      '<aside class="stock-side">' +
        '<section class="card">' +
          '<h3>Perlu perhatian</h3><p class="section-note">Obat dengan stok atau tanggal kedaluwarsa bermasalah.</p>' +
          '<div class="alert-list">' +
            ([].concat(alerts.out, alerts.low, alerts.expired, alerts.expiring).slice(0, 8).map(function (medicine) {
              return '<div class="alert-row"><span class="alert-card-icon ' + (Number(medicine.stok) <= 0 ? 'is-danger' : '') + '">' + ui.icon(Number(medicine.stok) <= 0 ? 'alert-circle' : 'package') + '</span>' +
                '<span><strong>' + ui.esc(medicine.nama) + '</strong><small>' + ui.number(medicine.stok) + ' ' + ui.esc(medicine.satuan) + ' · min. ' + ui.number(medicine.stokMinimum) + '</small></span>' +
                medicineStatusBadge(medicine) + '</div>';
            }).join('') || '<p class="aside-empty">Semua persediaan dalam kondisi aman.</p>') +
          '</div>' +
          '<a href="#/farmasi/obat" class="btn btn-secondary btn-sm btn-block" style="margin-top:11px">' + ui.icon('package') + 'Kelola Master Obat</a>' +
        '</section>' +
        '<section class="card">' +
          '<h3>Ringkasan persediaan</h3><p class="section-note">Kondisi stok saat ini.</p>' +
          '<div class="info-list">' +
            '<div><span>Jenis obat</span><strong>' + ui.number(store.medicines().length) + ' item</strong></div>' +
            '<div><span>Total unit</span><strong>' + ui.number(sum(store.medicines(), function (medicine) { return medicine.stok; })) + ' unit</strong></div>' +
            '<div><span>Nilai persediaan</span><strong>' + ui.currency(sum(store.medicines(), function (medicine) { return (Number(medicine.stok) || 0) * (Number(medicine.harga) || 0); })) + '</strong></div>' +
            '<div><span>Penerimaan hari ini</span><strong>' + ui.number(incomingToday) + ' unit</strong></div>' +
            '<div><span>Pengeluaran hari ini</span><strong>' + ui.number(outgoingToday) + ' unit</strong></div>' +
          '</div>' +
        '</section>' +
      '</aside>' +
    '</div>';

    const search = root.querySelector('#mutSearch');
    search.addEventListener('input', ui.debounce(function () {
      state.mutSearch = search.value;
      state.mutPage = 1;
      renderStock(root);
      const next = root.querySelector('#mutSearch');
      if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
    }, 240));
    const clear = root.querySelector('#mutSearchClear');
    if (clear) clear.addEventListener('click', function () { state.mutSearch = ''; state.mutPage = 1; renderStock(root); });
    root.querySelector('#mutType').addEventListener('change', function (event) { state.mutType = event.target.value; state.mutPage = 1; renderStock(root); });
    root.querySelector('#mutMedicine').addEventListener('change', function (event) { state.mutMedicine = event.target.value; state.mutPage = 1; renderStock(root); });
    root.querySelector('#resetMutFilter').addEventListener('click', function () {
      state.mutSearch = ''; state.mutType = ''; state.mutMedicine = ''; state.mutPage = 1; renderStock(root);
    });
    root.querySelectorAll('.alert-card').forEach(function (card) {
      card.addEventListener('click', function () {
        state.medStatus = card.dataset.alertFilter;
        state.medPage = 1;
        location.hash = '#/farmasi/obat';
      });
    });
    root.querySelectorAll('[data-page]').forEach(function (button) {
      button.addEventListener('click', function () { state.mutPage = Number(button.dataset.page) || 1; renderStock(root); });
    });
    const receive = root.querySelector('#stockReceiveTop');
    if (receive) receive.addEventListener('click', function () { openStockModal('masuk', null, root); });
    const issue = root.querySelector('#stockIssueTop');
    if (issue) issue.addEventListener('click', function () { openStockModal('keluar', null, root); });
    root.querySelector('#stockExportBtn').addEventListener('click', function () {
      ui.exportCsv('mutasi-stok-' + today() + '.csv', ['Tanggal', 'Obat', 'Kode', 'Tipe', 'Jumlah', 'Stok Sebelum', 'Stok Sesudah', 'Referensi', 'Catatan', 'Petugas'], list.map(function (mutation) {
        const medicine = store.medicineById(mutation.medicineId);
        return [ui.fmtDateTime(mutation.createdAt), medicine ? medicine.nama : '', medicine ? medicine.kode : '', mutation.tipe === 'masuk' ? 'Masuk' : 'Keluar', mutation.jumlah, mutation.stokSebelum, mutation.stokSesudah, mutation.referensi, mutation.catatan, mutation.userName];
      }));
    });
  }

  /* ------------------------------------------------------------------------
     Laporan penggunaan obat
     ------------------------------------------------------------------------ */
  function reportData() {
    const start = state.reportStart;
    const end = state.reportEnd;
    const mutations = store.mutations().filter(function (mutation) {
      const day = dateKeyOf(mutation.createdAt);
      return day >= start && day <= end;
    });
    const exams = store.exams().filter(function (exam) {
      if (!exam.dispensedAt || exam.resepStatus !== 'diserahkan') return false;
      const day = dateKeyOf(exam.dispensedAt);
      return day >= start && day <= end;
    });
    const rows = store.medicines().map(function (medicine) {
      const own = mutations.filter(function (mutation) { return mutation.medicineId === medicine.id; });
      const incoming = sum(own.filter(function (mutation) { return mutation.tipe === 'masuk'; }), function (mutation) { return mutation.jumlah; });
      const outgoing = sum(own.filter(function (mutation) { return mutation.tipe === 'keluar'; }), function (mutation) { return mutation.jumlah; });
      return {
        medicine: medicine,
        incoming: incoming,
        outgoing: outgoing,
        value: outgoing * (Number(medicine.harga) || 0),
        status: NS.core.medicineStatus(medicine),
        transactions: own.length
      };
    }).filter(function (row) { return row.incoming > 0 || row.outgoing > 0 || row.medicine.aktif !== false; });
    rows.sort(function (a, b) { return b.outgoing - a.outgoing; });
    return {
      start: start,
      end: end,
      rows: rows,
      mutations: mutations,
      exams: exams,
      incoming: sum(mutations.filter(function (mutation) { return mutation.tipe === 'masuk'; }), function (mutation) { return mutation.jumlah; }),
      outgoing: sum(mutations.filter(function (mutation) { return mutation.tipe === 'keluar'; }), function (mutation) { return mutation.jumlah; }),
      value: sum(rows, function (row) { return row.value; }),
      types: new Set(exams.map(function (exam) { return exam.id; })).size,
      items: sum(exams, function (exam) { return (exam.resep || []).length; }),
      alerts: store.stockAlerts()
    };
  }

  function renderReports(root) {
    const data = reportData();
    const top = data.rows.filter(function (row) { return row.outgoing > 0; }).slice(0, 8).map(function (row) {
      return { label: row.medicine.nama, value: row.outgoing, extra: row.medicine.satuan };
    });
    root.innerHTML = ui.pageHeader({
      eyebrow: 'Farmasi & Analitik',
      title: 'Laporan Penggunaan Obat',
      description: 'Analisis pemakaian, penerimaan, nilai persediaan, dan penyerahan resep dalam periode tertentu.',
      actions: '<button type="button" class="btn btn-secondary" id="phReportPrint">' + ui.icon('printer') + 'Cetak Laporan</button>' +
        '<button type="button" class="btn btn-primary" id="phReportExport">' + ui.icon('download') + 'Unduh CSV</button>'
    }) +
    '<div class="report-toolbar card">' +
      '<div class="report-toolbar-left">' +
        '<div class="report-company"><span class="brand-mark">' + ui.brandMark() + '</span><div class="report-title-block"><h2>Laporan Farmasi</h2><p id="phReportPeriod">' + ui.esc(ui.fmtDate(data.start, 'medium')) + ' – ' + ui.esc(ui.fmtDate(data.end, 'medium')) + '</p></div></div>' +
        '<span class="report-filter-chip">' + ui.icon('calendar') + 'Periode laporan</span>' +
      '</div>' +
      '<div class="report-toolbar-right">' +
        '<label class="field" style="flex-direction:row;align-items:center;gap:7px"><span class="muted" style="font-size:.68rem">Dari</span><input type="date" id="phStart" class="input input-sm input-auto" value="' + ui.attr(state.reportStart) + '" aria-label="Tanggal mulai"></label>' +
        '<label class="field" style="flex-direction:row;align-items:center;gap:7px"><span class="muted" style="font-size:.68rem">Sampai</span><input type="date" id="phEnd" class="input input-sm input-auto" value="' + ui.attr(state.reportEnd) + '" aria-label="Tanggal akhir"></label>' +
        '<button type="button" class="btn btn-secondary btn-sm" id="phApply">' + ui.icon('filter') + 'Terapkan</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" id="phReset">' + ui.icon('refresh') + '30 hari</button>' +
      '</div>' +
    '</div>' +
    '<div class="report-kpis">' +
      '<div class="report-kpi"><span>Resep diserahkan</span><strong>' + ui.number(data.types) + '</strong><small>' + ui.number(data.items) + ' jenis obat</small></div>' +
      '<div class="report-kpi"><span>Obat masuk</span><strong>' + ui.number(data.incoming) + '</strong><small>unit diterima</small></div>' +
      '<div class="report-kpi"><span>Obat keluar</span><strong>' + ui.number(data.outgoing) + '</strong><small>unit diserahkan / keluar</small></div>' +
      '<div class="report-kpi"><span>Nilai pemakaian</span><strong>' + ui.currency(data.value) + '</strong><small>harga satuan × unit keluar</small></div>' +
      '<div class="report-kpi"><span>Perlu perhatian</span><strong>' + ui.number(data.alerts.low.length + data.alerts.out.length + data.alerts.expired.length) + '</strong><small>stok / kedaluwarsa</small></div>' +
    '</div>' +
    '<div class="report-grid-2">' +
      '<section class="card usage-chart-card">' + ui.sectionHeader('Obat paling banyak keluar', 'Delapan obat dengan pemakaian unit tertinggi pada periode ini.', '', 'chart') + (top.length ? ui.barList(top, { valueFormatter: function (value) { return ui.number(value); }, color: '#0f766e' }) : ui.emptyState('chart', 'Belum ada pemakaian', 'Tidak ada pengeluaran obat pada periode ini.')) + '</section>' +
      '<section class="card">' + ui.sectionHeader('Kondisi persediaan', 'Ringkasan status stok master obat saat ini.', '', 'package') +
        '<div class="info-list">' +
          '<div><span>Stok aman</span><strong>' + ui.number(data.rows.filter(function (row) { return row.status.key === 'safe'; }).length) + ' obat</strong></div>' +
          '<div><span>Stok menipis</span><strong>' + ui.number(data.alerts.low.length) + ' obat</strong></div>' +
          '<div><span>Stok habis</span><strong>' + ui.number(data.alerts.out.length) + ' obat</strong></div>' +
          '<div><span>Kedaluwarsa</span><strong>' + ui.number(data.alerts.expired.length) + ' obat</strong></div>' +
          '<div><span>Segera kedaluwarsa</span><strong>' + ui.number(data.alerts.expiring.length) + ' obat</strong></div>' +
        '</div>' +
        '<a href="#/farmasi/stok" class="btn btn-secondary btn-sm btn-block" style="margin-top:12px">' + ui.icon('package') + 'Buka Buku Stok</a>' +
      '</section>' +
    '</div>' +
    '<section class="card">' +
      ui.sectionHeader('Rincian penggunaan per obat', 'Data dihitung dari mutasi stok dan penyerahan resep pada periode terpilih.', '<span class="report-filter-chip">' + ui.icon('calendar') + ui.esc(ui.fmtDate(data.start, 'medium')) + ' – ' + ui.esc(ui.fmtDate(data.end, 'medium')) + '</span>', 'file-text') +
      '<div class="table-responsive"><table class="data-table usage-table"><thead><tr><th>Obat</th><th>Kategori</th><th>Stok Awal</th><th>Masuk</th><th>Keluar</th><th>Stok Akhir</th><th>Nilai Keluar</th><th>Status</th></tr></thead><tbody>' +
      (data.rows.length ? data.rows.map(function (row) {
        return '<tr><td><span class="medicine-name">' + ui.esc(row.medicine.nama) + '</span><span class="medicine-meta">' + ui.esc(row.medicine.kode) + ' · ' + ui.esc(row.medicine.satuan) + '</span></td>' +
          '<td>' + ui.esc(row.medicine.kategori) + '</td>' +
          '<td>' + ui.number(Math.max(0, row.medicine.stok - row.incoming + row.outgoing)) + '</td>' +
          '<td><span class="stat-inline up">+' + ui.number(row.incoming) + '</span></td>' +
          '<td><strong>' + ui.number(row.outgoing) + '</strong></td>' +
          '<td>' + ui.number(row.medicine.stok) + '</td>' +
          '<td>' + ui.currency(row.value) + '</td>' +
          '<td>' + ui.badge(row.status.label, row.status.tone) + '</td></tr>';
      }).join('') : '<tr><td colspan="8">' + ui.emptyState('chart', 'Belum ada data', 'Belum ada mutasi obat pada periode ini.') + '</td></tr>') +
      '</tbody></table></div>' +
      '<div class="report-note">' + ui.icon('info') + '<span>“Stok awal” dihitung dari stok berjalan dikurangi penerimaan periode dan ditambah pengeluaran periode. Data mengikuti buku stok pada perangkat ini.</span></div>' +
    '</section>';

    root.querySelector('#phApply').addEventListener('click', function () {
      const start = root.querySelector('#phStart').value;
      const end = root.querySelector('#phEnd').value;
      if (!start || !end) { ui.toast('Lengkapi tanggal periode laporan.', 'warning'); return; }
      if (start > end) { ui.toast('Tanggal mulai tidak boleh melebihi tanggal akhir.', 'warning'); return; }
      state.reportStart = start;
      state.reportEnd = end;
      renderReports(root);
    });
    root.querySelector('#phReset').addEventListener('click', function () {
      state.reportStart = NS.core.addDaysKey(today(), -29);
      state.reportEnd = today();
      renderReports(root);
    });
    root.querySelector('#phReportExport').addEventListener('click', function () {
      ui.exportCsv('laporan-farmasi-' + data.start + '-sd-' + data.end + '.csv', ['Kode', 'Obat', 'Kategori', 'Satuan', 'Stok Awal', 'Masuk', 'Keluar', 'Stok Akhir', 'Nilai Keluar', 'Status'], data.rows.map(function (row) {
        return [row.medicine.kode, row.medicine.nama, row.medicine.kategori, row.medicine.satuan, Math.max(0, row.medicine.stok - row.incoming + row.outgoing), row.incoming, row.outgoing, row.medicine.stok, row.value, row.status.label];
      }));
    });
    root.querySelector('#phReportPrint').addEventListener('click', function () {
      const content = ui.printLetterhead('LAPORAN PENGGUNAAN OBAT') +
        '<div class="print-doc-meta">' +
          '<div class="print-doc-meta-block"><span>Periode</span><strong>' + ui.esc(ui.fmtDate(data.start, 'medium')) + ' – ' + ui.esc(ui.fmtDate(data.end, 'medium')) + '</strong></div>' +
          '<div class="print-doc-meta-block"><span>Jumlah resep</span><strong>' + ui.number(data.types) + ' resep</strong></div>' +
          '<div class="print-doc-meta-block"><span>Nilai pemakaian</span><strong>' + ui.currency(data.value) + '</strong></div>' +
        '</div>' +
        '<table class="print-table"><thead><tr><th>No</th><th>Obat</th><th>Masuk</th><th>Keluar</th><th>Stok Akhir</th><th>Nilai Keluar</th></tr></thead><tbody>' +
        data.rows.map(function (row, index) {
          return '<tr><td>' + (index + 1) + '</td><td>' + ui.esc(row.medicine.nama) + '</td><td>' + ui.number(row.incoming) + '</td><td>' + ui.number(row.outgoing) + '</td><td>' + ui.number(row.medicine.stok) + '</td><td>' + ui.currency(row.value) + '</td></tr>';
        }).join('') +
        '</tbody><tfoot><tr class="report-total-row"><td colspan="2">Total</td><td>' + ui.number(data.incoming) + '</td><td>' + ui.number(data.outgoing) + '</td><td>—</td><td>' + ui.currency(data.value) + '</td></tr></tfoot></table>' +
        '<div class="print-signatures"><div><span>Petugas Farmasi</span><div class="signature-space"></div><strong>' + ui.esc(store.currentUser().name) + '</strong></div><div><span>Kepala Puskesmas</span><div class="signature-space"></div><strong>' + ui.esc(store.clinic.kepala) + '</strong></div></div>' +
        ui.printFooter();
      ui.printDocument(content, { title: 'Laporan Penggunaan Obat' });
    });
  }

  /* ------------------------------------------------------------------------
     Statistik & kerangka farmasi
     ------------------------------------------------------------------------ */
  function pharmacyStats() {
    const pending = store.pendingPrescriptions();
    const dispensedToday = store.dispensedPrescriptions().filter(function (exam) { return dateKeyOf(exam.dispensedAt) === today(); });
    const alerts = store.stockAlerts();
    const out = alerts.out.length;
    return '<div class="stats-grid stats-grid-compact">' +
      ui.statCard({ label: 'Resep menunggu', value: pending.length, icon: 'pill', tone: 'amber', hint: 'Perlu disiapkan hari ini' }) +
      ui.statCard({ label: 'Diserahkan hari ini', value: dispensedToday.length, icon: 'check-circle', tone: 'green', hint: 'Resep selesai dilayani' }) +
      ui.statCard({ label: 'Stok menipis / habis', value: alerts.low.length + out, icon: 'package', tone: 'rose', hint: out + ' obat stok habis' }) +
      ui.statCard({ label: 'Kedaluwarsa', value: alerts.expired.length + alerts.expiring.length, icon: 'alert', tone: 'blue', hint: alerts.expiring.length + ' segera kedaluwarsa' }) +
    '</div>';
  }

  function render(root, tab) {
    currentRoot = root;
    const allowed = ['resep', 'obat', 'stok', 'laporan'];
    state.tab = allowed.includes(tab) ? tab : (allowed.includes(state.tab) ? state.tab : 'resep');
    if (state.tab === 'obat') renderMedicines(root);
    else if (state.tab === 'stok') renderStock(root);
    else if (state.tab === 'laporan') renderReports(root);
    else renderPrescriptions(root);
  }

  NS.pages = NS.pages || {};
  NS.pages.pharmacy = {
    render: render,
    printPrescription: printPrescription
  };
})(window);
