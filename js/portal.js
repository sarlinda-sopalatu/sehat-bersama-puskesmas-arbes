/* Portal khusus pasien. Semua data klinis pada versi demo masih di browser lokal. */
(function (window) {
  'use strict';
  const NS = window.PK;
  const store = NS.store;
  const ui = NS.ui;
  const C = NS.constants;
  const core = NS.core;
  const e = ui.esc;
  function own() { return store.ownPatient(); }
  function ownQueues() {
    const patient = own();
    if (!patient) return [];
    return store.queues({}).filter(q => q.patientId === patient.id);
  }
  function head(title, description, action) {
    return '<header class="portal-head"><div><span class="portal-eyebrow">Layanan Mandiri Pasien</span><h1>' + e(title) + '</h1><p>' + e(description) + '</p></div>' + (action || '') + '</header>';
  }
  function note() {
    return '<div class="portal-warning">' + ui.icon('info') + '<span>Mode demonstrasi: data pasien dan antrean tersimpan di browser perangkat ini, bukan database klinik bersama. Jangan masukkan NIK atau informasi kesehatan asli.</span></div>';
  }
  function home(root) {
    const user = store.currentUser(); const patient = own();
    const queues = ownQueues();
    const active = queues.filter(q => q.tanggal === core.dateKey() && ['menunggu', 'dipanggil', 'dilayani'].includes(q.status));
    root.innerHTML = head('Selamat datang, ' + user.name.split(' ')[0], 'Kelola pendaftaran dan pantau pelayanan Sehat Bersama - Puskesmas Arbes dari satu halaman.') + note() +
      '<section class="portal-hero"><span>Portal Pasien · Sehat Bersama - Puskesmas Arbes</span><h2>Pelayanan lebih mudah, antrean lebih tertata.</h2><p>Lengkapi data diri untuk mulai mendaftar antrean pemeriksaan.</p><div class="portal-hero-actions">' +
        '<a href="#/pasien-saya" class="btn btn-primary">' + ui.icon('user') + (patient ? 'Lihat data diri' : 'Lengkapi data diri') + '</a>' +
        '<a href="#/antrean-saya" class="btn btn-secondary">' + ui.icon('queue') + 'Daftar antrean</a></div></section>' +
      '<div class="portal-stat-grid">' +
        statCard('Nomor rekam medis', patient ? patient.noRM : 'Belum tersedia', 'user') +
        statCard('Antrean aktif hari ini', String(active.length), 'queue') +
        statCard('Total kunjungan', String(queues.length), 'clipboard') +
      '</div>' +
      '<section class="portal-panel"><div class="portal-panel-head"><h3>Status antrean terkini</h3><a href="#/antrean-saya" class="auth-link">Lihat antrean</a></div>' +
        (active.length ? queueTable(active) : '<p class="portal-empty">Belum ada antrean aktif. Silakan pilih poli dari halaman Daftar Antrean.</p>') +
      '</section>';
  }
  function statCard(label, value, icon) {
    return '<div class="portal-stat"><span class="portal-stat-icon">' + ui.icon(icon) + '</span><div><small>' + e(label) + '</small><strong>' + e(value) + '</strong></div></div>';
  }
  function input(label, id, value, type, props) {
    return '<div class="portal-field"><label for="' + id + '">' + label + '</label><input class="input" id="' + id + '" type="' + (type || 'text') + '" value="' + ui.attr(value || '') + '" ' + (props || '') + ' required></div>';
  }
  function select(label, id, options, value) {
    return '<div class="portal-field"><label for="' + id + '">' + label + '</label><select class="input" id="' + id + '" required>' + options.map(o => '<option value="' + ui.attr(o[0]) + '"' + (o[0] === value ? ' selected' : '') + '>' + e(o[1]) + '</option>').join('') + '</select></div>';
  }
  function profile(root) {
    const p = own() || {};
    root.innerHTML = head('Data diri pasien', p.id ? 'Perbarui identitas Anda jika ada perubahan.' : 'Lengkapi formulir pasien agar dapat mengambil antrean.') + note() +
      '<section class="portal-panel"><h3>' + (p.id ? 'Informasi pasien terdaftar' : 'Pendaftaran pasien baru') + '</h3>' +
      (p.noRM ? '<div class="portal-record">Nomor Rekam Medis: <strong>' + e(p.noRM) + '</strong></div>' : '') +
      '<form id="ownPatientForm" class="portal-form" novalidate><div id="ownPatientError" class="form-error-host"></div><div class="portal-form-grid">' +
        input('NIK (16 digit) *', 'ownNik', p.nik, 'text', 'inputmode="numeric" pattern="[0-9]{16}" maxlength="16"') +
        input('Nama lengkap *', 'ownName', p.nama || store.currentUser().name) +
        input('Tempat lahir *', 'ownBirthPlace', p.tempatLahir) +
        input('Tanggal lahir *', 'ownBirthDate', p.tanggalLahir, 'date', 'max="' + core.dateKey() + '"') +
        select('Jenis kelamin *', 'ownGender', [['', 'Pilih jenis kelamin'], ['L', 'Laki-laki'], ['P', 'Perempuan']], p.jenisKelamin || '') +
        input('Nomor telepon *', 'ownPhone', p.noTelepon || store.currentUser().phone, 'tel') +
        select('Jenis kepesertaan *', 'ownInsurance', [['Umum', 'Umum'], ['BPJS', 'BPJS']], p.jenisKepersertaan || 'Umum') +
        input('Nomor BPJS (jika BPJS)', 'ownBpjs', p.noBPJS, 'text', 'inputmode="numeric" maxlength="13"') +
        '<div class="portal-field portal-full"><label for="ownAddress">Alamat domisili *</label><textarea class="input portal-textarea" id="ownAddress" rows="3" required>' + e(p.alamat || '') + '</textarea></div>' +
      '</div><button class="btn btn-primary portal-save" type="submit">' + ui.icon('check-circle') + (p.id ? 'Simpan perubahan' : 'Daftarkan identitas pasien') + '</button></form></section>';
    root.querySelector('#ownPatientForm').addEventListener('submit', event => {
      event.preventDefault();
      const val = id => root.querySelector('#' + id).value.trim();
      const payload = { nik: val('ownNik'), nama: val('ownName'), tempatLahir: val('ownBirthPlace'),
        tanggalLahir: val('ownBirthDate'), jenisKelamin: val('ownGender'), noTelepon: val('ownPhone'),
        jenisKepersertaan: val('ownInsurance'), noBPJS: val('ownBpjs'), alamat: val('ownAddress') };
      const host = root.querySelector('#ownPatientError'); host.innerHTML = '';
      try {
        if (p.id) store.updateOwnPatient(payload); else store.createOwnPatient(payload);
        ui.toast('Data pasien berhasil disimpan.', 'success');
        profile(root);
      } catch (err) { host.innerHTML = ui.formError(err.message); host.scrollIntoView({ block: 'nearest' }); }
    });
  }
  function queueTable(queues, cancellable) {
    return '<div class="portal-table-wrap"><table class="portal-table"><thead><tr><th>Nomor</th><th>Tanggal</th><th>Poli</th><th>Status</th>' + (cancellable ? '<th>Aksi</th>' : '') + '</tr></thead><tbody>' +
      queues.map(q => '<tr><td><strong>' + e(q.kode) + '</strong></td><td>' + e(ui.fmtDate(q.tanggal)) + '</td><td>' + e(core.getPoli(q.poli).nama) + '</td><td><span class="portal-status">' + e(C.STATUS_META[q.status]?.label || q.status) + '</span></td>' +
      (cancellable ? '<td>' + (q.status === 'menunggu' && q.tanggal === core.dateKey() ? '<button class="btn btn-ghost btn-sm" type="button" data-cancel-queue="' + ui.attr(q.id) + '">Batalkan</button>' : '—') + '</td>' : '') + '</tr>').join('') +
      '</tbody></table></div>';
  }
  function queues(root) {
    const p = own(); const existing = ownQueues();
    root.innerHTML = head('Daftar antrean', 'Pilih poli tujuan, lihat nomor antrean, dan pantau proses layanan.') + note() +
      (!p ? '<section class="portal-panel"><h3>Lengkapi data diri dahulu</h3><p>Untuk mendaftar antrean, Anda harus mengisi identitas pasien.</p><a href="#/pasien-saya" class="btn btn-primary">Isi data diri pasien</a></section>' :
      '<section class="portal-panel"><div class="portal-panel-head"><h3>Ambil nomor antrean</h3><span class="portal-record">RM: ' + e(p.noRM) + '</span></div>' +
        '<form id="ownQueueForm" class="portal-form"><div id="ownQueueError" class="form-error-host"></div>' +
          select('Pilih poli tujuan', 'ownQueuePoli', C.POLI.map(poli => [poli.id, poli.nama]), 'umum') +
          '<button class="btn btn-primary portal-save" type="submit">' + ui.icon('queue') + 'Ambil antrean hari ini</button></form></section>') +
      '<section class="portal-panel"><div class="portal-panel-head"><h3>Antrean saya</h3><span>' + existing.length + ' antrean</span></div>' +
      (existing.length ? queueTable(existing.slice(0, 30), true) : '<p class="portal-empty">Anda belum mempunyai antrean.</p>') + '</section>';
    const form = root.querySelector('#ownQueueForm');
    if (form) form.addEventListener('submit', event => {
      event.preventDefault();
      const host = root.querySelector('#ownQueueError'); host.innerHTML = '';
      try {
        const queue = store.createQueue(p.id, root.querySelector('#ownQueuePoli').value, false, null);
        ui.toast('Nomor antrean ' + queue.kode + ' berhasil dibuat.', 'success');
        queues(root);
      } catch (err) { host.innerHTML = ui.formError(err.message); }
    });
    root.querySelectorAll('[data-cancel-queue]').forEach(button => button.addEventListener('click', () => {
      if (!window.confirm('Batalkan antrean ini?')) return;
      try { store.cancelQueue(button.dataset.cancelQueue, 'Dibatalkan oleh pasien'); ui.toast('Antrean dibatalkan.', 'success'); queues(root); }
      catch (error) { ui.toast(error.message, 'error'); }
    }));
  }
  function history(root) {
    const visits = ownQueues();
    root.innerHTML = head('Riwayat kunjungan', 'Pantau riwayat antrean dan status pelayanan Anda.') + note() +
      '<section class="portal-panel"><h3>Riwayat antrean saya</h3>' +
      (visits.length ? queueTable(visits, false) : '<p class="portal-empty">Belum ada riwayat kunjungan. Daftar antrean pertama Anda dari menu Daftar Antrean.</p>') + '</section>';
  }
  NS.pages = NS.pages || {};
  NS.pages.portal = { home, profile, queues, history };
})(window);
