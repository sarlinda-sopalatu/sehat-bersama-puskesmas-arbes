/* ==========================================================================
   Sehat Bersama - Puskesmas Arbes — Modul antrean & display ruang tunggu
   ========================================================================== */
(function (window) {
  'use strict';

  const NS = window.PK;
  const ui = NS.ui;
  const store = NS.store;
  const C = NS.constants;

  const state = {
    date: NS.core.dateKey(),
    poli: '',
    status: 'all',
    search: ''
  };

  let displayAudioEnabled = false;
  let displayLastCalledId = null;

  function patientOf(queue) {
    return store.patientById(queue.patientId);
  }

  function maskName(name) {
    const parts = String(name || 'Pasien').trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return parts[0] + ' ' + parts.slice(1).map(function (part) { return part.charAt(0) + '.'; }).join(' ');
  }

  function timeContext(queue) {
    if (queue.status === 'menunggu') return { primary: '± ' + store.waitingEstimate(queue) + ' menit', secondary: 'Estimasi tunggu' };
    if (queue.status === 'dipanggil') return { primary: ui.fmtTime(queue.calledAt), secondary: 'Waktu dipanggil' };
    if (queue.status === 'dilayani') return { primary: ui.fmtTime(queue.startedAt), secondary: 'Mulai dilayani' };
    if (queue.status === 'selesai') return { primary: ui.fmtTime(queue.finishedAt), secondary: 'Selesai dilayani' };
    if (queue.status === 'batal') return { primary: ui.fmtTime(queue.cancelledAt), secondary: 'Waktu dibatalkan' };
    return { primary: '—', secondary: '' };
  }

  function getBaseQueues() {
    let list = store.queues({ date: state.date, poli: state.poli || undefined });
    if (state.search) {
      const query = state.search.toLowerCase();
      list = list.filter(function (queue) {
        const patient = patientOf(queue);
        return [queue.kode, String(queue.nomor), patient && patient.nama, patient && patient.nik, patient && patient.noRM]
          .some(function (value) { return String(value || '').toLowerCase().includes(query); });
      });
    }
    return list;
  }

  function getFilteredQueues(base) {
    if (state.status === 'all') return base;
    return base.filter(function (queue) { return queue.status === state.status; });
  }

  function statsForDate() {
    const list = store.queues({ date: state.date });
    const waiting = list.filter(function (queue) { return queue.status === 'menunggu'; });
    const active = list.filter(function (queue) { return ['dipanggil', 'dilayani'].includes(queue.status); });
    const done = list.filter(function (queue) { return queue.status === 'selesai'; });
    const cancelled = list.filter(function (queue) { return queue.status === 'batal'; });
    const priority = waiting.filter(function (queue) { return queue.prioritas; });
    return { list: list, waiting: waiting, active: active, done: done, cancelled: cancelled, priority: priority };
  }

  function queueActions(queue, isToday) {
    const actions = [];
    const exam = store.examForQueue(queue.id);
    const canExam = store.can('exam.manage');
    const canVitals = store.can('vitals.manage');
    const canOpenExam = store.hasAccess('examinations');
    if (queue.status === 'menunggu' && isToday && store.can('queue.manage')) {
      actions.push('<button type="button" class="icon-btn icon-btn-sm accent" data-queue-action="call" data-id="' + ui.attr(queue.id) + '" title="Panggil antrean" aria-label="Panggil antrean ' + ui.attr(queue.kode) + '">' + ui.icon('megaphone') + '</button>');
    }
    if (queue.status === 'dipanggil' && isToday && store.can('queue.manage')) {
      actions.push('<button type="button" class="icon-btn icon-btn-sm" data-queue-action="recall" data-id="' + ui.attr(queue.id) + '" title="Panggil ulang" aria-label="Panggil ulang ' + ui.attr(queue.kode) + '">' + ui.icon('volume') + '</button>');
      actions.push('<button type="button" class="icon-btn icon-btn-sm accent" data-queue-action="start" data-id="' + ui.attr(queue.id) + '" title="Mulai layani" aria-label="Mulai layani ' + ui.attr(queue.kode) + '">' + ui.icon('play') + '</button>');
    }
    if (queue.status === 'dilayani') {
      if (exam && canOpenExam) {
        actions.push('<a class="icon-btn icon-btn-sm accent" href="#/pemeriksaan/' + ui.attr(exam.id) + '" title="Buka pemeriksaan" aria-label="Buka pemeriksaan ' + ui.attr(queue.kode) + '">' + ui.icon(canExam ? 'stethoscope' : 'activity') + '</a>');
      } else if (canOpenExam && (canExam || canVitals)) {
        actions.push('<button type="button" class="icon-btn icon-btn-sm accent" data-queue-action="examine" data-id="' + ui.attr(queue.id) + '" title="Mulai asesmen" aria-label="Mulai asesmen ' + ui.attr(queue.kode) + '">' + ui.icon(canExam ? 'stethoscope' : 'activity') + '</button>');
      }
      if (store.can('queue.manage') && !exam) {
        actions.push('<button type="button" class="icon-btn icon-btn-sm" data-queue-action="finish" data-id="' + ui.attr(queue.id) + '" title="Tandai selesai" aria-label="Tandai selesai ' + ui.attr(queue.kode) + '">' + ui.icon('check') + '</button>');
      }
    }
    if (queue.status === 'selesai' && exam && canOpenExam) {
      actions.push('<a class="icon-btn icon-btn-sm" href="#/pemeriksaan/' + ui.attr(exam.id) + '" title="Lihat rekam medis" aria-label="Lihat rekam medis ' + ui.attr(queue.kode) + '">' + ui.icon('clipboard') + '</a>');
    }
    if (['menunggu', 'dipanggil'].includes(queue.status) && isToday) {
      actions.push('<button type="button" class="icon-btn icon-btn-sm" data-queue-action="print" data-id="' + ui.attr(queue.id) + '" title="Cetak tiket antrean" aria-label="Cetak tiket ' + ui.attr(queue.kode) + '">' + ui.icon('printer') + '</button>');
    }
    if (['menunggu', 'dipanggil'].includes(queue.status) && isToday && store.can('queue.cancel')) {
      actions.push('<button type="button" class="icon-btn icon-btn-sm danger" data-queue-action="cancel" data-id="' + ui.attr(queue.id) + '" title="Batalkan antrean" aria-label="Batalkan antrean ' + ui.attr(queue.kode) + '">' + ui.icon('x') + '</button>');
    }
    if (!actions.length) return '<span class="muted small">—</span>';
    return '<div class="table-actions">' + actions.join('') + '</div>';
  }

  function renderQueueRow(queue, isToday) {
    const patient = patientOf(queue);
    const exam = store.examForQueue(queue.id);
    const time = timeContext(queue);
    return '<tr class="' + (queue.prioritas && queue.status === 'menunggu' ? 'row-priority' : '') + '">' +
      '<td data-label="Nomor"><div class="queue-cell"><span class="queue-code ' + (queue.prioritas ? 'is-priority' : '') + '">' + ui.esc(queue.kode) + '</span>' + ui.priorityBadge(queue) + '</div></td>' +
      '<td data-label="Pasien"><a href="#/pasien/' + ui.attr(queue.patientId) + '" class="person-cell"><span class="avatar avatar-xs">' + ui.esc(ui.initials(patient ? patient.nama : 'Pasien')) + '</span><span class="person-copy"><strong>' + ui.esc(patient ? patient.nama : 'Pasien') + '</strong><small>' + ui.esc(patient ? patient.noRM : '—') + ' · ' + ui.esc(patient ? patient.jenisKepersertaan : '') + '</small></span></a></td>' +
      '<td data-label="Poli">' + ui.poliBadge(queue.poli) + '</td>' +
      '<td data-label="Waktu daftar"><strong class="small">' + ui.esc(ui.fmtTime(queue.createdAt)) + '</strong><small class="table-sub">' + ui.esc(ui.fmtDate(queue.tanggal, 'short')) + '</small></td>' +
      '<td data-label="Estimasi">' + (queue.status === 'menunggu' ? '<span class="estimate-pill">' + ui.icon('clock') + ui.esc(time.primary) + '</span>' : '<strong class="small">' + ui.esc(time.primary) + '</strong>') + '<small class="table-sub">' + ui.esc(time.secondary) + '</small></td>' +
      '<td data-label="Status">' + ui.statusBadge(queue.status) + (exam && exam.status === 'draft' && queue.status === 'dilayani' ? '<small class="table-sub">' + (exam.pemeriksaanFisik.tekananDarah || exam.pemeriksaanFisik.suhu ? 'Asesmen awal tersimpan' : 'Menunggu asesmen') + '</small>' : '') + '</td>' +
      '<td data-label="Aksi">' + queueActions(queue, isToday) + '</td>' +
    '</tr>';
  }

  function printTicket(queueId) {
    const queue = store.queueById(queueId);
    if (!queue) return;
    const patient = patientOf(queue);
    const poli = NS.core.getPoli(queue.poli);
    const content = '<div class="queue-ticket-page">' +
      ui.printLetterhead('TIKET ANTREAN PASIEN') +
      '<div class="queue-ticket">' +
        '<div class="ticket-number-label">Nomor Antrean Anda</div>' +
        '<div class="ticket-number">' + ui.esc(queue.kode) + '</div>' +
        '<div class="ticket-poli">' + ui.esc(poli.nama) + '</div>' +
        '<div class="ticket-details">' +
          '<div><span>Nama Pasien</span><strong>' + ui.esc(patient ? patient.nama : '—') + '</strong></div>' +
          '<div><span>No. Rekam Medis</span><strong>' + ui.esc(patient ? patient.noRM : '—') + '</strong></div>' +
          '<div><span>Tanggal</span><strong>' + ui.esc(ui.fmtDate(queue.tanggal, 'full')) + '</strong></div>' +
          '<div><span>Estimasi Menunggu</span><strong>± ' + store.waitingEstimate(queue) + ' menit</strong></div>' +
        '</div>' +
        '<div class="ticket-note">' + ui.icon('info') + 'Mohon menunggu hingga nomor antrean Anda dipanggil.</div>' +
        '<div class="ticket-foot"><span>Dicetak ' + ui.fmtTime(new Date().toISOString()) + '</span>' + ui.barcode(queue.kode) + '</div>' +
      '</div>' +
      '<div class="ticket-bottom-note">Simpan tiket ini dan tunjukkan kepada petugas jika diperlukan.</div>' +
    '</div>';
    ui.printDocument(content, { title: 'Tiket Antrean ' + queue.kode, className: 'print-ticket-sheet' });
  }

  function announceQueue(queue, silentIfUnsupported) {
    if (!queue || !('speechSynthesis' in window)) {
      if (!silentIfUnsupported) ui.toast('Browser tidak mendukung panggilan suara otomatis.', 'info');
      return;
    }
    const poli = NS.core.getPoli(queue.poli);
    const message = 'Nomor antrean ' + String(queue.kode).replace('-', ' ') + '. Silakan menuju ' + poli.nama + '.';
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = 'id-ID';
      utterance.rate = 0.86;
      utterance.pitch = 1;
      utterance.volume = 0.9;
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(function (item) { return /id[-_]ID/i.test(item.lang); });
      if (voice) utterance.voice = voice;
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      if (!silentIfUnsupported) ui.toast('Panggilan suara tidak dapat dijalankan.', 'warning');
    }
  }

  function openCancelModal(queueId) {
    const queue = store.queueById(queueId);
    if (!queue) return;
    const patient = patientOf(queue);
    ui.modal({
      title: 'Batalkan antrean',
      subtitle: queue.kode + ' · ' + (patient ? patient.nama : 'Pasien'),
      icon: 'alert-circle',
      size: 'sm',
      content: '<form id="cancelQueueForm">' +
        '<div class="field">' +
          '<label for="cancelReason">Alasan pembatalan <span class="required">*</span></label>' +
          '<select id="cancelReason" name="reason" class="input" required>' +
            '<option value="">Pilih alasan…</option>' +
            '<option>Pasien tidak hadir saat dipanggil</option>' +
            '<option>Pasien pulang sebelum dipanggil</option>' +
            '<option>Permintaan pasien</option>' +
            '<option>Salah pilih poli / pendaftaran ganda</option>' +
            '<option>Kondisi darurat dirujuk langsung</option>' +
            '<option>Lainnya</option>' +
          '</select>' +
        '</div>' +
        '<div class="field">' +
          '<label for="cancelNote">Catatan tambahan <span class="label-note">opsional</span></label>' +
          '<textarea id="cancelNote" name="note" class="input textarea" rows="3" placeholder="Tuliskan keterangan tambahan…"></textarea>' +
        '</div>' +
        '<div class="form-error-host"></div>' +
      '</form>',
      footer: '<button type="button" class="btn btn-secondary" data-modal-close>Kembali</button><button type="submit" form="cancelQueueForm" class="btn btn-danger">Batalkan Antrean</button>',
      onMount: function (layer) {
        layer.querySelectorAll('[data-modal-close]').forEach(function (button) { button.addEventListener('click', ui.closeModal); });
        const form = layer.querySelector('#cancelQueueForm');
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          const reason = form.querySelector('[name="reason"]').value;
          const note = form.querySelector('[name="note"]').value.trim();
          try {
            store.cancelQueue(queue.id, reason + (note ? ' — ' + note : ''));
            ui.closeModal();
            ui.toast('Antrean ' + queue.kode + ' telah dibatalkan.', 'success');
            rerenderCurrent();
          } catch (error) {
            form.querySelector('.form-error-host').innerHTML = ui.formError(error.message);
          }
        });
      }
    });
  }

  function rerenderCurrent() {
    const path = location.hash.replace(/^#/, '').split('?')[0] || '/dashboard';
    const main = document.getElementById('mainContent');
    if (path === '/antrean' && main) {
      render(main);
    } else if (path === '/display' && window.PK.renderDisplay) {
      window.PK.renderDisplay();
    }
  }

  function openNewQueueModal(prefillPatientId) {
    if (!store.can('queue.manage')) {
      ui.toast('Peran Anda tidak memiliki akses membuat antrean.', 'error');
      return;
    }
    const patients = store.patients().slice().sort(function (a, b) { return a.nama.localeCompare(b.nama, 'id'); });
    const prefill = prefillPatientId ? store.patientById(prefillPatientId) : null;
    const today = NS.core.dateKey();
    ui.modal({
      title: 'Daftarkan antrean baru',
      subtitle: 'Nomor antrean dibuat otomatis untuk hari ini.',
      icon: 'queue',
      size: 'md',
      content: '<form id="newQueueForm">' +
        '<div class="form-error-host"></div>' +
        '<div class="field">' +
          '<label for="queuePatient">Pasien <span class="required">*</span></label>' +
          '<select id="queuePatient" name="patientId" class="input" required>' + ui.options(patients.map(function (patient) {
            return { value: patient.id, label: patient.nama + ' · ' + patient.noRM + ' · NIK ' + patient.nik };
          }), prefill ? prefill.id : '', 'Pilih pasien…') + '</select>' +
          '<div class="field-feedback">Cari pasien berdasarkan nama pada daftar. Data pasien harus terdaftar terlebih dahulu.</div>' +
        '</div>' +
        '<div id="queuePatientSummary" class="patient-inline-summary" hidden></div>' +
        '<div class="form-grid-2">' +
          '<div class="field">' +
            '<label for="queuePoli">Poli tujuan <span class="required">*</span></label>' +
            '<select id="queuePoli" name="poli" class="input" required>' + C.POLI.map(function (poli) {
              return '<option value="' + ui.attr(poli.id) + '"' + (poli.id === 'umum' ? ' selected' : '') + '>' + ui.esc(poli.nama) + '</option>';
            }).join('') + '</select>' +
          '</div>' +
          '<div class="field">' +
            '<label>Nomor antrean berikutnya</label>' +
            '<div class="next-number-box" id="nextQueueNumber">—</div>' +
            '<div class="field-feedback" id="queueEstimate"></div>' +
          '</div>' +
        '</div>' +
        '<label class="check-card" for="queuePriority">' +
          '<input type="checkbox" id="queuePriority" name="prioritas" value="1">' +
          '<span class="check-card-icon">' + ui.icon('sparkles') + '</span>' +
          '<span class="check-card-copy"><strong>Antrean prioritas</strong><small>Untuk lansia, ibu hamil, disabilitas, balita, atau kondisi darurat.</small></span>' +
          '<span class="switch" aria-hidden="true"></span>' +
        '</label>' +
        '<div class="field priority-reason" id="priorityReasonGroup" hidden>' +
          '<label for="queuePriorityReason">Alasan prioritas <span class="required">*</span></label>' +
          '<select id="queuePriorityReason" name="alasanPrioritas" class="input">' + ui.options(C.PRIORITY_REASONS, '', 'Pilih alasan prioritas…') + '</select>' +
        '</div>' +
        '<div class="inline-alert inline-alert-info">' + ui.icon('info') + '<span>Antrean prioritas akan dipanggil lebih dahulu tanpa menghilangkan urutan antrean reguler.</span></div>' +
      '</form>',
      footer: '<button type="button" class="btn btn-secondary" data-modal-close>Batal</button><button type="submit" form="newQueueForm" class="btn btn-primary">' + ui.icon('queue') + 'Buat Antrean</button>',
      onMount: function (layer) {
        layer.querySelectorAll('[data-modal-close]').forEach(function (button) { button.addEventListener('click', ui.closeModal); });
        const form = layer.querySelector('#newQueueForm');
        const patientSelect = layer.querySelector('#queuePatient');
        const poliSelect = layer.querySelector('#queuePoli');
        const summary = layer.querySelector('#queuePatientSummary');
        const nextNumber = layer.querySelector('#nextQueueNumber');
        const estimate = layer.querySelector('#queueEstimate');
        const priority = layer.querySelector('#queuePriority');
        const reasonGroup = layer.querySelector('#priorityReasonGroup');
        const reasonSelect = layer.querySelector('#queuePriorityReason');
        const submit = layer.querySelector('[type="submit"][form="newQueueForm"]');

        function updatePatient() {
          const patient = store.patientById(patientSelect.value);
          if (!patient) {
            summary.hidden = true;
            summary.innerHTML = '';
            return;
          }
          const active = store.queues({ date: today, status: ['menunggu', 'dipanggil', 'dilayani'] }).find(function (queue) { return queue.patientId === patient.id; });
          summary.hidden = false;
          summary.innerHTML = '<span class="avatar avatar-sm">' + ui.esc(ui.initials(patient.nama)) + '</span>' +
            '<div><strong>' + ui.esc(patient.nama) + '</strong><small>' + ui.esc(patient.noRM) + ' · ' + ui.esc(ui.ageLabel(patient.tanggalLahir)) + ' · ' + ui.esc(patient.jenisKepersertaan) + '</small></div>' +
            '<span class="badge ' + (patient.jenisKepersertaan === 'BPJS' ? 'badge-info' : 'badge-muted') + '">' + ui.esc(patient.jenisKepersertaan) + '</span>' +
            (active ? '<span class="inline-warning">' + ui.icon('alert-circle') + 'Sudah memiliki antrean aktif: ' + ui.esc(active.kode) + '</span>' : '');
          submit.disabled = Boolean(active);
          if (active) submit.title = 'Pasien sudah memiliki antrean aktif hari ini.';
          else submit.removeAttribute('title');
        }
        function updateEstimate() {
          const poli = NS.core.getPoli(poliSelect.value);
          const nomor = store.nextQueueNumberFor(today, poli.id);
          const waitingCount = store.queues({ date: today, poli: poli.id, status: 'menunggu' }).length;
          nextNumber.innerHTML = '<strong>' + ui.esc(poli.kode + '-' + String(nomor).padStart(3, '0')) + '</strong><small>' + ui.esc(poli.nama) + '</small>';
          estimate.textContent = waitingCount ? '± ' + Math.max(5, (waitingCount + 1) * 12) + ' menit, ' + waitingCount + ' pasien sedang menunggu.' : 'Perkiraan tunggu ± 5–12 menit.';
        }
        patientSelect.addEventListener('change', updatePatient);
        poliSelect.addEventListener('change', updateEstimate);
        priority.addEventListener('change', function () {
          reasonGroup.hidden = !priority.checked;
          reasonSelect.required = priority.checked;
          if (!priority.checked) reasonSelect.value = '';
        });
        updatePatient();
        updateEstimate();
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          const button = layer.querySelector('[type="submit"][form="newQueueForm"]');
          ui.setSubmitting(button, true, 'Membuat antrean…');
          try {
            const values = ui.readForm(form);
            const queue = store.createQueue(values.patientId, values.poli, Boolean(values.prioritas), values.alasanPrioritas);
            const patient = store.patientById(queue.patientId);
            ui.closeModal();
            ui.toast('Antrean ' + queue.kode + ' untuk ' + (patient ? patient.nama : 'pasien') + ' berhasil dibuat.', 'success', 'Pendaftaran antrean');
            if (location.hash === '#/antrean') {
              rerenderCurrent();
            } else {
              location.hash = '#/antrean';
            }
          } catch (error) {
            ui.setSubmitting(button, false);
            form.querySelector('.form-error-host').innerHTML = ui.formError(error.message);
            form.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
      }
    });
  }

  function callAndNotify(queue) {
    const patient = patientOf(queue);
    ui.toast('Antrean ' + queue.kode + ' · ' + (patient ? patient.nama : 'Pasien') + ' dipanggil ke ' + NS.core.getPoli(queue.poli).nama + '.', 'success', 'Antrean dipanggil');
    announceQueue(queue);
  }

  function render(root) {
    const today = NS.core.dateKey();
    const isToday = state.date === today;
    const stats = statsForDate();
    const base = getBaseQueues();
    const list = getFilteredQueues(base);
    const counts = {
      all: base.length,
      menunggu: base.filter(function (queue) { return queue.status === 'menunggu'; }).length,
      dipanggil: base.filter(function (queue) { return queue.status === 'dipanggil'; }).length,
      dilayani: base.filter(function (queue) { return queue.status === 'dilayani'; }).length,
      selesai: base.filter(function (queue) { return queue.status === 'selesai'; }).length,
      batal: base.filter(function (queue) { return queue.status === 'batal'; }).length
    };
    const canCall = isToday && store.can('queue.manage') && stats.waiting.length > 0;

    root.innerHTML = ui.pageHeader({
      eyebrow: 'Pelayanan Pasien',
      title: 'Antrean Pasien',
      description: 'Kelola alur antrean, prioritas, estimasi tunggu, dan panggilan ruang tunggu.',
      actions: (store.can('queue.manage') ? '<button type="button" class="btn btn-primary" id="newQueueBtn">' + ui.icon('plus') + 'Daftarkan Antrean</button>' : '') +
        '<a href="#/display" target="_blank" rel="noopener" class="btn btn-secondary">' + ui.icon('external-link') + 'Buka Display</a>'
    }) +
    '<div class="stats-grid stats-grid-compact">' +
      ui.statCard({ label: 'Total antrean', value: stats.list.length, icon: 'queue', tone: 'teal', hint: ui.fmtDate(state.date, 'full') }) +
      ui.statCard({ label: 'Menunggu', value: stats.waiting.length, icon: 'clock', tone: 'amber', hint: stats.priority.length ? stats.priority.length + ' antrean prioritas' : 'Tidak ada prioritas' }) +
      ui.statCard({ label: 'Dalam layanan', value: stats.active.length, icon: 'stethoscope', tone: 'blue', hint: 'Dipanggil atau sedang diperiksa' }) +
      ui.statCard({ label: 'Selesai dilayani', value: stats.done.length, icon: 'check-circle', tone: 'green', hint: stats.cancelled.length + ' antrean dibatalkan' }) +
    '</div>' +
    '<div class="queue-toolbar card">' +
      '<div class="queue-toolbar-main">' +
        '<div class="date-control"><span>' + ui.icon('calendar') + '</span><input type="date" id="queueDate" class="input input-auto" value="' + ui.attr(state.date) + '" aria-label="Tanggal antrean"></div>' +
        '<select id="queuePoliFilter" class="input input-auto" aria-label="Filter poli">' + ui.options(C.POLI.map(function (poli) { return { value: poli.id, label: poli.nama }; }), state.poli, 'Semua poli') + '</select>' +
        '<div class="search-field queue-search">' + ui.icon('search') + '<input type="search" id="queueSearch" class="input" value="' + ui.attr(state.search) + '" placeholder="Cari nomor, nama pasien, NIK…" aria-label="Cari antrean"></div>' +
      '</div>' +
      '<div class="queue-toolbar-actions">' +
        '<button type="button" class="btn btn-secondary btn-sm" id="resetQueueFilter">' + ui.icon('refresh') + 'Reset</button>' +
        (canCall ? '<button type="button" class="btn btn-primary btn-sm" id="callNextQueueBtn" data-poli="' + ui.attr(state.poli) + '">' + ui.icon('megaphone') + 'Panggil Berikutnya</button>' : '') +
      '</div>' +
    '</div>' +
    (isToday && stats.priority.length ? '<div class="priority-banner">' +
      '<span class="priority-banner-icon">' + ui.icon('sparkles') + '</span>' +
      '<div><strong>' + stats.priority.length + ' antrean prioritas sedang menunggu</strong><p>' + stats.priority.map(function (queue) { const patient = patientOf(queue); return queue.kode + ' · ' + (patient ? patient.nama : 'Pasien') + ' (' + (queue.alasanPrioritas || 'prioritas') + ')'; }).join(' · ') + '</p></div>' +
      '</div>' : '') +
    '<section class="card queue-board-card">' +
      '<div class="directory-toolbar queue-directory-toolbar">' +
        ui.pageTabs([
          { id: 'all', label: 'Semua', count: counts.all },
          { id: 'menunggu', label: 'Menunggu', count: counts.menunggu },
          { id: 'dipanggil', label: 'Dipanggil', count: counts.dipanggil },
          { id: 'dilayani', label: 'Dilayani', count: counts.dilayani },
          { id: 'selesai', label: 'Selesai', count: counts.selesai },
          { id: 'batal', label: 'Batal', count: counts.batal }
        ], state.status) +
      '</div>' +
      '<div class="table-responsive">' +
        (list.length ? '<table class="data-table queue-table"><thead><tr><th>Nomor</th><th>Pasien</th><th>Poli</th><th>Waktu daftar</th><th>Estimasi / waktu</th><th>Status</th><th class="th-actions">Aksi</th></tr></thead><tbody>' +
          list.map(function (queue) { return renderQueueRow(queue, isToday); }).join('') + '</tbody></table>' :
          ui.emptyState('queue', 'Tidak ada antrean', 'Tidak ada antrean yang sesuai pada tanggal dan filter ini.', (store.can('queue.manage') ? '<button type="button" class="btn btn-primary btn-sm" id="emptyNewQueue">Daftarkan antrean</button>' : ''))) +
      '</div>' +
      '<div class="queue-board-foot">' +
        '<span>' + ui.icon('info') + 'Estimasi waktu bersifat perkiraan dan dapat berubah sesuai kondisi layanan.</span>' +
        '<span class="muted">Terakhir diperbarui ' + ui.fmtTime(new Date().toISOString()) + '</span>' +
      '</div>' +
    '</section>';

    const newButton = root.querySelector('#newQueueBtn');
    if (newButton) newButton.addEventListener('click', function () { openNewQueueModal(); });
    const emptyNew = root.querySelector('#emptyNewQueue');
    if (emptyNew) emptyNew.addEventListener('click', function () { openNewQueueModal(); });

    const dateInput = root.querySelector('#queueDate');
    dateInput.addEventListener('change', function () { state.date = dateInput.value || today; state.status = 'all'; render(root); });
    root.querySelector('#queuePoliFilter').addEventListener('change', function (event) { state.poli = event.target.value; state.status = 'all'; render(root); });
    const search = root.querySelector('#queueSearch');
    search.addEventListener('input', ui.debounce(function () { state.search = search.value; render(root); }, 220));
    root.querySelector('#resetQueueFilter').addEventListener('click', function () {
      state.date = today;
      state.poli = '';
      state.status = 'all';
      state.search = '';
      render(root);
    });
    root.querySelectorAll('.tabs .tab[data-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () { state.status = tab.dataset.tab; render(root); });
    });
    const callNext = root.querySelector('#callNextQueueBtn');
    if (callNext) {
      callNext.addEventListener('click', function () {
        try {
          const queue = store.callNextQueue(state.poli || null);
          callAndNotify(queue);
          render(root);
        } catch (error) {
          ui.showError(error);
        }
      });
    }
    root.querySelectorAll('[data-queue-action]').forEach(function (button) {
      button.addEventListener('click', function () { handleQueueAction(button.dataset.queueAction, button.dataset.id, root); });
    });
  }

  async function handleQueueAction(action, queueId, root) {
    const queue = store.queueById(queueId);
    if (!queue) return;
    try {
      if (action === 'call') {
        const updated = store.updateQueueStatus(queueId, 'dipanggil');
        callAndNotify(updated);
        render(root);
      } else if (action === 'recall') {
        const updated = store.updateQueueStatus(queueId, 'dipanggil');
        callAndNotify(updated);
        render(root);
      } else if (action === 'start') {
        store.updateQueueStatus(queueId, 'dilayani');
        ui.toast('Antrean ' + queue.kode + ' mulai dilayani.', 'success');
        render(root);
      } else if (action === 'finish') {
        const confirmed = await ui.confirm('Tandai antrean ' + queue.kode + ' sebagai selesai? Pastikan pelayanan pasien telah tuntas.', { title: 'Selesaikan antrean', okText: 'Ya, selesaikan' });
        if (!confirmed) return;
        store.updateQueueStatus(queueId, 'selesai');
        ui.toast('Antrean ' + queue.kode + ' telah diselesaikan.', 'success');
        render(root);
      } else if (action === 'cancel') {
        openCancelModal(queueId);
      } else if (action === 'print') {
        printTicket(queueId);
      } else if (action === 'examine') {
        const exam = store.startExam(queueId);
        location.hash = '#/pemeriksaan/' + exam.id;
      }
    } catch (error) {
      ui.showError(error);
    }
  }

  /* ------------------------------------------------------------------------
     Display antrean ruang tunggu (dapat diakses tanpa login)
     ------------------------------------------------------------------------ */
  function renderDisplay(root) {
    if (window.PK.cleanupDisplay) {
      try { window.PK.cleanupDisplay(); } catch (error) { /* noop */ }
      window.PK.cleanupDisplay = null;
    }
    const today = NS.core.dateKey();
    const clinic = store.clinic;
    const user = store.currentUser();
    let timer = null;
    let refreshTimer = null;

    const shell = '<div class="display-screen">' +
      '<div class="display-bg" aria-hidden="true"><span class="display-orb orb-one"></span><span class="display-orb orb-two"></span><span class="display-grid"></span></div>' +
      '<header class="display-header">' +
        '<div class="display-brand"><span class="display-mark">' + ui.brandMark() + '</span><div><strong>' + ui.esc(clinic.nama) + '</strong><small>' + ui.esc(clinic.instansi) + '</small></div></div>' +
        '<div class="display-header-center"><span class="display-live"><span class="status-dot"></span>RUANG TUNGGU DIGITAL</span><h1>Antrean Layanan</h1></div>' +
        '<div class="display-clock"><strong id="displayClock">--:--:--</strong><span id="displayDate">' + ui.esc(ui.fmtDate(new Date(), 'full')) + '</span></div>' +
      '</header>' +
      '<main class="display-main">' +
        '<section class="display-called">' +
          '<div class="display-section-label"><span class="live-pulse"></span>Sedang Dipanggil <span class="display-section-en">Now Serving</span></div>' +
          '<div id="displayCalledBody" class="display-called-body"></div>' +
          '<div class="display-called-footer">' +
            '<span id="displayCallInstruction">' + ui.icon('megaphone') + 'Silakan menuju ruang periksa poli yang tertera.</span>' +
            '<button type="button" class="display-audio-btn" id="displayAudioBtn" aria-pressed="false">' + ui.icon('volume-off') + '<span>Suara nonaktif</span></button>' +
          '</div>' +
        '</section>' +
        '<section class="display-waiting">' +
          '<div class="display-section-label"><span>' + ui.icon('queue') + '</span>Antrean Berikutnya <span class="display-section-en">Next in Queue</span></div>' +
          '<div id="displayWaitingBody" class="display-poli-grid"></div>' +
        '</section>' +
      '</main>' +
      '<footer class="display-footer">' +
        '<div class="display-ticker"><span class="ticker-label">' + ui.icon('info') + 'INFORMASI</span><div class="ticker-track"><span>' + ui.esc(clinic.motto) + ' · Mohon menunggu hingga nomor antrean dipanggil · Siapkan kartu identitas / BPJS saat menuju loket · Jaga ketertiban dan kebersihan ruang tunggu.</span></div></div>' +
        '<div class="display-footer-actions">' +
          '<span class="display-facility">Kode Faskes <strong>' + ui.esc(clinic.kodeFaskes) + '</strong></span>' +
          '<button type="button" class="display-icon-btn" id="displayFullscreen" title="Layar penuh" aria-label="Layar penuh">' + ui.icon('external-link') + '</button>' +
          '<a href="' + (user ? '#/dashboard' : '#/login') + '" class="display-back-link">' + (user ? 'Kembali ke aplikasi' : 'Masuk petugas') + ' ' + ui.icon('arrow-right') + '</a>' +
        '</div>' +
      '</footer>' +
      '</div>';

    root.innerHTML = shell;

    function getData() {
      const queues = store.queues({ date: today });
      const called = queues.filter(function (queue) { return queue.status === 'dipanggil'; }).sort(function (a, b) {
        return new Date(b.calledAt || 0) - new Date(a.calledAt || 0);
      });
      const waiting = queues.filter(function (queue) { return queue.status === 'menunggu'; });
      const serving = queues.filter(function (queue) { return queue.status === 'dilayani'; });
      const done = queues.filter(function (queue) { return queue.status === 'selesai'; });
      return { queues: queues, called: called, waiting: waiting, serving: serving, done: done };
    }

    function calledMarkup(called) {
      if (!called.length) {
        return '<div class="display-idle">' +
          '<span class="display-idle-icon">' + ui.icon('volume') + '</span>' +
          '<strong>Menunggu panggilan antrean</strong>' +
          '<p>Nomor antrean yang dipanggil akan tampil di layar ini.</p>' +
          '</div>';
      }
      const current = called[0];
      const patient = patientOf(current);
      return '<div class="called-ticket">' +
        '<div class="called-stripe"></div>' +
        '<div class="called-number-wrap"><span class="called-label">Nomor Antrean</span><div class="called-number">' + ui.esc(current.kode) + '</div></div>' +
        '<div class="called-details"><span class="called-poli">' + ui.esc(NS.core.getPoli(current.poli).nama) + '</span><h2>' + ui.esc(maskName(patient ? patient.nama : 'Pasien')) + '</h2><p>Silakan menuju <strong>' + ui.esc(NS.core.getPoli(current.poli).nama) + '</strong></p><span class="called-time">' + ui.icon('clock') + 'Dipanggil pukul ' + ui.esc(ui.fmtTime(current.calledAt)) + '</span></div>' +
        (called.length > 1 ? '<div class="called-others">' + called.slice(1, 4).map(function (queue) {
          return '<span><strong>' + ui.esc(queue.kode) + '</strong>' + ui.esc(NS.core.getPoli(queue.poli).singkat) + '</span>';
        }).join('') + '</div>' : '') +
      '</div>';
    }

    function waitingMarkup(data) {
      return C.POLI.map(function (poli) {
        const waiting = data.waiting.filter(function (queue) { return queue.poli === poli.id; }).sort(function (a, b) {
          if (Boolean(b.prioritas) !== Boolean(a.prioritas)) return Number(b.prioritas) - Number(a.prioritas);
          return a.nomor - b.nomor;
        });
        const serving = data.serving.filter(function (queue) { return queue.poli === poli.id; });
        const displayItems = waiting.slice(0, 4);
        if (!displayItems.length && !serving.length) return '';
        return '<article class="display-poli-card" style="--poli-color:' + ui.attr(poli.warna) + '">' +
          '<header><span class="display-poli-name"><span class="display-poli-dot"></span>' + ui.esc(poli.singkat) + '</span><span class="display-poli-count">' + waiting.length + ' menunggu</span></header>' +
          '<div class="display-poli-serving">' + (serving.length ? '<span class="serving-label">Dilayani</span><strong>' + serving.map(function (queue) { return queue.kode; }).join(', ') + '</strong>' : '<span class="serving-label">Ruang periksa siap</span>') + '</div>' +
          '<div class="display-number-list">' + (displayItems.length ? displayItems.map(function (queue, index) {
            return '<div class="display-number-item' + (queue.prioritas ? ' is-priority' : '') + '">' +
              '<span class="display-number">' + ui.esc(queue.kode) + '</span>' +
              '<span class="display-number-meta">' + (queue.prioritas ? '<span class="display-priority">Prioritas</span>' : '± ' + store.waitingEstimate(queue) + ' mnt') + '</span>' +
              (index === 0 ? '<span class="display-next">Berikutnya</span>' : '') +
            '</div>';
          }).join('') : '<div class="display-empty-line">Belum ada antrean menunggu</div>') + '</div>' +
        '</article>';
      }).join('') || '<div class="display-board-empty">' + ui.icon('check-circle') + '<strong>Semua antrean telah dilayani</strong><span>Terima kasih atas kesabaran Anda.</span></div>';
    }

    function paint() {
      store.reload();
      const data = getData();
      root.querySelector('#displayCalledBody').innerHTML = calledMarkup(data.called);
      root.querySelector('#displayWaitingBody').innerHTML = waitingMarkup(data);
      const newest = data.called.length ? data.called[0] : null;
      if (displayAudioEnabled && newest && newest.id !== displayLastCalledId) {
        displayLastCalledId = newest.id;
        announceQueue(newest, true);
      } else if (newest) {
        displayLastCalledId = newest.id;
      }
    }

    function tickClock() {
      const clock = root.querySelector('#displayClock');
      if (clock) clock.textContent = ui.fmtTime(new Date().toISOString(), true);
      const date = root.querySelector('#displayDate');
      if (date) date.textContent = ui.fmtDate(new Date(), 'full');
    }

    const audioBtn = root.querySelector('#displayAudioBtn');
    function updateAudioButton() {
      if (!audioBtn) return;
      audioBtn.classList.toggle('is-on', displayAudioEnabled);
      audioBtn.setAttribute('aria-pressed', String(displayAudioEnabled));
      audioBtn.innerHTML = ui.icon(displayAudioEnabled ? 'volume' : 'volume-off') + '<span>' + (displayAudioEnabled ? 'Suara aktif' : 'Suara nonaktif') + '</span>';
    }
    audioBtn.addEventListener('click', function () {
      displayAudioEnabled = !displayAudioEnabled;
      updateAudioButton();
      if (displayAudioEnabled) {
        const data = getData();
        const latest = data.called[0];
        ui.toast('Panggilan suara diaktifkan.', 'success');
        if (latest) announceQueue(latest, true);
      }
    });
    updateAudioButton();

    const fullscreenBtn = root.querySelector('#displayFullscreen');
    fullscreenBtn.addEventListener('click', function () {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(function () {
          ui.toast('Layar penuh tidak tersedia di browser ini.', 'info');
        });
      } else {
        document.exitFullscreen?.();
      }
    });

    paint();
    tickClock();
    timer = window.setInterval(tickClock, 1000);
    refreshTimer = window.setInterval(paint, 5000);
    const onStorage = function (event) {
      if (event.key && event.key.indexOf('puskesmas-arbes.db') !== -1) paint();
    };
    const onKey = function (event) {
      if (event.key === 'Escape' && document.fullscreenElement) document.exitFullscreen?.();
    };
    window.addEventListener('storage', onStorage);
    document.addEventListener('keydown', onKey);

    const cleanup = function () {
      if (timer) clearInterval(timer);
      if (refreshTimer) clearInterval(refreshTimer);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('keydown', onKey);
    };
    window.PK.cleanupDisplay = cleanup;
    return cleanup;
  }

  NS.announceQueue = announceQueue;
  NS.pages = NS.pages || {};
  NS.pages.queues = {
    render: render,
    display: renderDisplay,
    openNewQueueModal: openNewQueueModal,
    printTicket: printTicket,
    announceQueue: announceQueue
  };
})(window);
