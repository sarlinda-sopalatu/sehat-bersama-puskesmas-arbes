/* ==========================================================================
   Sehat Bersama - Puskesmas Arbes — Pengguna, hak akses, profil, dan pengaturan sistem
   ========================================================================== */
(function (window) {
  'use strict';

  const NS = window.PK;
  const ui = NS.ui;
  const store = NS.store;
  const C = NS.constants;

  const state = {
    tab: 'daftar',
    search: '',
    role: '',
    status: '',
    page: 1,
    perPage: 15,
    auditModule: '',
    auditUser: '',
    auditSearch: '',
    auditPage: 1,
    auditPerPage: 15
  };

  const CAPABILITY_LABELS = {
    'patient.manage': 'Kelola data pasien',
    'queue.manage': 'Kelola antrean',
    'queue.cancel': 'Batalkan antrean',
    'exam.manage': 'Pemeriksaan & diagnosis',
    'vitals.manage': 'Tanda vital / asesmen',
    'prescription.manage': 'Menyusun resep',
    'pharmacy.manage': 'Kelola obat & stok',
    'prescription.dispense': 'Serahkan obat',
    'billing.manage': 'Tagihan & pembayaran',
    'tariff.manage': 'Kelola tarif',
    'billing.verify': 'Verifikasi BPJS'
  };

  const ACTION_TONE = {
    'auth.login': 'info',
    'auth.logout': 'muted',
    'auth.reset-password': 'warning',
    'auth.change-password': 'warning',
    'user.create': 'success',
    'user.update': 'info',
    'user.toggle': 'warning',
    'user.reset-password': 'warning',
    'access.update': 'info',
    'settings.update': 'info',
    'profile.update': 'success'
  };

  function currentUser() {
    return store.currentUser();
  }

  function isAdmin() {
    const user = currentUser();
    return Boolean(user && user.role === 'admin');
  }

  function usersSorted() {
    return store.users().slice().sort(function (a, b) {
      if (Boolean(b.active) !== Boolean(a.active)) return Number(b.active) - Number(a.active);
      const role = C.ROLE_ORDER.indexOf(a.role) - C.ROLE_ORDER.indexOf(b.role);
      if (role) return role;
      return String(a.name).localeCompare(String(b.name), 'id');
    });
  }

  function filteredUsers() {
    let list = usersSorted();
    if (state.role) list = list.filter(function (user) { return user.role === state.role; });
    if (state.status) {
      const active = state.status === 'active';
      list = list.filter(function (user) { return Boolean(user.active) === active; });
    }
    if (state.search) {
      const query = state.search.toLowerCase();
      list = list.filter(function (user) {
        return [user.name, user.username, user.phone, NS.core.getRoleMeta(user.role).label]
          .some(function (value) { return String(value || '').toLowerCase().includes(query); });
      });
    }
    return list;
  }

  function auditEntries() {
    let list = store.auditLog();
    if (state.auditModule) list = list.filter(function (entry) { return entry.module === state.auditModule; });
    if (state.auditUser) list = list.filter(function (entry) { return entry.userId === state.auditUser; });
    if (state.auditSearch) {
      const query = state.auditSearch.toLowerCase();
      list = list.filter(function (entry) {
        return [entry.description, entry.action, entry.module, entry.userName, NS.core.getRoleMeta(entry.userRole).label]
          .some(function (value) { return String(value || '').toLowerCase().includes(query); });
      });
    }
    return list;
  }

  function roleCount(role) {
    return store.users().filter(function (user) { return user.role === role; }).length;
  }

  function activeCount() {
    return store.users().filter(function (user) { return user.active; }).length;
  }

  function poliLabel(user) {
    return user.poli ? NS.core.getPoli(user.poli).nama : '—';
  }

  function statusMarkup(active) {
    return active
      ? '<span class="user-status is-active"><span class="status-dot"></span>Aktif</span>'
      : '<span class="user-status is-inactive"><span class="status-dot"></span>Nonaktif</span>';
  }

  function actionTone(action) {
    return ACTION_TONE[action] || 'muted';
  }

  /* ------------------------------------------------------------------------
     Daftar pengguna
     ------------------------------------------------------------------------ */
  function statCardsMarkup() {
    const total = store.users().length;
    const active = activeCount();
    const inactive = total - active;
    const clinical = store.users().filter(function (user) { return ['dokter', 'perawat', 'farmasi'].includes(user.role); }).length;
    const admins = roleCount('admin');
    return '<div class="stats-grid">' +
      ui.statCard({ label: 'Total pengguna', value: total, icon: 'users', tone: 'teal', hint: active + ' akun aktif · ' + inactive + ' nonaktif' }) +
      ui.statCard({ label: 'Administrator', value: admins, icon: 'shield', tone: 'violet', hint: 'Akses penuh ke seluruh modul' }) +
      ui.statCard({ label: 'Tenaga kesehatan', value: clinical, icon: 'stethoscope', tone: 'blue', hint: 'Dokter, perawat, dan farmasi' }) +
      ui.statCard({ label: 'Akun nonaktif', value: inactive, icon: 'lock', tone: 'amber', hint: 'Tidak dapat masuk ke sistem' }) +
    '</div>';
  }

  function headerMarkup() {
    const admin = isAdmin();
    const actions = (admin ? '<button type="button" class="btn btn-primary" id="addUserBtn">' + ui.icon('user-plus') + 'Tambah Pengguna</button>' : '') +
      '<a href="#/pengguna/akses" class="btn btn-secondary">' + ui.icon('shield') + 'Matriks Hak Akses</a>';
    return ui.pageHeader({
      eyebrow: 'Administrasi sistem',
      title: 'Pengguna & Hak Akses',
      description: 'Kelola akun petugas, peran, status keaktifan, kata sandi, dan catatan aktivitas pengguna puskesmas.',
      actions: actions
    });
  }

  function toolbarMarkup() {
    const auditCount = store.auditLog().length;
    return '<div class="pharmacy-toolbar">' +
      ui.pageTabs([
        { id: 'daftar', label: 'Daftar Pengguna', icon: 'users', count: store.users().length },
        { id: 'audit', label: 'Log Aktivitas', icon: 'clipboard', count: auditCount }
      ], state.tab) +
      '<div class="pharmacy-toolbar-actions">' +
        '<button type="button" class="btn btn-secondary btn-sm" id="userExportBtn">' + ui.icon('download') + 'Ekspor CSV</button>' +
        '<a href="#/pengguna/akses" class="btn btn-ghost btn-sm">' + ui.icon('key') + 'Kelola akses</a>' +
      '</div>' +
    '</div>';
  }

  function userRowMarkup(user, root) {
    const admin = isAdmin();
    const self = currentUser();
    const isSelf = self && self.id === user.id;
    const actions = admin
      ? '<button type="button" class="icon-btn icon-btn-sm" data-user-action="edit" data-id="' + ui.attr(user.id) + '" title="Ubah data pengguna" aria-label="Ubah data ' + ui.attr(user.name) + '">' + ui.icon('edit') + '</button>' +
        '<button type="button" class="icon-btn icon-btn-sm" data-user-action="reset" data-id="' + ui.attr(user.id) + '" title="Reset password" aria-label="Reset password ' + ui.attr(user.name) + '">' + ui.icon('key') + '</button>' +
        '<button type="button" class="icon-btn icon-btn-sm ' + (user.active ? 'danger' : 'accent') + '" data-user-action="toggle" data-id="' + ui.attr(user.id) + '" title="' + (user.active ? 'Nonaktifkan akun' : 'Aktifkan akun') + '" aria-label="' + (user.active ? 'Nonaktifkan' : 'Aktifkan') + ' akun ' + ui.attr(user.name) + '"' + (isSelf ? ' disabled' : '') + '>' + ui.icon(user.active ? 'lock' : 'unlock') + '</button>'
      : '<span class="muted small">Hanya lihat</span>';
    return '<tr>' +
      '<td data-label="Pengguna"><span class="user-cell">' + ui.avatar(user.name, 'sm') + '<span class="user-cell-copy"><strong>' + ui.esc(user.name) + (isSelf ? ' <span class="badge badge-info">Anda</span>' : '') + '</strong><small>@' + ui.esc(user.username) + '</small></span></span></td>' +
      '<td data-label="Peran">' + ui.roleBadge(user.role) + '<small class="table-sub">' + ui.esc(poliLabel(user)) + '</small></td>' +
      '<td data-label="Kontak"><strong class="small">' + ui.esc(user.phone || '—') + '</strong><small class="table-sub">Bergabung ' + ui.esc(ui.fmtDate(user.createdAt, 'medium')) + '</small></td>' +
      '<td data-label="Status">' + statusMarkup(user.active) + '</td>' +
      '<td data-label="Login terakhir"><strong class="small">' + ui.esc(user.lastLogin ? ui.relativeTime(user.lastLogin) : 'Belum pernah') + '</strong><small class="table-sub">' + ui.esc(user.lastLogin ? ui.fmtDateTime(user.lastLogin) : '—') + '</small></td>' +
      '<td data-label="Aksi"><div class="table-actions">' + actions + '</div></td>' +
    '</tr>';
  }

  function usersTabMarkup(root) {
    const filtered = filteredUsers();
    const totalPages = Math.max(1, Math.ceil(filtered.length / state.perPage));
    if (state.page > totalPages) state.page = totalPages;
    const shown = filtered.slice((state.page - 1) * state.perPage, state.page * state.perPage);
    return '<section class="card">' +
      '<div class="filter-bar">' +
        '<div class="search-field">' + ui.icon('search') +
          '<input type="search" id="userSearch" class="input" placeholder="Cari nama, username, atau telepon…" value="' + ui.attr(state.search) + '" aria-label="Cari pengguna">' +
          (state.search ? '<button type="button" class="search-clear" id="userSearchClear" aria-label="Hapus pencarian">' + ui.icon('x') + '</button>' : '') +
        '</div>' +
        '<select id="userRoleFilter" class="input input-auto" aria-label="Filter peran">' + ui.options(C.ROLE_ORDER.map(function (role) { return { value: role, label: NS.core.getRoleMeta(role).label }; }), state.role, 'Semua peran') + '</select>' +
        '<select id="userStatusFilter" class="input input-auto" aria-label="Filter status akun">' +
          '<option value="">Semua status</option>' +
          '<option value="active"' + (state.status === 'active' ? ' selected' : '') + '>Aktif</option>' +
          '<option value="inactive"' + (state.status === 'inactive' ? ' selected' : '') + '>Nonaktif</option>' +
        '</select>' +
        ui.pageSizeSelect(state.perPage, 'userPageSize') +
        '<button type="button" class="btn btn-secondary btn-sm" id="userFilterReset">' + ui.icon('refresh') + 'Reset filter</button>' +
      '</div>' +
      (shown.length ? '<div class="table-responsive"><table class="data-table user-table"><thead><tr><th>Pengguna</th><th>Peran / Poli</th><th>Kontak</th><th>Status</th><th>Login Terakhir</th><th class="th-actions">Aksi</th></tr></thead><tbody>' +
        shown.map(function (user) { return userRowMarkup(user, root); }).join('') +
      '</tbody></table></div>' : ui.emptyState('users', 'Pengguna tidak ditemukan', 'Ubah kata kunci atau filter untuk menampilkan akun lainnya.', '<button type="button" class="btn btn-secondary btn-sm" id="userEmptyReset">Reset filter</button>')) +
      (filtered.length ? ui.pagination(filtered.length, state.page, state.perPage) : '') +
      '<div class="report-note">' + ui.icon('info') + '<span>Menampilkan ' + ui.number(filtered.length) + ' dari ' + ui.number(store.users().length) + ' pengguna. Akun nonaktif tetap tersimpan beserta riwayat aktivitasnya, namun tidak dapat masuk ke sistem.</span></div>' +
    '</section>';
  }

  function auditTabMarkup() {
    const entries = auditEntries();
    const modules = Array.from(new Set(store.auditLog().map(function (entry) { return entry.module; }).filter(Boolean))).sort(function (a, b) { return a.localeCompare(b, 'id'); });
    const users = usersSorted();
    const totalPages = Math.max(1, Math.ceil(entries.length / state.auditPerPage));
    if (state.auditPage > totalPages) state.auditPage = totalPages;
    const shown = entries.slice((state.auditPage - 1) * state.auditPerPage, state.auditPage * state.auditPerPage);
    return '<section class="card">' +
      '<div class="filter-bar">' +
        '<div class="search-field">' + ui.icon('search') +
          '<input type="search" id="auditSearch" class="input" placeholder="Cari aktivitas, petugas, atau modul…" value="' + ui.attr(state.auditSearch) + '" aria-label="Cari log aktivitas">' +
          (state.auditSearch ? '<button type="button" class="search-clear" id="auditSearchClear" aria-label="Hapus pencarian">' + ui.icon('x') + '</button>' : '') +
        '</div>' +
        '<select id="auditModuleFilter" class="input input-auto" aria-label="Filter modul">' + ui.options(modules, state.auditModule, 'Semua modul') + '</select>' +
        '<select id="auditUserFilter" class="input input-auto" aria-label="Filter petugas">' + ui.options(users.map(function (user) { return { value: user.id, label: user.name }; }), state.auditUser, 'Semua petugas') + '</select>' +
        ui.pageSizeSelect(state.auditPerPage, 'auditPageSize') +
        '<button type="button" class="btn btn-secondary btn-sm" id="auditFilterReset">' + ui.icon('refresh') + 'Reset filter</button>' +
      '</div>' +
      (shown.length ? '<div class="table-responsive"><table class="data-table audit-table"><thead><tr><th>Waktu</th><th>Petugas</th><th>Modul</th><th>Aksi</th><th>Deskripsi Aktivitas</th></tr></thead><tbody>' +
        shown.map(function (entry) {
          return '<tr>' +
            '<td data-label="Waktu"><strong class="small">' + ui.esc(ui.fmtDate(entry.createdAt, 'medium')) + '</strong><small class="table-sub">' + ui.esc(ui.fmtTime(entry.createdAt, true)) + '</small></td>' +
            '<td data-label="Petugas"><span class="user-cell"><span class="avatar avatar-xs">' + ui.esc(ui.initials(entry.userName)) + '</span><span class="user-cell-copy"><strong>' + ui.esc(entry.userName || 'Sistem') + '</strong><small>' + ui.esc(NS.core.getRoleMeta(entry.userRole).label) + '</small></span></span></td>' +
            '<td data-label="Modul">' + ui.badge(entry.module || 'Sistem', 'muted') + '</td>' +
            '<td data-label="Aksi"><span class="audit-action">' + ui.esc(entry.action) + '</span><br><span class="badge badge-' + ui.attr(actionTone(entry.action)) + '">' + ui.esc(actionGroup(entry.action)) + '</span></td>' +
            '<td data-label="Deskripsi"><strong class="small">' + ui.esc(entry.description) + '</strong></td>' +
          '</tr>';
        }).join('') + '</tbody></table></div>' : ui.emptyState('clipboard', 'Belum ada aktivitas', 'Log aktivitas akan tampil setelah pengguna melakukan tindakan di sistem.', '<button type="button" class="btn btn-secondary btn-sm" id="auditEmptyReset">Reset filter</button>')) +
      (entries.length ? ui.pagination(entries.length, state.auditPage, state.auditPerPage) : '') +
      '<div class="report-note">' + ui.icon('shield') + '<span>Audit log mencatat aktivitas penting seperti login, perubahan pengguna, hak akses, pembayaran, dan pelayanan pasien. Riwayat terbaru ditampilkan terlebih dahulu.</span></div>' +
    '</section>';
  }

  function actionGroup(action) {
    if (!action) return 'Aktivitas';
    if (action.indexOf('login') !== -1 || action.indexOf('logout') !== -1) return 'Sesi';
    if (action.indexOf('password') !== -1) return 'Keamanan';
    if (action.indexOf('user') !== -1 || action.indexOf('access') !== -1) return 'Administrasi';
    if (action.indexOf('settings') !== -1) return 'Pengaturan';
    if (action.indexOf('profile') !== -1) return 'Profil';
    if (action.indexOf('bill') !== -1 || action.indexOf('payment') !== -1) return 'Keuangan';
    if (action.indexOf('queue') !== -1) return 'Antrean';
    if (action.indexOf('exam') !== -1) return 'Pelayanan';
    if (action.indexOf('stock') !== -1 || action.indexOf('prescription') !== -1) return 'Farmasi';
    return 'Aktivitas';
  }

  /* ------------------------------------------------------------------------
     Aksi pengguna
     ------------------------------------------------------------------------ */
  function refreshUsers(root) {
    if (NS.pages.users) NS.pages.users.render(root, state.tab);
  }

  function roleFieldMarkup(selected) {
    return C.ROLE_ORDER.map(function (role) {
      return '<option value="' + ui.attr(role) + '"' + (selected === role ? ' selected' : '') + '>' + ui.esc(NS.core.getRoleMeta(role).label) + '</option>';
    }).join('');
  }

  function poliFieldMarkup(selected) {
    return C.POLI.map(function (poli) {
      return '<option value="' + ui.attr(poli.id) + '"' + (selected === poli.id ? ' selected' : '') + '>' + ui.esc(poli.nama) + '</option>';
    }).join('');
  }

  function openUserModal(user) {
    const editing = Boolean(user);
    const admin = isAdmin();
    if (!admin) {
      ui.toast('Hanya administrator yang dapat mengubah data pengguna.', 'warning');
      return;
    }
    const values = user || { name: '', username: '', email: '', role: 'pendaftaran', poli: 'umum', phone: '', active: true };
    const content = '<form id="userForm" class="form-section-body" novalidate>' +
      '<div id="userFormError" class="form-error-host"></div>' +
      '<div class="form-grid-2">' +
        '<div class="field full"><label for="userName">Nama lengkap <span class="req">*</span></label><input class="input" id="userName" name="name" type="text" value="' + ui.attr(values.name) + '" placeholder="Contoh: dr. Siti Rahma" autocomplete="name" required></div>' +
        '<div class="field"><label for="userUsername">Username <span class="req">*</span></label><input class="input mono" id="userUsername" name="username" type="text" value="' + ui.attr(values.username) + '" placeholder="huruf kecil, angka, titik" autocomplete="off" required><span class="field-feedback">3–30 karakter. Digunakan untuk masuk ke sistem.</span></div>' +
        '<div class="field"><label for="userEmail">Email untuk reset <span class="req">*</span></label><input class="input" id="userEmail" type="email" value="' + ui.attr(values.email || '') + '" placeholder="contoh@gmail.com" ' + (editing ? 'readonly' : 'required') + '></div>' +
        '<div class="field"><label for="userPhone">Nomor telepon <span class="req">*</span></label><input class="input" id="userPhone" name="phone" type="tel" value="' + ui.attr(values.phone) + '" placeholder="08xxxxxxxxxx" autocomplete="tel" required></div>' +
        '<div class="field"><label for="userRole">Peran <span class="req">*</span></label><select class="input" id="userRole" name="role" required>' + roleFieldMarkup(values.role) + '</select><span class="field-feedback">Hak akses modul mengikuti peran dan matriks hak akses.</span></div>' +
        '<div class="field" id="userPoliField"><label for="userPoli">Poli penempatan</label><select class="input" id="userPoli" name="poli">' + poliFieldMarkup(values.poli || 'umum') + '</select><span class="field-feedback">Khusus dokter, menentukan poli pada antrean dan pemeriksaan.</span></div>' +
        '<div class="field"><label for="userPassword">' + (editing ? 'Password (gunakan reset email)' : 'Password awal <span class="req">*</span>') + '</label><input class="input" id="userPassword" name="password" type="password" placeholder="Minimal 8 karakter" autocomplete="new-password"' + (editing ? ' disabled' : ' required') + '><span class="field-feedback">' + (editing ? 'Gunakan tombol reset untuk mengubah password.' : 'Sampaikan password awal kepada pengguna.') + '</span></div>' +
        '<div class="field"><label for="userPasswordConfirm">Konfirmasi password</label><input class="input" id="userPasswordConfirm" name="passwordConfirm" type="password" placeholder="Ulangi password" autocomplete="new-password"' + (editing ? ' disabled' : ' required') + '></div>' +
      '</div>' +
      (!editing ? '<label class="check-card compact"><input type="checkbox" id="userActive" name="active" checked><span class="check-card-icon">' + ui.icon('user-check') + '</span><span class="check-card-copy"><strong>Aktifkan akun setelah dibuat</strong><small>Akun aktif dapat langsung digunakan untuk masuk ke sistem.</small></span><span class="switch"></span></label>' : '<div class="inline-alert inline-alert-info">' + ui.icon('info') + '<span>Status keaktifan akun diubah melalui tombol kunci pada daftar pengguna.</span></div>') +
    '</form>';

    const layer = ui.modal({
      title: editing ? 'Ubah Data Pengguna' : 'Tambah Pengguna Baru',
      subtitle: editing ? 'Perbarui identitas, peran, atau kata sandi akun.' : 'Buat akun petugas baru untuk mengakses Sehat Bersama - Puskesmas Arbes.',
      icon: editing ? 'edit' : 'user-plus',
      size: 'md',
      content: content,
      footer: '<button type="button" class="btn btn-secondary" data-modal-close>Batal</button><button type="button" class="btn btn-primary" id="saveUserBtn">' + ui.icon('check') + (editing ? 'Simpan Perubahan' : 'Buat Akun') + '</button>',
      onMount: function (element) {
        const form = element.querySelector('#userForm');
        const role = element.querySelector('#userRole');
        const poliField = element.querySelector('#userPoliField');
        const togglePoli = function () {
          const isDoctor = role.value === 'dokter';
          poliField.hidden = !isDoctor;
          if (isDoctor && !element.querySelector('#userPoli').value) element.querySelector('#userPoli').value = 'umum';
        };
        role.addEventListener('change', togglePoli);
        togglePoli();
        element.querySelector('#saveUserBtn').addEventListener('click', async function () {
          const errorHost = element.querySelector('#userFormError');
          errorHost.innerHTML = '';
          const password = element.querySelector('#userPassword').value;
          const confirmation = element.querySelector('#userPasswordConfirm').value;
          if (password !== confirmation) {
            errorHost.innerHTML = ui.formError('Konfirmasi password belum sama.');
            element.querySelector('#userPasswordConfirm').focus();
            return;
          }
          const payload = {
            name: element.querySelector('#userName').value,
            username: element.querySelector('#userUsername').value,
            phone: element.querySelector('#userPhone').value,
            email: element.querySelector('#userEmail').value,
            role: role.value,
            poli: element.querySelector('#userPoli').value,
            password: password
          };
          try {
            if (editing) {
              const result = await NS.apiRequest('/api/admin/update-user', Object.assign({ id: user.id }, payload));
              store.acceptServerUser(result.user, false);
              ui.toast('Data pengguna @' + payload.username + ' berhasil diperbarui.', 'success');
            } else {
              payload.active = element.querySelector('#userActive').checked;
              const result = await NS.apiRequest('/api/admin/create-user', payload);
              const created = store.acceptServerUser(result.user, false);
              ui.toast('Akun @' + created.username + ' berhasil dibuat dan tersedia untuk login.', 'success');
            }
            ui.closeModal();
            refreshUsers(document.getElementById('mainContent'));
          } catch (error) {
            errorHost.innerHTML = ui.formError(error.message);
            const input = errorHost.scrollIntoView({ block: 'nearest' });
            void input;
          }
        });
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          element.querySelector('#saveUserBtn').click();
        });
      }
    });
    if (!layer) ui.toast('Tidak dapat membuka formulir pengguna.', 'error');
  }

  function resetPasswordModal(user) {
    if (!isAdmin()) return;
    ui.modal({
      title: 'Kirim tautan reset password',
      subtitle: 'Firebase mengirim tautan reset ke email akun pengguna.',
      icon: 'mail', size: 'sm',
      content: '<div class="inline-alert inline-alert-info">' + ui.icon('info') + '<span>Reset akun <strong>@' + ui.esc(user.username) + '</strong>. Email: <strong>' + ui.esc(user.email || 'Belum diatur') + '</strong>. Akun demo lokal tidak menerima email reset.</span></div><div id="resetUserError" class="form-error-host" style="margin-top:12px"></div>',
      footer: '<button type="button" class="btn btn-secondary" data-modal-close>Batal</button><button type="button" class="btn btn-primary" id="confirmResetUserBtn">' + ui.icon('mail') + 'Kirim tautan ke email</button>',
      onMount: function (element) {
        element.querySelector('#confirmResetUserBtn').addEventListener('click', async function () {
          const btn = element.querySelector('#confirmResetUserBtn'); btn.disabled = true;
          try {
            const result = await NS.apiRequest('/api/admin/send-reset', { id: user.id });
            ui.closeModal(); ui.toast(result.message, 'success');
          } catch (error) { element.querySelector('#resetUserError').innerHTML = ui.formError(error.message); }
          finally { btn.disabled = false; }
        });
      }
    });
  }

  async function handleUserAction(button, root) {
    const action = button.dataset.userAction;
    const user = store.users().find(function (item) { return item.id === button.dataset.id; });
    if (!user) return;
    try {
      if (action === 'edit') {
        openUserModal(user);
      } else if (action === 'reset') {
        resetPasswordModal(user);
      } else if (action === 'toggle') {
        const activating = !user.active;
        const confirmed = await ui.confirm(
          activating
            ? 'Aktifkan kembali akun @' + user.username + '? Pengguna akan dapat masuk ke sistem sesuai perannya.'
            : 'Nonaktifkan akun @' + user.username + '? Pengguna tidak akan dapat masuk sampai akun diaktifkan kembali.',
          {
            title: activating ? 'Aktifkan akun pengguna' : 'Nonaktifkan akun pengguna',
            okText: activating ? 'Ya, aktifkan' : 'Ya, nonaktifkan',
            danger: !activating
          }
        );
        if (!confirmed) return;
        const result = await NS.apiRequest('/api/admin/toggle-user', { id: user.id });
        store.acceptServerUser(result.user, false);
        ui.toast('Akun @' + user.username + (activating ? ' berhasil diaktifkan.' : ' berhasil dinonaktifkan.'), 'success');
        refreshUsers(root);
      }
    } catch (error) {
      ui.showError(error);
    }
  }

  function exportUsers() {
    const list = filteredUsers();
    ui.exportCsv('pengguna-' + NS.core.dateKey() + '.csv', ['Nama', 'Username', 'Peran', 'Poli', 'Telepon', 'Status', 'Dibuat', 'Login Terakhir'], list.map(function (user) {
      return [user.name, user.username, NS.core.getRoleMeta(user.role).label, poliLabel(user), user.phone, user.active ? 'Aktif' : 'Nonaktif', user.createdAt || '', user.lastLogin || ''];
    }));
  }

  function exportAudit() {
    const entries = auditEntries();
    ui.exportCsv('log-aktivitas-' + NS.core.dateKey() + '.csv', ['Waktu', 'Petugas', 'Peran', 'Modul', 'Aksi', 'Deskripsi'], entries.map(function (entry) {
      return [entry.createdAt || '', entry.userName || 'Sistem', NS.core.getRoleMeta(entry.userRole).label, entry.module || '', entry.action || '', entry.description || ''];
    }));
  }

  function bindUsers(root) {
    root.querySelectorAll('[data-user-action]').forEach(function (button) {
      button.addEventListener('click', function () { handleUserAction(button, root); });
    });
    const add = root.querySelector('#addUserBtn');
    if (add) add.addEventListener('click', function () { openUserModal(null); });
    const exportBtn = root.querySelector('#userExportBtn');
    if (exportBtn) exportBtn.addEventListener('click', function () { if (state.tab === 'audit') exportAudit(); else exportUsers(); });
  }

  function bindUserFilters(root) {
    const search = root.querySelector('#userSearch');
    if (search) {
      search.addEventListener('input', ui.debounce(function () {
        state.search = search.value;
        state.page = 1;
        refreshUsers(root);
        focusField(root, '#userSearch');
      }, 220));
    }
    const role = root.querySelector('#userRoleFilter');
    if (role) role.addEventListener('change', function () { state.role = role.value; state.page = 1; refreshUsers(root); });
    const status = root.querySelector('#userStatusFilter');
    if (status) status.addEventListener('change', function () { state.status = status.value; state.page = 1; refreshUsers(root); });
    const pageSize = root.querySelector('#userPageSize');
    if (pageSize) pageSize.addEventListener('change', function () { state.perPage = Number(pageSize.value); state.page = 1; refreshUsers(root); });
    const reset = function () {
      state.search = '';
      state.role = '';
      state.status = '';
      state.page = 1;
      refreshUsers(root);
    };
    const resetBtn = root.querySelector('#userFilterReset');
    if (resetBtn) resetBtn.addEventListener('click', reset);
    const emptyReset = root.querySelector('#userEmptyReset');
    if (emptyReset) emptyReset.addEventListener('click', reset);
    const clear = root.querySelector('#userSearchClear');
    if (clear) clear.addEventListener('click', reset);
    root.querySelectorAll('[data-page]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.page = Number(button.dataset.page) || 1;
        refreshUsers(root);
      });
    });
  }

  function bindAuditFilters(root) {
    const search = root.querySelector('#auditSearch');
    if (search) {
      search.addEventListener('input', ui.debounce(function () {
        state.auditSearch = search.value;
        state.auditPage = 1;
        refreshUsers(root);
        focusField(root, '#auditSearch');
      }, 220));
    }
    const module = root.querySelector('#auditModuleFilter');
    if (module) module.addEventListener('change', function () { state.auditModule = module.value; state.auditPage = 1; refreshUsers(root); });
    const user = root.querySelector('#auditUserFilter');
    if (user) user.addEventListener('change', function () { state.auditUser = user.value; state.auditPage = 1; refreshUsers(root); });
    const pageSize = root.querySelector('#auditPageSize');
    if (pageSize) pageSize.addEventListener('change', function () { state.auditPerPage = Number(pageSize.value); state.auditPage = 1; refreshUsers(root); });
    const reset = function () {
      state.auditSearch = '';
      state.auditModule = '';
      state.auditUser = '';
      state.auditPage = 1;
      refreshUsers(root);
    };
    const resetBtn = root.querySelector('#auditFilterReset');
    if (resetBtn) resetBtn.addEventListener('click', reset);
    const emptyReset = root.querySelector('#auditEmptyReset');
    if (emptyReset) emptyReset.addEventListener('click', reset);
    const clear = root.querySelector('#auditSearchClear');
    if (clear) clear.addEventListener('click', reset);
    root.querySelectorAll('[data-page]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.auditPage = Number(button.dataset.page) || 1;
        refreshUsers(root);
      });
    });
  }

  function focusField(root, selector) {
    const input = root.querySelector(selector);
    if (!input) return;
    input.focus();
    try { input.setSelectionRange(input.value.length, input.value.length); } catch (error) { /* noop */ }
  }

  function render(root, tab) {
    if (tab === 'audit' || tab === 'daftar') state.tab = tab;
    if (!['daftar', 'audit'].includes(state.tab)) state.tab = 'daftar';
    root.innerHTML = headerMarkup() + statCardsMarkup() + toolbarMarkup() +
      '<div id="usersBody">' + (state.tab === 'audit' ? auditTabMarkup() : usersTabMarkup(root)) + '</div>';
    bindUsers(root);
    root.querySelectorAll('.tabs .tab[data-tab]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.tab = button.dataset.tab;
        state.page = 1;
        state.auditPage = 1;
        render(root, state.tab);
      });
    });
    if (state.tab === 'audit') bindAuditFilters(root);
    else bindUserFilters(root);
  }

  /* ------------------------------------------------------------------------
     Matriks hak akses
     ------------------------------------------------------------------------ */
  function accessCard(role, editable) {
    const meta = NS.core.getRoleMeta(role);
    const pages = role === 'admin' ? C.PAGES.map(function (page) { return page.id; }) : store.getAccessPages(role);
    const locked = role === 'admin' || !editable;
    const staff = roleCount(role);
    return '<section class="card access-role-card" data-role-card="' + ui.attr(role) + '">' +
      '<div class="access-role-head">' +
        '<span class="avatar" style="--avatar-tone:' + ui.attr(meta.color) + '">' + ui.esc(ui.initials(meta.label)) + '</span>' +
        '<div class="access-role-copy"><strong>' + ui.esc(meta.label) + (role === 'admin' ? ' <span class="badge badge-success">Akses penuh</span>' : '') + '</strong><p>' + ui.esc(meta.description) + ' · ' + ui.number(staff) + ' akun</p></div>' +
        '<div class="access-role-actions">' +
          (role === 'admin' ? '<span class="badge badge-muted">' + ui.icon('lock') + 'Terkunci</span>' :
            editable ? '<button type="button" class="btn btn-ghost btn-sm" data-reset-role="' + ui.attr(role) + '">' + ui.icon('refresh') + 'Bawaan</button><button type="button" class="btn btn-primary btn-sm" data-save-role="' + ui.attr(role) + '">' + ui.icon('check') + 'Simpan</button>' : '<span class="badge badge-muted">Hanya lihat</span>') +
        '</div>' +
      '</div>' +
      '<div class="access-checks">' +
        C.PAGES.map(function (page) {
          const checked = pages.includes(page.id);
          const isDashboard = page.id === 'dashboard';
          return '<label class="access-check' + (locked ? ' is-locked' : '') + '">' +
            '<input type="checkbox" data-access-page="' + ui.attr(page.id) + '" value="' + ui.attr(page.id) + '"' + (checked ? ' checked' : '') + (locked || isDashboard ? ' disabled' : '') + '>' +
            ui.icon(page.icon) + '<span>' + ui.esc(page.label) + '</span>' +
          '</label>';
        }).join('') +
      '</div>' +
      '<div class="access-note">' +
        (role === 'admin'
          ? 'Administrator selalu memiliki akses ke seluruh modul, termasuk pengguna, hak akses, dan pengaturan.'
          : 'Dashboard selalu aktif. Izin tindakan operasional (misalnya membayar atau menyerahkan obat) tetap mengikuti peran, terlepas dari akses modul.') +
      '</div>' +
      '<div class="access-note" style="padding-top:0"><strong>Izin tindakan:</strong> ' +
        (role === 'admin' ? 'semua tindakan' : (C.CAPABILITIES[role] || []).map(function (capability) { return CAPABILITY_LABELS[capability] || capability; }).join(', ')) +
      '</div>' +
    '</section>';
  }

  function access(root) {
    const editable = isAdmin();
    const actions = editable ? '<button type="button" class="btn btn-secondary" id="accessResetAll">' + ui.icon('refresh') + 'Reset Semua ke Bawaan</button><button type="button" class="btn btn-primary" id="accessSaveAll">' + ui.icon('check') + 'Simpan Semua</button>' : '';
    root.innerHTML = ui.pageHeader({
      eyebrow: 'Kontrol akses',
      title: 'Matriks Hak Akses Peran',
      description: 'Atur modul yang dapat diakses oleh setiap peran. Perubahan berlaku langsung untuk seluruh pengguna dengan peran tersebut.',
      actions: actions
    }) +
    '<div class="access-intro"><span>' + ui.icon('shield') + '</span><div><strong>Akses modul berbeda dengan izin tindakan</strong><p>Hak akses modul menentukan halaman yang dapat dibuka. Izin tindakan operasional seperti memverifikasi BPJS, membatalkan antrean, atau menyerahkan obat tetap mengikuti peran pengguna. Administrator selalu memiliki akses penuh dan tidak dapat dibatasi.</p></div></div>' +
    '<div class="access-matrix">' +
      C.ROLE_ORDER.map(function (role) { return accessCard(role, editable); }).join('') +
    '</div>' +
    '<div class="report-note">' + ui.icon('info') + '<span>Perubahan hak akses dicatat pada audit log. Pengguna yang sedang masuk akan melihat menu baru pada pemuatan halaman berikutnya. Dashboard tidak dapat dinonaktifkan untuk menjaga navigasi dasar setiap peran.</span></div>';

    if (!editable) return;

    root.querySelectorAll('[data-save-role]').forEach(function (button) {
      button.addEventListener('click', function () {
        const role = button.dataset.saveRole;
        const card = root.querySelector('[data-role-card="' + role + '"]');
        const pages = Array.from(card.querySelectorAll('input[data-access-page]:checked')).map(function (input) { return input.value; });
        try {
          store.setRoleAccess(role, pages);
          ui.toast('Hak akses peran ' + NS.core.getRoleMeta(role).label + ' berhasil disimpan.', 'success');
          access(root);
        } catch (error) {
          ui.showError(error);
        }
      });
    });

    root.querySelectorAll('[data-reset-role]').forEach(function (button) {
      button.addEventListener('click', async function () {
        const role = button.dataset.resetRole;
        const confirmed = await ui.confirm('Kembalikan hak akses peran ' + NS.core.getRoleMeta(role).label + ' ke pengaturan bawaan?', {
          title: 'Reset hak akses',
          okText: 'Ya, kembalikan',
          danger: false
        });
        if (!confirmed) return;
        try {
          store.setRoleAccess(role, C.DEFAULT_ACCESS[role]);
          ui.toast('Hak akses ' + NS.core.getRoleMeta(role).label + ' dikembalikan ke bawaan.', 'success');
          access(root);
        } catch (error) {
          ui.showError(error);
        }
      });
    });

    root.querySelector('#accessSaveAll').addEventListener('click', function () {
      try {
        C.ROLE_ORDER.filter(function (role) { return role !== 'admin'; }).forEach(function (role) {
          const card = root.querySelector('[data-role-card="' + role + '"]');
          if (!card) return;
          const pages = Array.from(card.querySelectorAll('input[data-access-page]:checked')).map(function (input) { return input.value; });
          store.setRoleAccess(role, pages);
        });
        ui.toast('Seluruh perubahan hak akses berhasil disimpan.', 'success');
        access(root);
      } catch (error) {
        ui.showError(error);
      }
    });

    root.querySelector('#accessResetAll').addEventListener('click', async function () {
      const confirmed = await ui.confirm('Kembalikan hak akses semua peran (kecuali administrator) ke pengaturan bawaan?', {
        title: 'Reset seluruh hak akses',
        okText: 'Ya, reset semua',
        danger: true
      });
      if (!confirmed) return;
      try {
        C.ROLE_ORDER.filter(function (role) { return role !== 'admin'; }).forEach(function (role) {
          store.setRoleAccess(role, C.DEFAULT_ACCESS[role]);
        });
        ui.toast('Hak akses seluruh peran berhasil dikembalikan ke bawaan.', 'success');
        access(root);
      } catch (error) {
        ui.showError(error);
      }
    });
  }

  /* ------------------------------------------------------------------------
     Pengaturan puskesmas
     ------------------------------------------------------------------------ */
  function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) return value + ' B';
    if (value < 1024 * 1024) return (value / 1024).toFixed(1) + ' KB';
    return (value / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function dataUsage() {
    let bytes = 0;
    try {
      const raw = store.exportJSON();
      bytes = typeof Blob !== 'undefined' ? new Blob([raw]).size : raw.length * 2;
    } catch (error) {
      bytes = 0;
    }
    return { bytes: bytes, percent: Math.min(100, Math.round((bytes / (5 * 1024 * 1024)) * 100)) };
  }

  function settings(root) {
    const admin = isAdmin();
    const clinic = store.clinic;
    const meta = store.meta;
    const usage = dataUsage();
    const counts = {
      patients: store.patients().length,
      queues: store.queues().length,
      exams: store.exams().length,
      bills: store.bills().length,
      medicines: store.medicines().length,
      users: store.users().length
    };
    const fields = [
      { name: 'nama', label: 'Nama puskesmas', value: clinic.nama, required: true },
      { name: 'instansi', label: 'Nama instansi', value: clinic.instansi },
      { name: 'kodeFaskes', label: 'Kode faskes', value: clinic.kodeFaskes, mono: true },
      { name: 'kepala', label: 'Kepala puskesmas', value: clinic.kepala },
      { name: 'telepon', label: 'Telepon', value: clinic.telepon },
      { name: 'whatsapp', label: 'WhatsApp', value: clinic.whatsapp },
      { name: 'email', label: 'Email', value: clinic.email, type: 'email' },
      { name: 'jamOperasional', label: 'Jam operasional', value: clinic.jamOperasional }
    ];
    const formFields = fields.map(function (field) {
      const type = field.type || 'text';
      return '<div class="field"><label for="clinic' + field.name.charAt(0).toUpperCase() + field.name.slice(1) + '">' + ui.esc(field.label) + (field.required ? ' <span class="req">*</span>' : '') + '</label><input class="input' + (field.mono ? ' mono' : '') + '" type="' + ui.attr(type) + '" id="clinic' + field.name.charAt(0).toUpperCase() + field.name.slice(1) + '" name="' + ui.attr(field.name) + '" value="' + ui.attr(field.value || '') + '"' + (field.required ? ' required' : '') + (admin ? '' : ' disabled') + '></div>';
    }).join('');

    root.innerHTML = ui.pageHeader({
      eyebrow: 'Konfigurasi sistem',
      title: 'Pengaturan Puskesmas',
      description: 'Perbarui identitas fasilitas, informasi kontak, dan kelola data lokal aplikasi Sehat Bersama - Puskesmas Arbes.',
      actions: admin ? '<button type="button" class="btn btn-secondary" id="settingsExportBtn">' + ui.icon('download') + 'Ekspor Data JSON</button><button type="button" class="btn btn-danger" id="settingsResetBtn">' + ui.icon('refresh') + 'Reset Data</button>' : ''
    }) +
    '<div class="settings-grid">' +
      '<div class="settings-main">' +
        '<section class="card settings-card">' +
          ui.sectionHeader('Identitas puskesmas', 'Informasi ini digunakan pada kop surat, kuitansi, laporan, dan tampilan antrean publik.', '', 'building') +
          '<div class="settings-card-body">' +
            (!admin ? '<div class="inline-alert inline-alert-info">' + ui.icon('info') + '<span>Pengaturan hanya dapat diubah oleh administrator. Anda dapat melihat konfigurasi yang berlaku.</span></div>' : '') +
            '<form id="clinicSettingsForm" novalidate><div id="clinicSettingsError" class="form-error-host"></div><div class="form-grid-2">' + formFields +
              '<div class="field full"><label for="clinicAlamat">Alamat lengkap</label><textarea class="input textarea" id="clinicAlamat" name="alamat" rows="3"' + (admin ? '' : ' disabled') + '>' + ui.esc(clinic.alamat || '') + '</textarea></div>' +
              '<div class="field full"><label for="clinicMotto">Motto layanan</label><input class="input" type="text" id="clinicMotto" name="motto" value="' + ui.attr(clinic.motto || '') + '"' + (admin ? '' : ' disabled') + '><span class="field-feedback">Ditampilkan pada layar antrean publik dan dokumen resmi.</span></div>' +
            '</div>' +
            (admin ? '<div class="form-actions" style="margin-top:18px"><button type="submit" class="btn btn-primary" id="saveClinicBtn">' + ui.icon('check') + 'Simpan Pengaturan</button></div>' : '') +
            '</form>' +
          '</div>' +
        '</section>' +
        '<section class="card">' +
          ui.sectionHeader('Ringkasan data lokal', 'Volume data yang tersimpan di perangkat ini.', '', 'box') +
          '<div class="settings-dl">' +
            '<div><dt>Pasien terdaftar</dt><dd>' + ui.number(counts.patients) + ' pasien</dd></div>' +
            '<div><dt>Antrean kunjungan</dt><dd>' + ui.number(counts.queues) + ' antrean</dd></div>' +
            '<div><dt>Rekam medis</dt><dd>' + ui.number(counts.exams) + ' pemeriksaan</dd></div>' +
            '<div><dt>Tagihan</dt><dd>' + ui.number(counts.bills) + ' transaksi</dd></div>' +
            '<div><dt>Master obat</dt><dd>' + ui.number(counts.medicines) + ' jenis</dd></div>' +
            '<div><dt>Akun pengguna</dt><dd>' + ui.number(counts.users) + ' akun</dd></div>' +
          '</div>' +
        '</section>' +
      '</div>' +
      '<aside class="settings-aside">' +
        '<section class="card">' +
          '<h3>Informasi sistem</h3>' +
          '<p>Sehat Bersama - Puskesmas Arbes berjalan sepenuhnya di browser tanpa server. Data tersimpan pada <code>localStorage</code> perangkat.</p>' +
          '<div class="data-usage">' +
            '<div class="data-usage-head"><span>Penyimpanan lokal</span><strong>' + formatBytes(usage.bytes) + '</strong></div>' +
            '<div class="data-usage-track"><div class="data-usage-fill" style="width:' + usage.percent + '%"></div></div>' +
            '<div class="data-usage-head" style="margin-top:4px"><span>Perkiraan kuota terpakai</span><span>' + usage.percent + '% dari 5 MB</span></div>' +
          '</div>' +
          '<dl class="settings-dl">' +
            '<div><dt>Versi aplikasi</dt><dd>v' + ui.esc(C.APP_VERSION) + '</dd></div>' +
            '<div><dt>Sprint</dt><dd>' + ui.esc(C.SPRINT) + '</dd></div>' +
            '<div><dt>Versi seed</dt><dd>' + ui.esc(meta.seedVersion || 1) + '</dd></div>' +
            '<div><dt>Data dibuat</dt><dd>' + ui.esc(ui.fmtDate(meta.createdAt, 'medium')) + '</dd></div>' +
          '</dl>' +
        '</section>' +
        '<section class="card danger-zone">' +
          ui.sectionHeader('Zona berbahaya', 'Tindakan berikut tidak dapat dibatalkan.', '', 'alert') +
          '<p>Reset data akan menghapus seluruh pasien, antrean, rekam medis, tagihan, dan perubahan pengaturan pada perangkat ini, lalu memuat ulang data demonstrasi.</p>' +
          '<div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">' +
            '<button type="button" class="btn btn-secondary btn-block" id="settingsExportSideBtn">' + ui.icon('download') + 'Unduh Cadangan JSON</button>' +
            (admin ? '<button type="button" class="btn btn-danger btn-block" id="settingsResetSideBtn">' + ui.icon('trash') + 'Reset Seluruh Data</button>' : '') +
          '</div>' +
          '<p style="margin-top:10px;font-size:0.63rem">Disarankan mengunduh cadangan sebelum melakukan reset.</p>' +
        '</section>' +
      '</aside>' +
    '</div>';

    const saveForm = root.querySelector('#clinicSettingsForm');
    if (saveForm) {
      saveForm.addEventListener('submit', function (event) {
        event.preventDefault();
        const errorHost = root.querySelector('#clinicSettingsError');
        errorHost.innerHTML = '';
        const values = ui.readForm(saveForm);
        if (!String(values.nama || '').trim()) {
          errorHost.innerHTML = ui.formError('Nama puskesmas wajib diisi.');
          return;
        }
        try {
          store.updateClinicSettings(values);
          if (NS.app && typeof NS.app.refreshChrome === 'function') NS.app.refreshChrome();
          ui.toast('Identitas dan pengaturan puskesmas berhasil disimpan.', 'success');
          settings(root);
        } catch (error) {
          errorHost.innerHTML = ui.formError(error.message);
        }
      });
    }

    const exportJson = function () {
      try {
        ui.downloadFile('puskesmas-arbes-backup-' + NS.core.dateKey() + '.json', store.exportJSON(), 'application/json');
        ui.toast('Cadangan data berhasil diunduh.', 'success');
      } catch (error) {
        ui.showError(error);
      }
    };
    ['settingsExportBtn', 'settingsExportSideBtn'].forEach(function (id) {
      const button = root.querySelector('#' + id);
      if (button) button.addEventListener('click', exportJson);
    });
    ['settingsResetBtn', 'settingsResetSideBtn'].forEach(function (id) {
      const button = root.querySelector('#' + id);
      if (button) button.addEventListener('click', function () { openResetDataModal(); });
    });
  }

  function openResetDataModal() {
    if (!isAdmin()) return;
    const content = '<div class="inline-alert inline-alert-error">' + ui.icon('alert') + '<span><strong>Seluruh data lokal akan dihapus.</strong> Pasien, kunjungan, rekam medis, resep, tagihan, pengguna tambahan, dan perubahan pengaturan akan kembali ke data demonstrasi awal.</span></div>' +
      '<div class="field" style="margin-top:14px"><label for="resetDataConfirm">Ketik <strong>RESET</strong> untuk mengonfirmasi</label><input class="input mono" id="resetDataConfirm" type="text" placeholder="RESET" autocomplete="off"><span class="field-feedback">Tindakan ini tidak dapat dibatalkan.</span></div>' +
      '<div id="resetDataError" class="form-error-host" style="margin-top:10px"></div>';
    ui.modal({
      title: 'Reset Seluruh Data',
      subtitle: 'Muat ulang data demonstrasi Sehat Bersama - Puskesmas Arbes.',
      icon: 'alert',
      size: 'sm',
      content: content,
      footer: '<button type="button" class="btn btn-secondary" data-modal-close>Batal</button><button type="button" class="btn btn-danger" id="confirmResetDataBtn">' + ui.icon('trash') + 'Hapus & Reset Data</button>',
      onMount: function (element) {
        const input = element.querySelector('#resetDataConfirm');
        const errorHost = element.querySelector('#resetDataError');
        element.querySelector('#confirmResetDataBtn').addEventListener('click', function () {
          errorHost.innerHTML = '';
          if (String(input.value).trim().toUpperCase() !== 'RESET') {
            errorHost.innerHTML = ui.formError('Ketik RESET dengan huruf kapital untuk melanjutkan.');
            input.focus();
            return;
          }
          try {
            store.resetAll();
            ui.closeModal();
            ui.toast('Data demonstrasi berhasil dimuat ulang.', 'success');
            if (NS.app && typeof NS.app.refreshChrome === 'function') NS.app.refreshChrome();
            if (NS.app && typeof NS.app.refresh === 'function') NS.app.refresh();
            else location.hash = '#/dashboard';
          } catch (error) {
            errorHost.innerHTML = ui.formError(error.message);
          }
        });
        input.focus();
      }
    });
  }

  /* ------------------------------------------------------------------------
     Profil & keamanan
     ------------------------------------------------------------------------ */
  function profileActivity(user) {
    return store.auditLog({ userId: user.id }).slice(0, 10);
  }

  function profile(root) {
    const user = currentUser();
    if (!user) return;
    const meta = NS.core.getRoleMeta(user.role);
    const accesses = user.role === 'admin' ? C.PAGES : C.PAGES.filter(function (page) { return store.hasAccess(page.id); });
    const session = store.getSession() || {};
    const activity = profileActivity(user);
    const tasks = store.auditLog({ userId: user.id }).length;
    const created = ui.fmtDate(user.createdAt, 'medium');
    root.innerHTML = ui.pageHeader({
      eyebrow: 'Akun saya',
      title: 'Profil & Keamanan',
      description: 'Kelola identitas akun, kata sandi, dan tinjau aktivitas serta hak akses Anda.',
      actions: '<a href="#/dashboard" class="btn btn-secondary">' + ui.icon('dashboard') + 'Kembali ke Dashboard</a>'
    }) +
    '<section class="profile-hero">' +
      '<div class="profile-identity">' + ui.avatar(user.name, 'xl') +
        '<div><h2>' + ui.esc(user.name) + '</h2><p>@' + ui.esc(user.username) + ' · ' + ui.esc(meta.description || '') + '</p>' + ui.roleBadge(user.role) + (user.poli ? ' ' + ui.poliBadge(user.poli) : '') + '</div>' +
      '</div>' +
      '<div class="profile-hero-stats">' +
        '<div><span>Status akun</span><strong>' + statusMarkup(user.active) + '</strong></div>' +
        '<div><span>Bergabung</span><strong>' + ui.esc(created) + '</strong></div>' +
        '<div><span>Login terakhir</span><strong>' + ui.esc(user.lastLogin ? ui.relativeTime(user.lastLogin) : 'Belum pernah') + '</strong></div>' +
        '<div><span>Aktivitas tercatat</span><strong>' + ui.number(tasks) + ' aktivitas</strong></div>' +
      '</div>' +
    '</section>' +
    '<div class="profile-grid">' +
      '<div class="profile-main">' +
        '<section class="card profile-card">' +
          ui.sectionHeader('Informasi profil', 'Nama dan nomor telepon digunakan pada dokumen dan komunikasi puskesmas.', '', 'user') +
          '<div class="profile-card-body">' +
            '<form id="profileForm" class="security-form" novalidate>' +
              '<div id="profileError" class="form-error-host"></div>' +
              '<div class="form-grid-2">' +
                '<div class="field full"><label for="profileName">Nama lengkap</label><input class="input" id="profileName" name="name" type="text" value="' + ui.attr(user.name) + '" required></div>' +
                '<div class="field"><label for="profileUsername">Username</label><input class="input mono" id="profileUsername" type="text" value="' + ui.attr(user.username) + '" readonly></div>' +
                '<div class="field"><label for="profilePhone">Nomor telepon</label><input class="input" id="profilePhone" name="phone" type="tel" value="' + ui.attr(user.phone) + '"></div>' +
                '<div class="field"><label for="profileRole">Peran</label><input class="input" id="profileRole" type="text" value="' + ui.attr(meta.label) + '" readonly></div>' +
                '<div class="field"><label for="profilePoli">Poli penempatan</label><input class="input" id="profilePoli" type="text" value="' + ui.attr(user.poli ? NS.core.getPoli(user.poli).nama : 'Semua poli / tidak spesifik') + '" readonly></div>' +
              '</div>' +
              '<div class="form-actions"><button type="submit" class="btn btn-primary">' + ui.icon('check') + 'Simpan Profil</button></div>' +
            '</form>' +
          '</div>' +
        '</section>' +
        '<section class="card profile-card" id="securityCard">' +
          ui.sectionHeader('Keamanan akun', 'Gunakan password yang kuat dan tidak digunakan di layanan lain.', '', 'lock') +
          '<div class="profile-card-body">' +
            '<form id="passwordForm" class="security-form" novalidate>' +
              '<div id="passwordError" class="form-error-host"></div>' +
              '<div class="field"><label for="currentPassword">Password saat ini</label><input class="input" id="currentPassword" type="password" autocomplete="current-password" required></div>' +
              '<div class="form-grid-2">' +
                '<div class="field"><label for="newPassword">Password baru</label><input class="input" id="newPassword" type="password" autocomplete="new-password" required><span class="field-feedback">Minimal 8 karakter dan berbeda dari password lama.</span></div>' +
                '<div class="field"><label for="confirmPassword">Konfirmasi password baru</label><input class="input" id="confirmPassword" type="password" autocomplete="new-password" required></div>' +
              '</div>' +
              '<div class="form-actions"><button type="submit" class="btn btn-primary">' + ui.icon('key') + 'Ubah Password</button></div>' +
            '</form>' +
          '</div>' +
        '</section>' +
        '<section class="card profile-card">' +
          ui.sectionHeader('Aktivitas terbaru saya', 'Sepuluh aktivitas terakhir yang tercatat pada audit log.', '<a href="#/pengguna" class="btn btn-ghost btn-sm">Lihat log lengkap ' + ui.icon('arrow-right') + '</a>', 'activity') +
          '<div class="profile-card-body">' +
            (activity.length ? '<div class="activity-list">' + activity.map(function (entry) {
              return '<div class="activity-item"><span class="stat-icon stat-icon-' + (entry.action.indexOf('login') !== -1 ? 'blue' : entry.action.indexOf('password') !== -1 ? 'amber' : 'teal') + '" style="width:32px;height:32px;border-radius:9px">' + ui.icon(actionGroup(entry.action) === 'Keamanan' ? 'lock' : actionGroup(entry.action) === 'Sesi' ? 'user-check' : 'activity') + '</span><div class="activity-copy"><p>' + ui.esc(entry.description) + '</p><small>' + ui.esc(ui.relativeTime(entry.createdAt)) + ' · ' + ui.esc(entry.module) + '</small></div></div>';
            }).join('') + '</div>' : ui.emptyState('activity', 'Belum ada aktivitas', 'Aktivitas akun Anda akan muncul setelah Anda menggunakan sistem.')) +
          '</div>' +
        '</section>' +
      '</div>' +
      '<aside class="profile-aside">' +
        '<section class="card">' +
          '<h3 style="font-size:0.9rem">Detail akun</h3>' +
          '<dl class="settings-dl" style="margin-top:10px">' +
            '<div><dt>Username</dt><dd class="mono">@' + ui.esc(user.username) + '</dd></div>' +
            '<div><dt>Peran</dt><dd>' + ui.esc(meta.label) + '</dd></div>' +
            '<div><dt>Poli</dt><dd>' + ui.esc(user.poli ? NS.core.getPoli(user.poli).nama : '—') + '</dd></div>' +
            '<div><dt>Telepon</dt><dd>' + ui.esc(user.phone || '—') + '</dd></div>' +
            '<div><dt>Dibuat</dt><dd>' + ui.esc(created) + '</dd></div>' +
            '<div><dt>Login terakhir</dt><dd>' + ui.esc(user.lastLogin ? ui.fmtDateTime(user.lastLogin) : 'Belum pernah') + '</dd></div>' +
          '</dl>' +
        '</section>' +
        '<section class="card">' +
          '<h3 style="font-size:0.9rem">Modul yang dapat diakses</h3>' +
          '<p style="margin-top:4px;color:var(--muted);font-size:0.68rem">Berdasarkan peran dan pengaturan hak akses yang berlaku.</p>' +
          '<div class="access-checks" style="grid-template-columns:1fr;padding:12px 0 0">' +
            accesses.map(function (page) { return '<div class="access-check is-locked" style="cursor:default">' + ui.icon(page.icon) + '<span>' + ui.esc(page.label) + '</span></div>'; }).join('') +
          '</div>' +
        '</section>' +
        '<section class="card">' +
          '<h3 style="font-size:0.9rem">Sesi saat ini</h3>' +
          '<div class="notice-card" style="margin-top:10px;padding:11px 12px">' + ui.icon('shield') + '<div><strong>Perangkat ini tepercaya</strong><span>Masuk sejak ' + ui.esc(session.loginAt ? ui.fmtDateTime(session.loginAt) : 'sesi ini dimulai') + '. Keluar dari akun setelah menggunakan komputer bersama.</span></div></div>' +
          '<button type="button" class="btn btn-secondary btn-block" id="profileLogoutBtn" style="margin-top:10px">' + ui.icon('logout') + 'Keluar dari akun</button>' +
        '</section>' +
      '</aside>' +
    '</div>';

    const profileForm = root.querySelector('#profileForm');
    profileForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      const host = root.querySelector('#profileError');
      host.innerHTML = '';
      try {
        const changes = { name: root.querySelector('#profileName').value, phone: root.querySelector('#profilePhone').value };
        await NS.apiRequest('/api/auth/update-profile', changes);
        store.updateOwnProfile(changes);
        if (NS.app && typeof NS.app.refreshChrome === 'function') NS.app.refreshChrome();
        ui.toast('Profil berhasil diperbarui.', 'success');
        profile(root);
      } catch (error) {
        host.innerHTML = ui.formError(error.message);
      }
    });

    const passwordForm = root.querySelector('#passwordForm');
    passwordForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      const host = root.querySelector('#passwordError');
      host.innerHTML = '';
      try {
        const oldPass = root.querySelector('#currentPassword').value;
        const newPass = root.querySelector('#newPassword').value;
        if (newPass !== root.querySelector('#confirmPassword').value) throw new Error('Konfirmasi password tidak sama.');
        if (newPass === oldPass) throw new Error('Password baru harus berbeda.');
        await NS.apiRequest('/api/auth/change-password', { currentPassword: oldPass, newPassword: newPass });
        ui.toast('Password berhasil diubah. Silakan login kembali.', 'success');
        NS.app.logout(true);
      } catch (error) {
        host.innerHTML = ui.formError(error.message);
      }
    });

    root.querySelector('#profileLogoutBtn').addEventListener('click', function () {
      if (NS.app && typeof NS.app.logout === 'function') NS.app.logout();
    });
  }

  NS.pages = NS.pages || {};
  NS.pages.users = {
    render: render,
    access: access,
    settings: settings,
    profile: profile
  };
})(window);
