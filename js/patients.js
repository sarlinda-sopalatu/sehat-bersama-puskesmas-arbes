/* ==========================================================================
   Sehat Bersama - Puskesmas Arbes — Modul pendaftaran & data pasien
   ========================================================================== */
(function (window) {
  'use strict';

  const NS = window.PK;
  const ui = NS.ui;
  const store = NS.store;

  const listState = {
    search: '',
    payer: '',
    gender: '',
    category: 'all',
    page: 1,
    perPage: 8
  };

  function visitsFor(patientId) {
    return store.patientVisits(patientId);
  }

  function lastVisitFor(patientId) {
    const visits = visitsFor(patientId);
    return visits.length ? visits[0] : null;
  }

  function payerBadge(patient) {
    return patient.jenisKepersertaan === 'BPJS'
      ? '<span class="badge badge-info">' + ui.icon('shield') + 'BPJS</span>'
      : '<span class="badge badge-muted">Umum</span>';
  }

  function patientStats(list) {
    const monthStart = ui.startOfMonthKey();
    const visitsThisMonth = store.load().queues.filter(function (queue) {
      return queue.tanggal >= monthStart && queue.status !== 'batal';
    });
    const uniquePatients = new Set(visitsThisMonth.map(function (queue) { return queue.patientId; })).size;
    return [
      { label: 'Total pasien', value: list.length, icon: 'users', tone: 'teal', hint: 'Terdaftar dalam sistem' },
      { label: 'Peserta BPJS', value: list.filter(function (patient) { return patient.jenisKepersertaan === 'BPJS'; }).length, icon: 'shield', tone: 'blue', hint: 'Memiliki nomor kepesertaan' },
      { label: 'Pasien berkunjung', value: uniquePatients, icon: 'activity', tone: 'violet', hint: 'Bulan ' + ui.fmtDate(monthStart, 'month') },
      { label: 'Pasien baru', value: list.filter(function (patient) {
        return patient.createdAt && NS.core.dateKey(new Date(patient.createdAt)) >= NS.core.addDaysKey(NS.core.dateKey(), -30);
      }).length, icon: 'user-plus', tone: 'amber', hint: '30 hari terakhir' }
    ];
  }

  function printCard(patientId) {
    const patient = store.patientById(patientId);
    if (!patient) {
      ui.toast('Data pasien tidak ditemukan.', 'error');
      return;
    }
    const clinic = store.clinic;
    const content = '<div class="print-card-page">' +
      '<div class="patient-card-printed">' +
        '<div class="pcard-pattern" aria-hidden="true"></div>' +
        '<div class="pcard-head">' +
          '<div class="pcard-brand"><span class="pcard-mark">' + ui.brandMark() + '</span><div><strong>' + ui.esc(clinic.nama) + '</strong><small>' + ui.esc(clinic.instansi) + '</small></div></div>' +
          '<div class="pcard-title">KARTU PASIEN<small>Patient Card</small></div>' +
        '</div>' +
        '<div class="pcard-body">' +
          '<div class="pcard-identity">' +
            '<span class="pcard-avatar">' + ui.esc(ui.initials(patient.nama)) + '</span>' +
            '<div class="pcard-name"><span>Nama Pasien</span><h1>' + ui.esc(patient.nama) + '</h1><div class="pcard-tags"><span>' + ui.esc(patient.jenisKepersertaan) + '</span><span>' + (patient.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan') + '</span><span>' + ui.ageLabel(patient.tanggalLahir) + '</span></div></div>' +
          '</div>' +
          '<div class="pcard-details">' +
            '<div><span>Nomor Rekam Medis</span><strong class="pcard-rm">' + ui.esc(patient.noRM) + '</strong></div>' +
            '<div><span>NIK</span><strong>' + ui.esc(ui.groupNik(patient.nik)) + '</strong></div>' +
            '<div><span>Tempat / Tanggal Lahir</span><strong>' + ui.esc(patient.tempatLahir) + ', ' + ui.esc(ui.fmtDate(patient.tanggalLahir, 'medium')) + '</strong></div>' +
            '<div><span>Alamat</span><strong>' + ui.esc(patient.alamat) + '</strong></div>' +
            '<div><span>Nomor BPJS</span><strong>' + ui.esc(patient.noBPJS || '— (Pasien Umum)') + '</strong></div>' +
            '<div><span>Telepon</span><strong>' + ui.esc(patient.noTelepon) + '</strong></div>' +
          '</div>' +
          '<div class="pcard-foot">' +
            '<div class="pcard-contact"><strong>Kontak keluarga</strong><span>' + ui.esc(patient.kontakKeluarga.nama || '—') + (patient.kontakKeluarga.hubungan ? ' · ' + ui.esc(patient.kontakKeluarga.hubungan) : '') + (patient.kontakKeluarga.telepon ? ' · ' + ui.esc(patient.kontakKeluarga.telepon) : '') + '</span></div>' +
            ui.barcode(patient.noRM) +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="pcard-instructions">' +
        '<strong>Simpan kartu ini dengan baik.</strong>' +
        '<span>Tunjukkan kartu pasien atau nomor rekam medis saat mendaftar di ' + ui.esc(clinic.nama) + '. Kartu ini hanya berlaku untuk pasien yang tercatat dalam sistem.</span>' +
      '</div>' +
      '<div class="print-patient-signature"><span>Petugas Pendaftaran</span><div class="signature-line">' + ui.esc(store.currentUser().name) + '</div></div>' +
      '</div>';
    ui.printDocument(content, { title: 'Kartu Pasien — ' + patient.nama, className: 'print-card-sheet' });
  }

  function filteredPatients() {
    let list = store.patients();
    if (listState.search) {
      const query = listState.search.toLowerCase();
      list = list.filter(function (patient) {
        return [patient.nama, patient.nik, patient.noRM, patient.noTelepon, patient.alamat].some(function (value) {
          return String(value || '').toLowerCase().includes(query);
        });
      });
    }
    if (listState.payer) list = list.filter(function (patient) { return patient.jenisKepersertaan === listState.payer; });
    if (listState.gender) list = list.filter(function (patient) { return patient.jenisKelamin === listState.gender; });
    if (listState.category === 'lama') list = list.filter(function (patient) { return visitsFor(patient.id).length > 0; });
    if (listState.category === 'baru') {
      const cutoff = NS.core.addDaysKey(NS.core.dateKey(), -30);
      list = list.filter(function (patient) { return patient.createdAt && NS.core.dateKey(new Date(patient.createdAt)) >= cutoff; });
    }
    list.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    return list;
  }

  function patientRow(patient) {
    const lastVisit = lastVisitFor(patient.id);
    const visits = visitsFor(patient.id).length;
    return '<tr data-patient-row="' + ui.attr(patient.id) + '">' +
      '<td data-label="Pasien"><a href="#/pasien/' + ui.attr(patient.id) + '" class="person-cell">' +
        '<span class="avatar avatar-sm">' + ui.esc(ui.initials(patient.nama)) + '</span>' +
        '<span class="person-copy"><strong>' + ui.esc(patient.nama) + '</strong><small>' + ui.esc(patient.noRM) + '</small></span>' +
      '</a></td>' +
      '<td data-label="NIK"><span class="mono small">' + ui.esc(ui.groupNik(patient.nik)) + '</span></td>' +
      '<td data-label="Umur / JK"><strong>' + ui.esc(ui.ageLabel(patient.tanggalLahir)) + '</strong><small class="table-sub">' + (patient.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan') + '</small></td>' +
      '<td data-label="Kepesertaan">' + payerBadge(patient) + '</td>' +
      '<td data-label="Kunjungan">' + (lastVisit ? '<strong>' + ui.esc(ui.relativeDay(lastVisit.queue.tanggal)) + '</strong><small class="table-sub">' + visits + ' total kunjungan</small>' : '<span class="muted">Belum pernah</span>') + '</td>' +
      '<td data-label="Aksi"><div class="table-actions">' +
        '<a class="icon-btn icon-btn-sm" href="#/pasien/' + ui.attr(patient.id) + '" title="Lihat detail" aria-label="Lihat detail ' + ui.attr(patient.nama) + '">' + ui.icon('eye') + '</a>' +
        (store.can('patient.manage') ? '<a class="icon-btn icon-btn-sm" href="#/pasien/' + ui.attr(patient.id) + '/edit" title="Ubah data" aria-label="Ubah data ' + ui.attr(patient.nama) + '">' + ui.icon('edit') + '</a>' : '') +
        '<button type="button" class="icon-btn icon-btn-sm" data-patient-action="print" data-id="' + ui.attr(patient.id) + '" title="Cetak kartu" aria-label="Cetak kartu ' + ui.attr(patient.nama) + '">' + ui.icon('printer') + '</button>' +
        (store.can('queue.manage') ? '<button type="button" class="icon-btn icon-btn-sm accent" data-patient-action="queue" data-id="' + ui.attr(patient.id) + '" title="Ambil antrean" aria-label="Ambil antrean ' + ui.attr(patient.nama) + '">' + ui.icon('queue') + '</button>' : '') +
      '</div></td>' +
    '</tr>';
  }

  function renderList(root) {
    const all = store.patients();
    const list = filteredPatients();
    const totalPages = Math.max(1, Math.ceil(list.length / listState.perPage));
    if (listState.page > totalPages) listState.page = totalPages;
    const start = (listState.page - 1) * listState.perPage;
    const pageRows = list.slice(start, start + listState.perPage);
    const activeCount = store.load().queues.filter(function (queue) {
      return queue.tanggal === NS.core.dateKey() && queue.status === 'menunggu';
    }).length;

    root.innerHTML = ui.pageHeader({
      eyebrow: 'Pendaftaran & Rekam Medis',
      title: 'Data Pasien',
      description: 'Cari, daftarkan, dan kelola identitas pasien dalam satu direktori terpadu.',
      actions: (store.can('patient.manage') ? '<a href="#/pasien/baru" class="btn btn-primary">' + ui.icon('user-plus') + 'Pasien Baru</a>' : '') +
        (store.can('queue.manage') ? '<a href="#/antrean" class="btn btn-secondary">' + ui.icon('queue') + 'Buka Antrean</a>' : '')
    }) +
    '<div class="stats-grid stats-grid-compact">' + patientStats(all).map(function (stat) { return ui.statCard(stat); }).join('') + '</div>' +
    '<section class="card patients-directory">' +
      '<div class="directory-toolbar">' +
        ui.pageTabs([
          { id: 'all', label: 'Semua pasien', count: all.length },
          { id: 'lama', label: 'Pasien lama' },
          { id: 'baru', label: 'Baru (30 hari)' }
        ], listState.category) +
        '<div class="directory-actions">' +
          (activeCount ? '<span class="soft-chip">' + ui.icon('queue') + activeCount + ' menunggu</span>' : '') +
          ui.pageSizeSelect(listState.perPage, 'patientPageSize') +
        '</div>' +
      '</div>' +
      '<div class="filter-bar">' +
        '<div class="search-field">' + ui.icon('search') + '<input type="search" id="patientSearch" class="input" placeholder="Cari nama, NIK, nomor RM, atau telepon…" value="' + ui.attr(listState.search) + '" aria-label="Cari pasien">' +
          (listState.search ? '<button type="button" class="search-clear" data-clear-search aria-label="Hapus pencarian">' + ui.icon('x') + '</button>' : '') +
        '</div>' +
        '<select id="patientPayer" class="input input-auto" aria-label="Filter kepesertaan">' + ui.options([{ value: 'BPJS', label: 'Peserta BPJS' }, { value: 'Umum', label: 'Pasien Umum' }], listState.payer, 'Semua kepesertaan') + '</select>' +
        '<select id="patientGender" class="input input-auto" aria-label="Filter jenis kelamin">' + ui.options([{ value: 'L', label: 'Laki-laki' }, { value: 'P', label: 'Perempuan' }], listState.gender, 'Semua jenis kelamin') + '</select>' +
        '<button type="button" class="btn btn-secondary btn-sm" id="resetPatientFilter">' + ui.icon('refresh') + 'Reset</button>' +
      '</div>' +
      '<div class="table-responsive">' +
        (pageRows.length ? '<table class="data-table"><thead><tr><th>Pasien</th><th>NIK</th><th>Umur / JK</th><th>Kepesertaan</th><th>Kunjungan terakhir</th><th class="th-actions">Aksi</th></tr></thead><tbody>' +
          pageRows.map(patientRow).join('') + '</tbody></table>' :
          ui.emptyState('search', 'Pasien tidak ditemukan', 'Coba ubah kata kunci atau filter yang digunakan.', '<button type="button" class="btn btn-secondary btn-sm" id="emptyResetPatients">Reset filter</button>')) +
      '</div>' +
      (list.length ? ui.pagination(list.length, listState.page, listState.perPage) : '') +
    '</section>' +
    '<div class="info-strip">' +
      '<span class="info-strip-icon">' + ui.icon('shield') + '</span>' +
      '<div><strong>Privasi data pasien</strong><p>Hanya gunakan data pasien untuk keperluan pelayanan. Setiap perubahan data tercatat dalam jejak audit sistem.</p></div>' +
    '</div>';

    const searchInput = root.querySelector('#patientSearch');
    searchInput.addEventListener('input', ui.debounce(function () {
      listState.search = searchInput.value;
      listState.page = 1;
      renderList(root);
    }, 220));
    const clearButton = root.querySelector('[data-clear-search]');
    if (clearButton) clearButton.addEventListener('click', function () { listState.search = ''; listState.page = 1; renderList(root); });
    root.querySelector('#patientPayer').addEventListener('change', function (event) { listState.payer = event.target.value; listState.page = 1; renderList(root); });
    root.querySelector('#patientGender').addEventListener('change', function (event) { listState.gender = event.target.value; listState.page = 1; renderList(root); });
    root.querySelector('#patientPageSize').addEventListener('change', function (event) { listState.perPage = Number(event.target.value); listState.page = 1; renderList(root); });
    root.querySelectorAll('.tabs .tab[data-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () { listState.category = tab.dataset.tab; listState.page = 1; renderList(root); });
    });
    root.querySelector('#resetPatientFilter').addEventListener('click', function () {
      listState.search = '';
      listState.payer = '';
      listState.gender = '';
      listState.category = 'all';
      listState.page = 1;
      renderList(root);
    });
    const emptyReset = root.querySelector('#emptyResetPatients');
    if (emptyReset) emptyReset.addEventListener('click', function () {
      listState.search = '';
      listState.payer = '';
      listState.gender = '';
      listState.category = 'all';
      listState.page = 1;
      renderList(root);
    });
    root.querySelectorAll('[data-page]').forEach(function (button) {
      button.addEventListener('click', function () {
        listState.page = Number(button.dataset.page) || 1;
        renderList(root);
        root.querySelector('.patients-directory')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    root.querySelectorAll('[data-patient-action]').forEach(function (button) {
      button.addEventListener('click', function () {
        const id = button.dataset.id;
        if (button.dataset.patientAction === 'print') {
          printCard(id);
        } else if (button.dataset.patientAction === 'queue') {
          if (NS.pages.queues && typeof NS.pages.queues.openNewQueueModal === 'function') {
            NS.pages.queues.openNewQueueModal(id);
          }
        }
      });
    });
  }

  function patientPayloadFromForm(form) {
    const values = ui.readForm(form);
    return {
      nik: values.nik,
      nama: values.nama,
      tempatLahir: values.tempatLahir,
      tanggalLahir: values.tanggalLahir,
      jenisKelamin: values.jenisKelamin,
      alamat: values.alamat,
      noTelepon: values.noTelepon,
      jenisKepersertaan: values.jenisKepersertaan,
      noBPJS: values.noBPJS || '',
      kontakKeluarga: {
        nama: values.kontakNama || '',
        hubungan: values.kontakHubungan || '',
        telepon: values.kontakTelepon || ''
      }
    };
  }

  function setupPatientForm(root, patient) {
    const form = root.querySelector('#patientForm');
    if (!form) return;
    const nikInput = form.querySelector('#nik');
    const nikFeedback = form.querySelector('#nikFeedback');
    const payerSelect = form.querySelector('#jenisKepersertaan');
    const bpjsGroup = form.querySelector('#bpjsGroup');
    const bpjsInput = form.querySelector('#noBPJS');
    const birthInput = form.querySelector('#tanggalLahir');
    const agePreview = form.querySelector('#agePreview');
    const nameInput = form.querySelector('#nama');
    const previewName = root.querySelector('#previewName');
    const previewAvatar = root.querySelector('#previewAvatar');
    const previewPayer = root.querySelector('#previewPayer');
    const existingPatients = store.patients();

    form.querySelectorAll('input[name="jenisKelamin"]').forEach(function (radio) {
      radio.addEventListener('change', updatePreview);
    });
    function updatePreview() {
      const name = nameInput.value.trim() || 'Nama Pasien';
      if (previewName) previewName.textContent = name;
      if (previewAvatar) previewAvatar.textContent = ui.initials(name);
      const selectedGender = form.querySelector('input[name="jenisKelamin"]:checked');
      const genderLabel = selectedGender ? (selectedGender.value === 'L' ? 'Laki-laki' : 'Perempuan') : 'Jenis kelamin';
      if (previewPayer) previewPayer.textContent = (payerSelect.value || 'Umum') + ' · ' + genderLabel;
    }
    nameInput.addEventListener('input', updatePreview);
    payerSelect.addEventListener('change', function () {
      const isBPJS = payerSelect.value === 'BPJS';
      bpjsGroup.hidden = !isBPJS;
      bpjsInput.required = isBPJS;
      if (!isBPJS) bpjsInput.value = '';
      updatePreview();
    });
    function updateBpjsVisibility() {
      const isBPJS = payerSelect.value === 'BPJS';
      bpjsGroup.hidden = !isBPJS;
      bpjsInput.required = isBPJS;
    }
    updateBpjsVisibility();

    function validateNik() {
      const digits = nikInput.value.replace(/\D/g, '').slice(0, 16);
      nikInput.value = digits;
      if (!digits) {
        nikFeedback.className = 'field-feedback';
        nikFeedback.textContent = 'NIK terdiri dari 16 digit angka.';
        return false;
      }
      if (digits.length !== 16) {
        nikFeedback.className = 'field-feedback is-error';
        nikFeedback.textContent = 'NIK baru ' + digits.length + ' dari 16 digit.';
        return false;
      }
      const duplicate = existingPatients.find(function (item) { return item.nik === digits && item.id !== (patient ? patient.id : ''); });
      if (duplicate) {
        nikFeedback.className = 'field-feedback is-error';
        nikFeedback.textContent = 'NIK sudah digunakan oleh ' + duplicate.nama + ' (' + duplicate.noRM + ').';
        return false;
      }
      nikFeedback.className = 'field-feedback is-success';
      nikFeedback.innerHTML = ui.icon('check-circle') + 'NIK valid dan belum terdaftar.';
      return true;
    }
    nikInput.addEventListener('input', validateNik);
    if (patient) validateNik();

    function updateAge() {
      if (!birthInput.value) {
        agePreview.textContent = '';
        return;
      }
      const birth = ui.asDate(birthInput.value);
      if (Number.isNaN(birth.getTime()) || birth > new Date()) {
        agePreview.textContent = 'Tanggal lahir tidak valid.';
        agePreview.className = 'field-feedback is-error';
        return;
      }
      agePreview.className = 'field-feedback';
      agePreview.textContent = 'Usia saat ini: ' + ui.ageLabel(birthInput.value) + '.';
    }
    birthInput.addEventListener('change', updateAge);
    updateAge();
    updatePreview();

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      document.querySelectorAll('.form-error-host').forEach(function (host) { host.innerHTML = ''; });
      validateBpjsVisibility();
      if (!validateNik()) {
        nikInput.focus();
        return;
      }
      const button = form.querySelector('[type="submit"]');
      ui.setSubmitting(button, true, 'Menyimpan…');
      try {
        const payload = patientPayloadFromForm(form);
        if (patient) {
          store.updatePatient(patient.id, payload);
          ui.toast('Data pasien ' + payload.nama + ' berhasil diperbarui.', 'success');
          location.hash = '#/pasien/' + patient.id;
        } else {
          const created = store.createPatient(payload);
          ui.toast('Pasien baru ' + created.nama + ' terdaftar dengan nomor ' + created.noRM + '.', 'success', 'Pendaftaran berhasil');
          location.hash = '#/pasien/' + created.id;
        }
      } catch (error) {
        ui.setSubmitting(button, false);
        const host = form.querySelector('.form-error-host') || form;
        host.innerHTML = ui.formError(error.message);
        host.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  function patientFormMarkup(patient, options) {
    const isEdit = Boolean(patient);
    const nextRM = isEdit ? patient.noRM : store.nextRM();
    const birthMax = NS.core.dateKey();
    return '<div class="form-page-grid">' +
      '<form id="patientForm" class="form-main" novalidate>' +
        '<div class="form-error-host"></div>' +
        '<section class="card form-card">' +
          ui.sectionHeader('Identitas pasien', 'Data pokok sesuai dokumen identitas resmi.', '', 'user') +
          '<div class="form-section-body">' +
            '<div class="field full">' +
              '<label for="nik">NIK <span class="required">*</span> <span class="label-note">Nomor Induk Kependudukan</span></label>' +
              '<input id="nik" name="nik" class="input mono" inputmode="numeric" autocomplete="off" maxlength="16" placeholder="16 digit angka" value="' + ui.attr(isEdit ? patient.nik : '') + '" required>' +
              '<div id="nikFeedback" class="field-feedback">NIK terdiri dari 16 digit angka.</div>' +
            '</div>' +
            '<div class="field full">' +
              '<label for="nama">Nama lengkap <span class="required">*</span></label>' +
              '<input id="nama" name="nama" class="input" placeholder="Sesuai kartu identitas" value="' + ui.attr(isEdit ? patient.nama : '') + '" minlength="3" required>' +
            '</div>' +
            '<div class="field">' +
              '<label for="tempatLahir">Tempat lahir <span class="required">*</span></label>' +
              '<input id="tempatLahir" name="tempatLahir" class="input" placeholder="Kota / kabupaten" value="' + ui.attr(isEdit ? patient.tempatLahir : '') + '" required>' +
            '</div>' +
            '<div class="field">' +
              '<label for="tanggalLahir">Tanggal lahir <span class="required">*</span></label>' +
              '<input id="tanggalLahir" name="tanggalLahir" type="date" class="input" max="' + birthMax + '" value="' + ui.attr(isEdit ? patient.tanggalLahir : '') + '" required>' +
              '<div id="agePreview" class="field-feedback"></div>' +
            '</div>' +
            '<div class="field full">' +
              '<label>Jenis kelamin <span class="required">*</span></label>' +
              '<div class="radio-cards two">' +
                '<label class="radio-card"><input type="radio" name="jenisKelamin" value="L"' + (isEdit && patient.jenisKelamin === 'L' ? ' checked' : '') + ' required><span>' + ui.icon('user') + '<strong>Laki-laki</strong></span></label>' +
                '<label class="radio-card"><input type="radio" name="jenisKelamin" value="P"' + (isEdit && patient.jenisKelamin === 'P' ? ' checked' : '') + ' required><span>' + ui.icon('user') + '<strong>Perempuan</strong></span></label>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</section>' +
        '<section class="card form-card">' +
          ui.sectionHeader('Kontak & alamat', 'Informasi ini membantu petugas menghubungi pasien bila diperlukan.', '', 'map-pin') +
          '<div class="form-section-body">' +
            '<div class="field full">' +
              '<label for="alamat">Alamat lengkap <span class="required">*</span></label>' +
              '<textarea id="alamat" name="alamat" class="input textarea" rows="3" placeholder="Jalan, nomor rumah, RT/RW, kelurahan, kecamatan" required>' + ui.esc(isEdit ? patient.alamat : '') + '</textarea>' +
            '</div>' +
            '<div class="field">' +
              '<label for="noTelepon">Nomor telepon <span class="required">*</span></label>' +
              '<input id="noTelepon" name="noTelepon" class="input" inputmode="tel" placeholder="08xxxxxxxxxx" value="' + ui.attr(isEdit ? patient.noTelepon : '') + '" required>' +
            '</div>' +
            '<div class="field">' +
              '<label for="jenisKepersertaan">Jenis kepesertaan <span class="required">*</span></label>' +
              '<select id="jenisKepersertaan" name="jenisKepersertaan" class="input" required>' +
                '<option value="Umum"' + (isEdit && patient.jenisKepersertaan === 'Umum' ? ' selected' : '') + '>Umum / Mandiri</option>' +
                '<option value="BPJS"' + (isEdit && patient.jenisKepersertaan === 'BPJS' ? ' selected' : '') + '>BPJS Kesehatan</option>' +
              '</select>' +
            '</div>' +
            '<div class="field full" id="bpjsGroup">' +
              '<label for="noBPJS">Nomor kartu BPJS <span class="required">*</span></label>' +
              '<input id="noBPJS" name="noBPJS" class="input mono" inputmode="numeric" maxlength="13" placeholder="13 digit nomor kartu BPJS" value="' + ui.attr(isEdit ? patient.noBPJS : '') + '">' +
              '<div class="field-feedback">Pastikan nomor BPJS sesuai kartu. Nomor akan diverifikasi petugas kasir saat penjaminan.</div>' +
            '</div>' +
          '</div>' +
        '</section>' +
        '<section class="card form-card">' +
          ui.sectionHeader('Kontak keluarga', 'Opsional — diisi jika pasien memerlukan pendamping atau kondisi darurat.', '', 'phone') +
          '<div class="form-section-body">' +
            '<div class="field">' +
              '<label for="kontakNama">Nama kontak keluarga</label>' +
              '<input id="kontakNama" name="kontakNama" class="input" placeholder="Nama lengkap kontak" value="' + ui.attr(isEdit ? patient.kontakKeluarga.nama : '') + '">' +
            '</div>' +
            '<div class="field">' +
              '<label for="kontakHubungan">Hubungan</label>' +
              '<input id="kontakHubungan" name="kontakHubungan" class="input" placeholder="Contoh: Istri, Anak, Ayah" value="' + ui.attr(isEdit ? patient.kontakKeluarga.hubungan : '') + '">' +
            '</div>' +
            '<div class="field full">' +
              '<label for="kontakTelepon">Nomor telepon keluarga</label>' +
              '<input id="kontakTelepon" name="kontakTelepon" class="input" inputmode="tel" placeholder="08xxxxxxxxxx" value="' + ui.attr(isEdit ? patient.kontakKeluarga.telepon : '') + '">' +
            '</div>' +
          '</div>' +
        '</section>' +
        '<div class="form-actions">' +
          '<a href="' + (isEdit ? '#/pasien/' + ui.attr(patient.id) : '#/pasien') + '" class="btn btn-secondary">Batal</a>' +
          '<button type="submit" class="btn btn-primary">' + ui.icon(isEdit ? 'check' : 'user-plus') + (isEdit ? 'Simpan Perubahan' : 'Daftarkan Pasien') + '</button>' +
        '</div>' +
      '</form>' +
      '<aside class="form-aside">' +
        '<section class="card preview-card">' +
          '<span class="preview-label">Pratinjau kartu pasien</span>' +
          '<div class="patient-preview">' +
            '<span id="previewAvatar" class="avatar avatar-lg">' + ui.esc(ui.initials(isEdit ? patient.nama : 'Nama Pasien')) + '</span>' +
            '<div><strong id="previewName">' + ui.esc(isEdit ? patient.nama : 'Nama Pasien') + '</strong><small id="previewPayer">' + (isEdit ? patient.jenisKepersertaan + ' · ' + (patient.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan') : 'Umum · Jenis kelamin') + '</small></div>' +
          '</div>' +
          '<div class="preview-rm"><span>Nomor rekam medis</span><strong>' + ui.esc(nextRM) + '</strong></div>' +
          '<div class="preview-note">' + ui.icon('info') + '<span>' + (isEdit ? 'Nomor rekam medis tidak dapat diubah.' : 'Nomor rekam medis dibuat otomatis oleh sistem saat pasien disimpan.') + '</span></div>' +
        '</section>' +
        '<section class="card guideline-card">' +
          '<h3>' + ui.icon('shield') + 'Standar pendaftaran</h3>' +
          '<ul>' +
            '<li>NIK harus 16 digit dan unik untuk setiap pasien.</li>' +
            '<li>Nama harus sesuai dokumen kependudukan.</li>' +
            '<li>Nomor BPJS wajib diisi untuk peserta BPJS.</li>' +
            '<li>Pastikan nomor telepon aktif untuk pengingat kontrol.</li>' +
          '</ul>' +
        '</section>' +
      '</aside>' +
    '</div>';
  }

  function renderCreate(root) {
    if (!store.can('patient.manage')) {
      root.innerHTML = ui.emptyState('lock', 'Akses terbatas', 'Peran Anda tidak memiliki izin untuk mendaftarkan pasien baru.');
      return;
    }
    root.innerHTML = ui.pageHeader({
      eyebrow: 'Pendaftaran',
      title: 'Daftarkan Pasien Baru',
      description: 'Lengkapi identitas pasien. Nomor rekam medis akan dibuat otomatis.',
      actions: '<a href="#/pasien" class="btn btn-secondary">' + ui.icon('arrow-left') + 'Kembali</a>'
    }) + patientFormMarkup(null, { mode: 'create' });
    setupPatientForm(root, null);
  }

  function renderEdit(root, id) {
    const patient = store.patientById(id);
    if (!patient) {
      root.innerHTML = ui.emptyState('search', 'Pasien tidak ditemukan', 'Data pasien yang Anda cari tidak tersedia.', '<a href="#/pasien" class="btn btn-secondary">Kembali ke data pasien</a>');
      return;
    }
    if (!store.can('patient.manage')) {
      root.innerHTML = ui.emptyState('lock', 'Akses terbatas', 'Peran Anda tidak memiliki izin mengubah data pasien.', '<a href="#/pasien/' + ui.attr(id) + '" class="btn btn-secondary">Lihat detail pasien</a>');
      return;
    }
    root.innerHTML = ui.pageHeader({
      eyebrow: 'Pendaftaran',
      title: 'Ubah Data Pasien',
      description: 'Perbarui data ' + patient.nama + ' · ' + patient.noRM + '.',
      actions: '<a href="#/pasien/' + ui.attr(patient.id) + '" class="btn btn-secondary">' + ui.icon('arrow-left') + 'Kembali</a>'
    }) + patientFormMarkup(patient, { mode: 'edit' });
    setupPatientForm(root, patient);
  }

  function summaryRow(label, value) {
    return '<div class="detail-row"><dt>' + ui.esc(label) + '</dt><dd>' + value + '</dd></div>';
  }

  function renderDetail(root, id) {
    const patient = store.patientById(id);
    if (!patient) {
      root.innerHTML = ui.emptyState('search', 'Pasien tidak ditemukan', 'Data pasien yang Anda cari tidak tersedia.', '<a href="#/pasien" class="btn btn-secondary">Kembali ke data pasien</a>');
      return;
    }
    const visits = visitsFor(id);
    const completedVisits = visits.filter(function (visit) { return visit.exam && visit.exam.status === 'selesai'; });
    const lastExamVisit = completedVisits.find(function (visit) { return visit.exam; });
    const monthStart = ui.startOfMonthKey();
    const visitsThisMonth = visits.filter(function (visit) { return visit.queue.tanggal >= monthStart && visit.queue.status !== 'batal'; }).length;
    const lastVisit = visits.length ? visits[0].queue.tanggal : null;
    const canPrint = true;
    const latestExam = lastExamVisit ? lastExamVisit.exam : null;
    const latestBill = lastExamVisit ? lastExamVisit.bill : null;
    const canOpenExam = store.hasAccess('examinations');
    const canOpenBill = store.hasAccess('billing');

    root.innerHTML = ui.pageHeader({
      eyebrow: 'Direktori Pasien',
      title: 'Detail Pasien',
      description: 'Rekam identitas dan riwayat pelayanan pasien.',
      actions: '<a href="#/pasien" class="btn btn-ghost">' + ui.icon('arrow-left') + 'Kembali</a>' +
        (store.can('patient.manage') ? '<a href="#/pasien/' + ui.attr(id) + '/edit" class="btn btn-secondary">' + ui.icon('edit') + 'Ubah Data</a>' : '') +
        (store.can('queue.manage') ? '<button type="button" class="btn btn-secondary" id="detailQueueBtn">' + ui.icon('queue') + 'Ambil Antrean</button>' : '') +
        (canPrint ? '<button type="button" class="btn btn-primary" id="detailPrintBtn">' + ui.icon('printer') + 'Cetak Kartu</button>' : '')
    }) +
    '<section class="patient-hero card">' +
      '<div class="patient-hero-main">' +
        '<span class="avatar avatar-xl">' + ui.esc(ui.initials(patient.nama)) + '</span>' +
        '<div class="patient-hero-copy">' +
          '<div class="hero-title-row"><h2>' + ui.esc(patient.nama) + '</h2>' + payerBadge(patient) + '</div>' +
          '<div class="patient-meta">' +
            '<span>' + ui.icon('file-text') + '<strong>' + ui.esc(patient.noRM) + '</strong></span>' +
            '<span>' + ui.icon('user') + (patient.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan') + ' · ' + ui.ageLabel(patient.tanggalLahir) + '</span>' +
            '<span>' + ui.icon('map-pin') + ui.esc(patient.alamat.split(',')[0]) + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="patient-hero-stats">' +
        '<div><strong>' + visits.length + '</strong><span>Total kunjungan</span></div>' +
        '<div><strong>' + visitsThisMonth + '</strong><span>Bulan ini</span></div>' +
        '<div><strong>' + (lastVisit ? ui.esc(ui.relativeDay(lastVisit)) : '—') + '</strong><span>Kunjungan terakhir</span></div>' +
      '</div>' +
    '</section>' +
    '<div class="detail-grid">' +
      '<div class="detail-main">' +
        '<section class="card">' +
          ui.sectionHeader('Identitas & kontak', 'Data tercatat pada sistem', '', 'user') +
          '<div class="detail-list-grid">' +
            '<dl class="detail-list">' +
              summaryRow('NIK', '<span class="mono">' + ui.esc(ui.groupNik(patient.nik)) + '</span>') +
              summaryRow('Tempat / tanggal lahir', ui.esc(patient.tempatLahir) + ', ' + ui.esc(ui.fmtDate(patient.tanggalLahir))) +
              summaryRow('Jenis kelamin', patient.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan') +
              summaryRow('Jenis kepesertaan', payerBadge(patient)) +
              summaryRow('Nomor BPJS', '<span class="mono">' + (patient.noBPJS ? ui.esc(patient.noBPJS) : '—') + '</span>') +
            '</dl>' +
            '<dl class="detail-list">' +
              summaryRow('Alamat', ui.esc(patient.alamat)) +
              summaryRow('Nomor telepon', '<a href="tel:' + ui.attr(patient.noTelepon) + '" class="text-link">' + ui.esc(patient.noTelepon) + '</a>') +
              summaryRow('Kontak keluarga', patient.kontakKeluarga.nama ? ui.esc(patient.kontakKeluarga.nama) + (patient.kontakKeluarga.hubungan ? ' <span class="muted">· ' + ui.esc(patient.kontakKeluarga.hubungan) + '</span>' : '') : '<span class="muted">—</span>') +
              summaryRow('Telepon keluarga', patient.kontakKeluarga.telepon ? ui.esc(patient.kontakKeluarga.telepon) : '<span class="muted">—</span>') +
              summaryRow('Terdaftar sejak', ui.fmtDate(patient.createdAt, 'medium')) +
            '</dl>' +
          '</div>' +
        '</section>' +
        '<section class="card">' +
          ui.sectionHeader('Riwayat kunjungan', visits.length + ' total kunjungan tercatat', '', 'clock') +
          (visits.length ? '<div class="table-responsive"><table class="data-table"><thead><tr><th>Tanggal</th><th>Antrean / Poli</th><th>Dokter</th><th>Diagnosis</th><th>Tagihan</th><th class="th-actions">Aksi</th></tr></thead><tbody>' +
            visits.slice(0, 10).map(function (visit) {
              const exam = visit.exam;
              const doctor = exam ? store.users().find(function (user) { return user.id === exam.dokterId; }) : null;
              const bill = visit.bill;
              return '<tr>' +
                '<td data-label="Tanggal"><strong>' + ui.esc(ui.fmtDate(visit.queue.tanggal, 'medium')) + '</strong><small class="table-sub">' + ui.esc(ui.fmtTime(visit.queue.createdAt)) + '</small></td>' +
                '<td data-label="Antrean / Poli"><span class="queue-code queue-code-sm">' + ui.esc(visit.queue.kode) + '</span> <span class="small">' + ui.esc(NS.core.getPoli(visit.queue.poli).singkat) + '</span></td>' +
                '<td data-label="Dokter">' + (doctor ? ui.esc(doctor.name) : '<span class="muted">—</span>') + '</td>' +
                '<td data-label="Diagnosis">' + (exam && exam.diagnosis ? '<strong class="small">' + ui.esc(exam.diagnosis) + '</strong>' + (exam.kodeICD10 ? '<small class="table-sub mono">' + ui.esc(exam.kodeICD10) + '</small>' : '') : '<span class="muted">—</span>') + '</td>' +
                '<td data-label="Tagihan">' + (bill ? ui.billBadge(bill.status) + '<small class="table-sub">' + ui.currency(bill.total) + '</small>' : '<span class="muted">—</span>') + '</td>' +
                '<td data-label="Aksi"><div class="table-actions">' +
                  (exam && canOpenExam ? '<a class="icon-btn icon-btn-sm" href="#/pemeriksaan/' + ui.attr(exam.id) + '" title="Lihat rekam medis">' + ui.icon('clipboard') + '</a>' : '') +
                  (bill && canOpenBill ? '<a class="icon-btn icon-btn-sm" href="#/pembayaran/' + ui.attr(bill.id) + '" title="Lihat tagihan">' + ui.icon('receipt') + '</a>' : '') +
                  (!exam && !bill ? '<span class="muted small">—</span>' : '') +
                '</div></td>' +
              '</tr>';
            }).join('') +
          '</tbody></table></div>' + (visits.length > 10 ? '<div class="card-more"><a href="#/antrean" class="text-link">Lihat seluruh riwayat melalui modul antrean ' + ui.icon('arrow-right') + '</a></div>' : '') :
            ui.emptyState('clipboard', 'Belum ada kunjungan', 'Pasien ini belum memiliki riwayat kunjungan di puskesmas.') ) +
        '</section>' +
        (latestExam ? '<section class="card medical-summary">' +
          ui.sectionHeader('Ringkasan pemeriksaan terakhir', ui.fmtDate(latestExam.completedAt || latestExam.tanggal, 'medium') + ' · ' + ui.esc(NS.core.getPoli(latestExam.poli).nama), canOpenExam ? '<a href="#/pemeriksaan/' + ui.attr(latestExam.id) + '" class="text-link">Buka rekam medis ' + ui.icon('arrow-up-right') + '</a>' : '', 'stethoscope') +
          '<div class="medical-summary-grid">' +
            '<div class="clinical-block"><span>Keluhan</span><p>' + ui.esc(latestExam.keluhan || '—') + '</p></div>' +
            '<div class="clinical-block"><span>Diagnosis utama</span><p><strong>' + ui.esc(latestExam.diagnosis || '—') + '</strong>' + (latestExam.kodeICD10 ? ' <span class="mono muted">(' + ui.esc(latestExam.kodeICD10) + ')</span>' : '') + '</p></div>' +
            '<div class="clinical-block"><span>Tanda vital</span><div class="vital-chips">' +
              (latestExam.pemeriksaanFisik.tekananDarah ? '<span>TD <strong>' + ui.esc(latestExam.pemeriksaanFisik.tekananDarah) + '</strong></span>' : '') +
              (latestExam.pemeriksaanFisik.suhu ? '<span>Suhu <strong>' + ui.esc(latestExam.pemeriksaanFisik.suhu) + '</strong></span>' : '') +
              (latestExam.pemeriksaanFisik.nadi ? '<span>Nadi <strong>' + ui.esc(latestExam.pemeriksaanFisik.nadi) + '</strong></span>' : '') +
              (latestExam.pemeriksaanFisik.spo2 ? '<span>SpO₂ <strong>' + ui.esc(latestExam.pemeriksaanFisik.spo2) + '</strong></span>' : '') +
            '</div></div>' +
            '<div class="clinical-block"><span>Resep & kontrol</span><p>' + (latestExam.resep && latestExam.resep.length ? latestExam.resep.map(function (item) { return ui.esc(item.nama) + ' (' + item.jumlah + ' ' + ui.esc(item.satuan) + ')'; }).join(', ') : '<span class="muted">Tidak ada resep</span>') + (latestExam.kontrolUlang ? '<br><small>Kontrol ulang: ' + ui.esc(ui.fmtDate(latestExam.kontrolUlang, 'medium')) + '</small>' : '') + '</p></div>' +
          '</div>' +
          (latestBill ? '<div class="medical-summary-foot"><span>Tagihan terakhir ' + ui.billBadge(latestBill.status) + '</span>' + (canOpenBill ? '<a href="#/pembayaran/' + ui.attr(latestBill.id) + '" class="text-link">Lihat tagihan ' + ui.icon('arrow-right') + '</a>' : '') + '</div>' : '') +
        '</section>' : '') +
      '</div>' +
      '<aside class="detail-aside">' +
        '<section class="card quick-action-card">' +
          '<h3>Aksi pasien</h3>' +
          (store.can('queue.manage') ? '<button type="button" class="quick-action" id="sideQueueBtn"><span class="task-icon task-icon-teal">' + ui.icon('queue') + '</span><span><strong>Ambil antrean</strong><small>Daftarkan kunjungan hari ini</small></span>' + ui.icon('chevron-right') + '</button>' : '') +
          '<button type="button" class="quick-action" id="sidePrintBtn"><span class="task-icon task-icon-blue">' + ui.icon('printer') + '</span><span><strong>Cetak kartu pasien</strong><small>Kartu identitas ber-barcode</small></span>' + ui.icon('chevron-right') + '</button>' +
          (store.can('patient.manage') ? '<a href="#/pasien/' + ui.attr(patient.id) + '/edit" class="quick-action"><span class="task-icon task-icon-violet">' + ui.icon('edit') + '</span><span><strong>Perbarui data</strong><small>Ubah identitas & kontak</small></span>' + ui.icon('chevron-right') + '</a>' : '') +
        '</section>' +
        '<section class="card">' +
          '<h3 class="aside-title">Informasi kunjungan</h3>' +
          '<div class="info-list">' +
            '<div><span>Terakhir berkunjung</span><strong>' + (lastVisit ? ui.fmtDate(lastVisit, 'medium') : 'Belum pernah') + '</strong></div>' +
            '<div><span>Kunjungan selesai</span><strong>' + completedVisits.length + ' kunjungan</strong></div>' +
            '<div><span>Status pasien</span><strong><span class="badge badge-success">Aktif</span></strong></div>' +
            '<div><span>Penjamin</span><strong>' + ui.esc(patient.jenisKepersertaan) + '</strong></div>' +
          '</div>' +
        '</section>' +
        '<section class="card consent-card">' +
          '<span class="consent-icon">' + ui.icon('shield') + '</span>' +
          '<div><h3>Kerahasiaan data</h3><p>Rekam medis bersifat rahasia. Akses hanya untuk kepentingan pelayanan pasien.</p></div>' +
        '</section>' +
      '</aside>' +
    '</div>';

    const printAction = function () { printCard(patient.id); };
    root.querySelector('#detailPrintBtn').addEventListener('click', printAction);
    const sidePrint = root.querySelector('#sidePrintBtn');
    if (sidePrint) sidePrint.addEventListener('click', printAction);
    const queueAction = function () {
      if (NS.pages.queues && typeof NS.pages.queues.openNewQueueModal === 'function') NS.pages.queues.openNewQueueModal(patient.id);
    };
    const detailQueue = root.querySelector('#detailQueueBtn');
    if (detailQueue) detailQueue.addEventListener('click', queueAction);
    const sideQueue = root.querySelector('#sideQueueBtn');
    if (sideQueue) sideQueue.addEventListener('click', queueAction);
  }

  NS.pages = NS.pages || {};
  NS.pages.patients = {
    render: renderList,
    create: renderCreate,
    edit: renderEdit,
    detail: renderDetail,
    printCard: printCard,
    visitsFor: visitsFor
  };
})(window);
