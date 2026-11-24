/* ==========================================================================
   Sehat Bersama - Puskesmas Arbes — Shell aplikasi, autentikasi, dan router
   ========================================================================== */
(function (window) {
  'use strict';

  const NS = window.PK;
  const ui = NS.ui;
  const store = NS.store;
  const C = NS.constants;

  const DB_KEY = 'sehat-bersama.db.v3';
  const SESSION_KEY = 'sehat-bersama.session.v3';

  const ACTIVE_QUEUE_STATUS = ['menunggu', 'dipanggil', 'dilayani'];
  const REPORT_TABS = ['ringkasan', 'kunjungan', 'poli', 'penyakit', 'obat', 'petugas'];
  const PHARMACY_TABS = ['resep', 'obat', 'stok', 'laporan'];

  // Satu origin dengan server lokal Python. Firebase REST dipanggil oleh server, bukan browser.
  async function apiRequest(path, payload) {
    let response;
    try {
      response = await fetch(path, { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload || {}) });
    } catch (error) { throw new Error('Server lokal tidak aktif. Jalankan python app.py dan buka http://127.0.0.1:4173 (bukan file://).'); }
    let data;
    try { data = await response.json(); } catch (error) { throw new Error('Server lokal tidak memberikan respons yang benar.'); }
    if (!response.ok || !data.ok) throw new Error(data.message || 'Permintaan tidak berhasil.');
    return data;
  }
  NS.apiRequest = apiRequest;

  const DEMO_ACCOUNTS = [
    { role: 'Administrator', username: 'admin', password: 'admin123' },
    { role: 'Petugas Pendaftaran', username: 'pendaftaran', password: '123456' },
    { role: 'Dokter', username: 'dokter', password: '123456' },
    { role: 'Perawat', username: 'perawat', password: '123456' },
    { role: 'Petugas Farmasi', username: 'farmasi', password: '123456' },
    { role: 'Petugas Kasir', username: 'kasir', password: '123456' }
  ];

  const AUTH_FEATURES = [
    { icon: 'users', title: 'Pendaftaran & antrean', text: 'Identitas pasien, NIK/BPJS, nomor antrean per poli.' },
    { icon: 'stethoscope', title: 'Rekam medis elektronik', text: 'Tanda vital, diagnosis ICD-10, tindakan, dan resep.' },
    { icon: 'pill', title: 'Farmasi & kasir', text: 'Stok obat, penyerahan resep, verifikasi BPJS, dan kuitansi.' },
    { icon: 'chart', title: 'Laporan terpadu', text: 'Kunjungan, penyakit, obat, kinerja petugas, dan ekspor CSV.' }
  ];

  const els = {};
  let clockTimer = null;
  let displayActive = false;
  let currentRoute = null;
  let intendedHash = '';

  /* ------------------------------------------------------------------------
     Utilitas dasar
     ------------------------------------------------------------------------ */
  function byId(id) {
    return document.getElementById(id);
  }

  function cacheElements() {
    els.skipLink = document.querySelector('.skip-link');
    els.authView = byId('authView');
    els.displayView = byId('displayView');
    els.appView = byId('appView');
    els.sidebar = byId('sidebar');
    els.sidebarNav = byId('sidebarNav');
    els.sidebarClinic = byId('sidebarClinic');
    els.sprintLabel = byId('sprintLabel');
    els.menuToggle = byId('menuToggle');
    els.topbarEyebrow = byId('topbarEyebrow');
    els.topbarTitle = byId('topbarTitle');
    els.topbarClock = byId('topbarClock');
    els.notifBtn = byId('notifBtn');
    els.notifBadge = byId('notifBadge');
    els.notifPanel = byId('notifPanel');
    els.userMenuBtn = byId('userMenuBtn');
    els.userMenu = byId('userMenu');
    els.topbarAvatar = byId('topbarAvatar');
    els.topbarUserName = byId('topbarUserName');
    els.topbarUserRole = byId('topbarUserRole');
    els.userMenuAvatar = byId('userMenuAvatar');
    els.userMenuName = byId('userMenuName');
    els.userMenuUsername = byId('userMenuUsername');
    els.logoutBtn = byId('logoutBtn');
    els.mainContent = byId('mainContent');
    els.footerYear = byId('footerYear');
  }

  function showView(view) {
    if (els.authView) els.authView.hidden = view !== 'auth';
    if (els.displayView) els.displayView.hidden = view !== 'display';
    if (els.appView) els.appView.hidden = view !== 'app';
    if (view !== 'app') closeSidebar();
  }

  function isAppVisible() {
    return Boolean(els.appView && !els.appView.hidden);
  }

  function navigate(hash) {
    if (!hash) return;
    if (location.hash === hash) handleRoute();
    else location.hash = hash;
  }

  function clinicName() {
    return store.clinic.nama || 'Sehat Bersama - Puskesmas Arbes';
  }

  function roleMeta(role) {
    return NS.core.getRoleMeta(role);
  }

  function pageLabel(pageId) {
    const page = C.PAGES.find(function (item) { return item.id === pageId; });
    return page ? page.label : 'modul ini';
  }

  function canOpen(pageId) {
    const user = store.currentUser();
    if (!user) return false;
    if (!pageId) return true;
    return user.role === 'admin' || store.hasAccess(pageId);
  }

  function closeSidebar() {
    document.body.classList.remove('sidebar-open');
    if (els.menuToggle) els.menuToggle.setAttribute('aria-expanded', 'false');
  }

  function toggleSidebar() {
    const open = !document.body.classList.contains('sidebar-open');
    document.body.classList.toggle('sidebar-open', open);
    if (els.menuToggle) els.menuToggle.setAttribute('aria-expanded', String(open));
  }

  function setInlineError(host, message) {
    if (!host) return;
    host.innerHTML = '<div class="auth-error">' + ui.icon('alert-circle') + '<span>' + ui.esc(message) + '</span></div>';
  }

  function clearInlineError(host) {
    if (host) host.innerHTML = '';
  }

  /* ------------------------------------------------------------------------
     Autentikasi — tampilan masuk & pemulihan password
     ------------------------------------------------------------------------ */
  function brandPanelMarkup() {
    const clinic = store.clinic;
    return '<section class="auth-brand-panel">' +
      '<div class="auth-brand">' +
        '<span class="brand-mark" aria-hidden="true">' + ui.brandMark() + '</span>' +
        '<div class="auth-brand-copy"><strong>Sehat Bersama - Puskesmas Arbes</strong><small>Sistem Informasi Puskesmas</small></div>' +
      '</div>' +
      '<div class="auth-hero">' +
        '<span class="auth-hero-kicker">' + ui.icon('shield') + 'Satu sistem, seluruh layanan</span>' +
        '<h1>Pelayanan lebih cepat,<br>data lebih <span>terpadu</span>.</h1>' +
        '<p>' + ui.esc(clinic.motto || 'Melayani dengan hati, untuk masyarakat yang lebih sehat.') + '</p>' +
        '<div class="auth-feature-list">' +
          AUTH_FEATURES.map(function (feature) {
            return '<div class="auth-feature">' +
              '<span class="auth-feature-icon">' + ui.icon(feature.icon) + '</span>' +
              '<div><strong>' + ui.esc(feature.title) + '</strong><span>' + ui.esc(feature.text) + '</span></div>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<div class="auth-brand-footer">' +
        '<p>' + ui.esc(clinic.instansi || clinic.nama) + ' · ' + ui.esc(clinic.alamat || '') + '</p>' +
        '<span class="auth-brand-badge"><span class="status-dot"></span>' + ui.esc(C.SPRINT) + '</span>' +
      '</div>' +
    '</section>';
  }

  function demoAccountMarkup() {
    return '<details class="auth-demo auth-demo-accordion">' +
      '<summary class="auth-demo-summary"><span><strong>Akun demonstrasi</strong><small>6 pilihan akun petugas — klik untuk melihat semuanya</small></span>' + ui.icon('chevron-down') + '</summary>' +
      '<div class="auth-demo-grid">' +
        DEMO_ACCOUNTS.map(function (account) {
          return '<button type="button" class="demo-account" data-demo-user="' + ui.attr(account.username) + '" data-demo-pass="' + ui.attr(account.password) + '">' +
            '<span class="demo-role">' + ui.esc(account.role) + '</span>' +
            '<code>' + ui.esc(account.username) + ' / ' + ui.esc(account.password) + '</code>' +
          '</button>';
        }).join('') +
      '</div>' +
      '<p class="demo-tip">Akun demo lokal khusus simulasi. Untuk reset melalui email, buat akun Firebase dengan email aktif.</p>' +
    '</details>';
  }

  function loginFormMarkup() {
    return '<span class="auth-eyebrow">Portal pasien & petugas</span>' +
      '<h2>Selamat datang kembali</h2>' +
      '<p>Gunakan akun puskesmas untuk mengakses layanan sesuai peran Anda.</p>' +
      '<form id="loginForm" class="auth-form" novalidate>' +
        '<div class="auth-error-host" id="loginError"></div>' +
        '<div class="auth-field">' +
          '<label for="loginUsername">Username atau email</label>' +
          '<div class="auth-input-wrap">' + ui.icon('user') +
            '<input class="input" id="loginUsername" name="username" type="text" autocomplete="username" placeholder="Username atau email" required>' +
          '</div>' +
        '</div>' +
        '<div class="auth-field">' +
          '<label for="loginPassword">Password</label>' +
          '<div class="auth-input-wrap">' + ui.icon('lock') +
            '<input class="input has-action" id="loginPassword" name="password" type="password" autocomplete="current-password" placeholder="Masukkan password" required>' +
            '<button type="button" class="auth-reveal" data-reveal="loginPassword" aria-label="Tampilkan password">' + ui.icon('eye') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="auth-row">' +
          '<span class="auth-check" style="cursor:default">' + ui.icon('shield') + 'Sesi lokal terlindungi</span>' +
          '<button type="button" class="auth-link" id="forgotPasswordBtn">Lupa password?</button>' +
        '</div>' +
        '<button type="submit" class="btn btn-primary btn-block auth-submit" id="loginSubmit">' + ui.icon('arrow-right') + 'Masuk ke aplikasi</button>' +
      '</form>' +
      '<div class="auth-signup-link">Belum punya akun? <a href="#/daftar" class="auth-link">Daftar akun baru</a></div>' +
      demoAccountMarkup();
  }

  function resetFormMarkup() {
    return '<span class="auth-eyebrow">Keamanan akun · Firebase</span>' +
      '<h2>Lupa password?</h2><p>Masukkan email atau username akun terdaftar. Firebase akan mengirim tautan untuk membuat password baru.</p>' +
      '<form id="resetRequestForm" class="auth-form" novalidate>' +
      '<div class="auth-error-host" id="resetError"></div>' +
      '<div class="auth-field"><label for="resetIdentifier">Email atau username</label><div class="auth-input-wrap">' + ui.icon('mail') +
      '<input class="input" id="resetIdentifier" type="text" autocomplete="username" placeholder="nama@gmail.com" required></div></div>' +
      '<button class="btn btn-primary btn-block auth-submit" type="submit" id="sendResetBtn">' + ui.icon('mail') + 'Kirim tautan reset</button></form>' +
      '<div class="auth-success" id="resetNotice" role="status" hidden></div>' +
      '<p class="demo-tip">Akun demo lokal tidak dapat menerima email. Gunakan akun baru dengan email aktif.</p>' +
      '<a href="#/login" class="btn btn-ghost btn-block" style="margin-top:16px">' + ui.icon('arrow-left') + 'Kembali ke login</a>';
  }

  function registerFormMarkup() {
    const roleOptions = C.ROLE_ORDER.map(function (role) {
      return '<option value="' + ui.attr(role) + '"' + (role === 'pasien' ? ' selected' : '') + '>' + ui.esc(roleMeta(role).label) + '</option>';
    }).join('');
    const poliOptions = C.POLI.map(function (poli) {
      return '<option value="' + ui.attr(poli.id) + '">' + ui.esc(poli.nama) + '</option>';
    }).join('');
    return '<span class="auth-eyebrow">Bergabung dengan Sehat Bersama</span>' +
      '<h2>Buat akun baru</h2>' +
      '<p>Pasien dapat mendaftar sendiri. Untuk peran petugas dan administrator diperlukan kode undangan pengelola.</p>' +
      '<form id="registerForm" class="auth-form" novalidate>' +
        '<div class="auth-error-host" id="registerError"></div>' +
        '<div class="auth-field"><label for="registerRole">Daftar sebagai</label><select class="input" id="registerRole" required>' + roleOptions + '</select></div>' +
        '<div class="auth-field"><label for="registerName">Nama lengkap</label><input class="input" id="registerName" autocomplete="name" placeholder="Nama sesuai identitas" required></div>' +
        '<div class="auth-field"><label for="registerUsername">Username</label><input class="input" id="registerUsername" autocomplete="username" placeholder="contoh: sarlinda123" required></div>' +
        '<div class="auth-field"><label for="registerEmail">Email aktif (untuk reset password)</label><input class="input" id="registerEmail" type="email" autocomplete="email" placeholder="nama@gmail.com" required></div>' +
        '<div class="auth-field"><label for="registerPhone">Nomor HP</label><input class="input" id="registerPhone" type="tel" autocomplete="tel" placeholder="08xxxxxxxxxx" required></div>' +
        '<div class="auth-field" id="registerPoliRow" hidden><label for="registerPoli">Poli penempatan dokter</label><select class="input" id="registerPoli">' + poliOptions + '</select></div>' +
        '<div class="auth-field"><label for="registerPassword">Password (minimal 8 karakter)</label><input class="input" type="password" id="registerPassword" autocomplete="new-password" required></div>' +
        '<div class="auth-field"><label for="registerConfirm">Konfirmasi password</label><input class="input" type="password" id="registerConfirm" autocomplete="new-password" required></div>' +
        '<div class="auth-field" id="registerCodeRow" hidden><label for="registerStaffCode">Kode undangan khusus petugas</label><input class="input" type="password" id="registerStaffCode" autocomplete="off" placeholder="Diperoleh dari administrator"><small class="auth-field-hint">Gunakan STAFF_REGISTRATION_CODE untuk petugas atau ADMIN_REGISTRATION_CODE untuk administrator. Kode tidak boleh dibagikan sembarangan.</small></div>' +
        '<button class="btn btn-primary btn-block auth-submit" type="submit" id="registerSubmit">' + ui.icon('user-plus') + 'Daftar akun</button>' +
      '</form>' +
      '<div class="auth-signup-link">Sudah punya akun? <a class="auth-link" href="#/login">Masuk di sini</a></div>';
  }

  function authFooterMarkup() {
    return '<div class="auth-footer">' + ui.icon('info') +
        '<span>Aplikasi demonstrasi dengan penyimpanan lokal di perangkat ini. Jangan gunakan data pasien sebenarnya.' +
        ' <a href="#/display" target="_blank" rel="noopener" class="auth-link">Buka display antrean</a></span>' +
      '</div>' +
      '<div class="auth-copyright">&copy; ' + new Date().getFullYear() + ' ' + ui.esc(clinicName()) + ' · ' + ui.esc(C.SPRINT) + ' · v' + ui.esc(C.APP_VERSION) + '</div>';
  }

  function renderAuth(mode) {
    if (!els.authView) return;
    const reset = mode === 'reset';
    const register = mode === 'register';
    const targetNotice = !reset && !register && intendedHash && intendedHash !== '#/login' && intendedHash !== '#/lupa-password'
      ? '<div class="inline-alert inline-alert-info" style="margin-top:14px">' + ui.icon('lock') + '<span>Masuk untuk melanjutkan ke halaman yang Anda tuju.</span></div>' : '';
    showView('auth');
    document.title = (reset ? 'Pulihkan Akses' : register ? 'Daftar Akun' : 'Masuk') + ' · ' + clinicName();
    els.authView.innerHTML = '<div class="auth-shell">' + brandPanelMarkup() +
      '<section class="auth-panel"><div class="auth-card">' +
        '<div class="auth-mobile-brand"><span class="brand-mark" aria-hidden="true">' + ui.brandMark() + '</span><strong>Sehat Bersama - Puskesmas Arbes</strong></div>' +
        targetNotice + (reset ? resetFormMarkup() : register ? registerFormMarkup() : loginFormMarkup()) + authFooterMarkup() +
      '</div></section></div>';
    bindAuth(mode);
  }

  function bindAuth(mode) {
    els.authView.querySelectorAll('[data-reveal]').forEach(function (button) {
      button.addEventListener('click', function () {
        const input = byId(button.dataset.reveal);
        if (!input) return;
        const reveal = input.type === 'password';
        input.type = reveal ? 'text' : 'password';
        button.innerHTML = ui.icon(reveal ? 'eye-off' : 'eye');
        button.setAttribute('aria-label', reveal ? 'Sembunyikan password' : 'Tampilkan password');
      });
    });

    if (mode === 'reset') { bindResetForm(); return; }
    if (mode === 'register') { bindRegisterForm(); return; }

    const form = byId('loginForm');
    const errorHost = byId('loginError');
    const usernameInput = byId('loginUsername');
    const passwordInput = byId('loginPassword');
    const submit = byId('loginSubmit');

    els.authView.querySelectorAll('[data-demo-user]').forEach(function (button) {
      button.addEventListener('click', function () {
        usernameInput.value = button.dataset.demoUser || '';
        passwordInput.value = button.dataset.demoPass || '';
        clearInlineError(errorHost);
        passwordInput.focus();
      });
    });

    const forgot = byId('forgotPasswordBtn');
    if (forgot) forgot.addEventListener('click', function () { navigate('#/lupa-password'); });

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      clearInlineError(errorHost);
      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      if (!username) {
        setInlineError(errorHost, 'Username wajib diisi.');
        usernameInput.focus();
        return;
      }
      if (!password) {
        setInlineError(errorHost, 'Password wajib diisi.');
        passwordInput.focus();
        return;
      }
      const original = submit.innerHTML;
      submit.disabled = true;
      submit.innerHTML = '<span class="spinner"></span>Memeriksa akun…';
      try {
        const result = await apiRequest('/api/auth/login', { username: username, password: password });
        if (result.user.role === 'admin') store.syncServerUsers(result.users || []);
        store.acceptServerUser(result.user, true);
        const target = intendedHash && intendedHash !== '#/login' && intendedHash !== '#/lupa-password'
          ? intendedHash
          : result.user.role === 'pasien' ? '#/portal-pasien' : '#/dashboard';
        intendedHash = '';
        ui.toast('Selamat datang, ' + result.user.name + '.', 'success', 'Berhasil masuk');
        if (location.hash === target) handleRoute();
        else location.hash = target;
      } catch (error) {
        setInlineError(errorHost, error.message || 'Terjadi kesalahan saat masuk.');
        submit.disabled = false;
        submit.innerHTML = original;
      }
    });

    form.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && event.target === usernameInput && !passwordInput.value) {
        event.preventDefault();
        passwordInput.focus();
      }
    });
  }

  function bindRegisterForm() {
    const form = byId('registerForm');
    const role = byId('registerRole');
    const host = byId('registerError');
    const button = byId('registerSubmit');
    const updateFields = function () {
      byId('registerCodeRow').hidden = role.value === 'pasien';
      byId('registerPoliRow').hidden = role.value !== 'dokter';
    };
    role.addEventListener('change', updateFields);
    updateFields();
    form.addEventListener('submit', async function (event) {
      event.preventDefault(); clearInlineError(host);
      const payload = {
        name: byId('registerName').value.trim(), username: byId('registerUsername').value.trim(),
        email: byId('registerEmail').value.trim(), phone: byId('registerPhone').value.trim(),
        role: role.value, poli: byId('registerPoli').value, staffCode: byId('registerStaffCode').value,
        password: byId('registerPassword').value
      };
      if (payload.password !== byId('registerConfirm').value) return setInlineError(host, 'Konfirmasi password tidak sesuai.');
      if (payload.password.length < 8) return setInlineError(host, 'Password minimal 8 karakter.');
      const original = button.innerHTML; button.disabled = true; button.innerHTML = 'Mendaftarkan akun…';
      try {
        const result = await apiRequest('/api/auth/register', payload);
        ui.toast('Akun berhasil dibuat. Silakan login.', 'success');
        navigate('#/login');
      } catch (error) { setInlineError(host, error.message); }
      finally { button.disabled = false; button.innerHTML = original; }
    });
  }

  function bindResetForm() {
    const form = byId('resetRequestForm'), button = byId('sendResetBtn'), notice = byId('resetNotice');
    form.addEventListener('submit', async function(event) {
      event.preventDefault(); clearInlineError(byId('resetError')); notice.hidden = true;
      const identifier = byId('resetIdentifier').value.trim();
      if (!identifier) return setInlineError(byId('resetError'), 'Masukkan email atau username terlebih dahulu.');
      const old = button.innerHTML; button.disabled = true; button.textContent = 'Mengirim permintaan…';
      try {
        const result = await apiRequest('/api/auth/request-reset', {identifier:identifier});
        notice.textContent = result.message + ' Buka tautan di email, buat password baru, lalu kembali ke halaman login.';
        notice.hidden = false;
      } catch(error) { setInlineError(byId('resetError'), error.message); }
      finally { button.disabled = false; button.innerHTML = old; }
    });
  }

  /* ------------------------------------------------------------------------
     Penyelesaian rute
     ------------------------------------------------------------------------ */
  function decodeSegment(value) {
    try { return decodeURIComponent(value); } catch (error) { return value; }
  }

  function routeBase(section, page, title, eyebrow, render) {
    return { section: section, page: page, title: title, eyebrow: eyebrow, render: render };
  }

  function callPage(name, method, args) {
    const page = NS.pages && NS.pages[name];
    if (!page) throw new Error('Modul ' + name + ' tidak tersedia.');
    if (method) {
      if (typeof page[method] !== 'function') throw new Error('Fungsi ' + method + ' pada modul ' + name + ' tidak tersedia.');
      return page[method].apply(page, args || []);
    }
    if (typeof page !== 'function') throw new Error('Modul ' + name + ' tidak dapat dijalankan.');
    return page.apply(null, args || []);
  }

  function resolveRoute() {
    let raw = location.hash || '';
    if (!raw || raw === '#') raw = '#/dashboard';
    const path = raw.replace(/^#\/?/, '').split('?')[0];
    const segments = path.split('/').filter(Boolean).map(decodeSegment);
    const section = segments[0] || 'dashboard';

    if (section === 'daftar' && segments.length === 1) {
      return { authPage: 'register', public: true, title: 'Daftar Akun', eyebrow: 'Pendaftaran pengguna' };
    }
    if (section === 'login' && segments.length === 1) {
      return { authPage: 'login', public: true, title: 'Masuk', eyebrow: 'Portal pasien & petugas' };
    }
    if ((section === 'lupa-password' || section === 'reset-password') && segments.length === 1) {
      return { authPage: 'reset', public: true, title: 'Pulihkan Akses', eyebrow: 'Keamanan akun' };
    }
    if (section === 'display' && segments.length === 1) {
      return { publicDisplay: true, title: 'Display Antrean', eyebrow: 'Ruang tunggu digital' };
    }

    if (section === 'portal-pasien' && segments.length === 1) return routeBase('portal-pasien', 'dashboard', 'Beranda Pasien', 'Portal pasien', function (root) { callPage('portal', 'home', [root]); });
    if (section === 'pasien-saya' && segments.length === 1) return routeBase('pasien-saya', 'patients', 'Data Diri Saya', 'Portal pasien', function (root) { callPage('portal', 'profile', [root]); });
    if (section === 'antrean-saya' && segments.length === 1) return routeBase('antrean-saya', 'queues', 'Antrean Saya', 'Portal pasien', function (root) { callPage('portal', 'queues', [root]); });
    if (section === 'kunjungan-saya' && segments.length === 1) return routeBase('kunjungan-saya', 'queues', 'Riwayat Kunjungan', 'Portal pasien', function (root) { callPage('portal', 'history', [root]); });

    if (section === 'dashboard' && segments.length === 1) {
      return routeBase('dashboard', 'dashboard', 'Dashboard', 'Ruang kerja', function (root) {
        callPage('dashboard', null, [root]);
      });
    }

    if (section === 'pasien') {
      if (segments.length === 1) {
        return routeBase('pasien', 'patients', 'Pendaftaran Pasien', 'Manajemen pasien', function (root) {
          callPage('patients', 'render', [root]);
        });
      }
      if (segments[1] === 'baru' && segments.length === 2) {
        return routeBase('pasien', 'patients', 'Pasien Baru', 'Pendaftaran pasien', function (root) {
          callPage('patients', 'create', [root]);
        });
      }
      if (segments.length === 2) {
        return routeBase('pasien', 'patients', 'Detail Pasien', 'Manajemen pasien', function (root) {
          callPage('patients', 'detail', [root, segments[1]]);
        });
      }
      if (segments.length === 3 && segments[2] === 'edit') {
        return routeBase('pasien', 'patients', 'Ubah Data Pasien', 'Manajemen pasien', function (root) {
          callPage('patients', 'edit', [root, segments[1]]);
        });
      }
      return null;
    }

    if (section === 'antrean' && segments.length === 1) {
      return routeBase('antrean', 'queues', 'Antrean Pasien', 'Alur layanan', function (root) {
        callPage('queues', 'render', [root]);
      });
    }

    if (section === 'pemeriksaan') {
      if (segments.length === 1) {
        return routeBase('pemeriksaan', 'examinations', 'Pemeriksaan Dokter', 'Rekam medis elektronik', function (root) {
          callPage('exams', 'render', [root]);
        });
      }
      if (segments.length === 2) {
        return routeBase('pemeriksaan', 'examinations', 'Rekam Medis Pasien', 'Rekam medis elektronik', function (root) {
          callPage('exams', 'detail', [root, segments[1]]);
        });
      }
      return null;
    }

    if (section === 'farmasi') {
      const tab = segments[1] || 'resep';
      if (segments.length > 2 || !PHARMACY_TABS.includes(tab)) return null;
      const eyebrows = {
        resep: 'Resep elektronik',
        obat: 'Master obat',
        stok: 'Persediaan & mutasi',
        laporan: 'Laporan farmasi'
      };
      return routeBase('farmasi', 'pharmacy', 'Farmasi & Obat', eyebrows[tab], function (root) {
        callPage('pharmacy', 'render', [root, tab]);
      });
    }

    if (section === 'pembayaran') {
      if (segments.length === 1) {
        return routeBase('pembayaran', 'billing', 'Pembayaran & Tarif', 'Kasir & penjaminan', function (root) {
          callPage('billing', 'render', [root, 'tagihan']);
        });
      }
      if (segments.length === 2 && segments[1] === 'transaksi') {
        return routeBase('pembayaran', 'billing', 'Riwayat Transaksi', 'Kasir & penjaminan', function (root) {
          callPage('billing', 'render', [root, 'transaksi']);
        });
      }
      if (segments.length === 2 && segments[1] === 'tarif') {
        return routeBase('tarif', 'billing', 'Tarif Layanan', 'Kasir & administrasi', function (root) {
          callPage('billing', 'tariffs', [root]);
        });
      }
      if (segments.length === 2) {
        return routeBase('pembayaran', 'billing', 'Detail Tagihan', 'Kasir & penjaminan', function (root) {
          callPage('billing', 'detail', [root, segments[1]]);
        });
      }
      return null;
    }

    if (section === 'tarif' && segments.length === 1) {
      return routeBase('tarif', 'billing', 'Tarif Layanan', 'Kasir & administrasi', function (root) {
        callPage('billing', 'tariffs', [root]);
      });
    }

    if (section === 'laporan') {
      const tab = segments[1] || '';
      if (segments.length > 2 || (tab && !REPORT_TABS.includes(tab))) return null;
      return routeBase('laporan', 'reports', 'Laporan & Analitik', 'Monitoring puskesmas', function (root) {
        callPage('reports', 'render', [root, tab]);
      });
    }

    if (section === 'pengguna') {
      if (segments.length === 1) {
        return routeBase('pengguna', 'users', 'Pengguna & Hak Akses', 'Administrasi sistem', function (root) {
          callPage('users', 'render', [root]);
        });
      }
      if (segments.length === 2 && segments[1] === 'akses') {
        return routeBase('pengguna', 'users', 'Matriks Hak Akses', 'Kontrol akses', function (root) {
          callPage('users', 'access', [root]);
        });
      }
      if (segments.length === 2 && segments[1] === 'audit') {
        return routeBase('pengguna', 'users', 'Jejak Audit', 'Administrasi sistem', function (root) {
          callPage('users', 'render', [root, 'audit']);
        });
      }
      return null;
    }

    if (section === 'pengaturan' && segments.length === 1) {
      return routeBase('pengaturan', 'settings', 'Pengaturan', 'Konfigurasi sistem', function (root) {
        callPage('users', 'settings', [root]);
      });
    }

    if (section === 'profil' && segments.length === 1) {
      return routeBase('profil', null, 'Profil & Keamanan', 'Akun saya', function (root) {
        callPage('users', 'profile', [root]);
      });
    }

    return null;
  }

  function applyRouteChrome(route) {
    if (!route) return;
    if (els.topbarEyebrow) els.topbarEyebrow.textContent = route.eyebrow || 'Sehat Bersama - Puskesmas Arbes';
    if (els.topbarTitle) els.topbarTitle.textContent = route.title || 'Dashboard';
    document.title = (route.title ? route.title + ' · ' : '') + clinicName();
    markNav(route.page);
  }

  function showApp() {
    showView('app');
    if (document.body.classList.contains('modal-open')) ui.closeModal();
  }

  function handleRoute() {
    if (location.hash === '#mainContent') return;
    ui.closeAllDropdowns();
    closeSidebar();
    if (displayActive) teardownDisplay();
    ui.closeModal();

    const route = resolveRoute();
    const user = store.currentUser();

    if (!route) {
      if (!user) {
        intendedHash = location.hash || '#/dashboard';
        renderAuth('login');
        return;
      }
      showNotFound();
      return;
    }

    if (route.publicDisplay) {
      showDisplay();
      return;
    }

    if (route.authPage) {
      currentRoute = null;
      if (user) {
        navigate('#/dashboard');
        return;
      }
      renderAuth(route.authPage);
      return;
    }

    if (!user) {
      intendedHash = location.hash || '#/dashboard';
      renderAuth('login');
      return;
    }

    if (user.role === 'pasien') {
      const allowed = ['portal-pasien', 'pasien-saya', 'antrean-saya', 'kunjungan-saya', 'profil'];
      if (route.section === 'dashboard') { navigate('#/portal-pasien'); return; }
      if (!allowed.includes(route.section)) { navigate('#/portal-pasien'); return; }
    } else if (['portal-pasien', 'pasien-saya', 'antrean-saya', 'kunjungan-saya'].includes(route.section)) {
      navigate('#/dashboard'); return;
    }
    currentRoute = route;
    if (route.page && !store.hasAccess(route.page)) {
      showAccessDenied(route, user);
      return;
    }

    showApp();
    refreshChrome();
    applyRouteChrome(route);
    try {
      els.mainContent.innerHTML = '';
      route.render(els.mainContent);
    } catch (error) {
      console.error('Sehat Bersama - Puskesmas Arbes: gagal merender halaman', error);
      els.mainContent.innerHTML = '<div class="access-denied"><div class="access-denied-card">' +
        ui.emptyState('alert', 'Halaman tidak dapat dimuat', error.message || 'Terjadi kesalahan saat memuat halaman ini.', '<a href="#/dashboard" class="btn btn-primary">Kembali ke Dashboard</a>') +
        '</div></div>';
      ui.showError(error);
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }

  function showAccessDenied(route, user) {
    showApp();
    refreshChrome();
    applyRouteChrome({ section: route.section, page: route.page, title: 'Akses Dibatasi', eyebrow: 'Kontrol akses' });
    const meta = roleMeta(user.role);
    els.mainContent.innerHTML = '<div class="access-denied"><div class="access-denied-card">' +
      ui.emptyState(
        'lock',
        'Akses modul tidak tersedia',
        'Peran ' + meta.label + ' belum memiliki akses ke ' + pageLabel(route.page) + '. Hubungi administrator untuk membuka modul ini pada matriks hak akses.',
        '<div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap">' +
          '<a href="#/dashboard" class="btn btn-primary">' + ui.icon('dashboard') + 'Kembali ke Dashboard</a>' +
          '<a href="#/profil" class="btn btn-secondary">' + ui.icon('user') + 'Lihat Profil</a>' +
        '</div>'
      ) +
    '</div></div>';
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }

  function showNotFound() {
    currentRoute = { section: 'not-found', page: null, title: 'Halaman Tidak Ditemukan', eyebrow: '404' };
    showApp();
    refreshChrome();
    applyRouteChrome(currentRoute);
    els.mainContent.innerHTML = '<div class="access-denied"><div class="access-denied-card">' +
      ui.emptyState(
        'search',
        'Halaman tidak ditemukan',
        'Alamat yang Anda buka tidak tersedia atau sudah dipindahkan. Periksa kembali tautan, atau kembali ke dashboard.',
        '<a href="#/dashboard" class="btn btn-primary">' + ui.icon('dashboard') + 'Kembali ke Dashboard</a>'
      ) +
    '</div></div>';
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }

  /* ------------------------------------------------------------------------
     Display antrean publik
     ------------------------------------------------------------------------ */
  function showDisplay() {
    if (!els.displayView) return;
    ui.closeAllDropdowns();
    closeSidebar();
    showView('display');
    document.title = 'Display Antrean · ' + clinicName();
    try {
      callPage('queues', 'display', [els.displayView]);
      displayActive = true;
    } catch (error) {
      console.error('Sehat Bersama - Puskesmas Arbes: gagal menampilkan display antrean', error);
      els.displayView.innerHTML = '<div class="display-screen"><div class="display-idle" style="margin:auto"><span class="display-idle-icon">' + ui.icon('alert') + '</span><strong>Display tidak dapat dimuat</strong><p>' + ui.esc(error.message || 'Terjadi kesalahan.') + '</p></div></div>';
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }

  function teardownDisplay() {
    if (window.PK.cleanupDisplay) {
      try { window.PK.cleanupDisplay(); } catch (error) { /* abaikan */ }
      window.PK.cleanupDisplay = null;
    }
    displayActive = false;
    if (els.displayView) els.displayView.innerHTML = '';
  }

  /* ------------------------------------------------------------------------
     Kerangka aplikasi: navigasi, topbar, notifikasi
     ------------------------------------------------------------------------ */
  function navGroups() {
    return [
      {
        label: 'Ruang kerja',
        items: [
          { page: 'dashboard', href: '#/dashboard', label: 'Dashboard', icon: 'dashboard' },
          { page: 'patients', href: '#/pasien', label: 'Pendaftaran Pasien', icon: 'users' },
          { page: 'queues', href: '#/antrean', label: 'Antrean Pasien', icon: 'queue' },
          { page: 'examinations', href: '#/pemeriksaan', label: 'Pemeriksaan Dokter', icon: 'stethoscope' }
        ]
      },
      {
        label: 'Layanan & keuangan',
        items: [
          { page: 'pharmacy', href: '#/farmasi', label: 'Farmasi & Obat', icon: 'pill' },
          { page: 'billing', href: '#/pembayaran', label: 'Pembayaran & Tarif', icon: 'receipt' },
          { page: 'reports', href: '#/laporan', label: 'Laporan', icon: 'chart' }
        ]
      },
      {
        label: 'Administrasi',
        items: [
          { page: 'users', href: '#/pengguna', label: 'Pengguna & Hak Akses', icon: 'shield' },
          { page: 'settings', href: '#/pengaturan', label: 'Pengaturan', icon: 'settings' }
        ]
      }
    ];
  }

  function navCounts(user) {
    const counts = { queues: 0, examinations: 0, pharmacy: 0, billing: 0 };
    try {
      const data = store.load();
      const today = NS.core.dateKey();
      let active = data.queues.filter(function (queue) {
        return queue.tanggal === today && ACTIVE_QUEUE_STATUS.includes(queue.status);
      });
      if (user.role === 'dokter' && user.poli) {
        active = active.filter(function (queue) { return queue.poli === user.poli; });
      }
      counts.queues = active.length;
      if (store.can('exam.manage')) {
        counts.examinations = data.exams.filter(function (exam) {
          return exam.status === 'draft' && (user.role !== 'dokter' || !user.poli || exam.poli === user.poli);
        }).length;
      } else if (store.can('vitals.manage')) {
        counts.examinations = active.filter(function (queue) {
          const exam = data.exams.find(function (item) { return item.queueId === queue.id; });
          return !exam || (exam.status === 'draft' && !exam.pemeriksaanFisik.tekananDarah && !exam.pemeriksaanFisik.suhu);
        }).length;
      }
      counts.pharmacy = store.pendingPrescriptions().length;
      counts.billing = data.bills.filter(function (bill) { return bill.status === 'belum'; }).length;
    } catch (error) {
      /* abaikan; navigasi tetap dapat digunakan */
    }
    return counts;
  }

  function renderNav(user) {
    if (!els.sidebarNav) return;
    if (user.role === 'pasien') {
      els.sidebarNav.innerHTML = '<div class="nav-group-label">Portal Pasien</div>' + [
        ['dashboard', '#/portal-pasien', 'Beranda', 'dashboard'],
        ['patients', '#/pasien-saya', 'Data Diri Saya', 'user'],
        ['queues', '#/antrean-saya', 'Daftar Antrean', 'queue'],
        ['history', '#/kunjungan-saya', 'Riwayat Kunjungan', 'clipboard'],
        ['profile', '#/profil', 'Pengaturan Akun', 'settings']
      ].map(function (item) { return '<a href="' + item[1] + '" class="nav-link" data-nav-page="' + item[0] + '">' + ui.icon(item[3]) + '<span>' + item[2] + '</span></a>'; }).join('');
      els.sidebarNav.querySelectorAll('.nav-link').forEach(function (link) {
        const active = link.getAttribute('href') === location.hash;
        link.classList.toggle('is-active', active);
        if (active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
      return;
    }
    const counts = navCounts(user);
    let html = '';
    navGroups().forEach(function (group) {
      const items = group.items.filter(function (item) { return canOpen(item.page); });
      if (!items.length) return;
      html += '<div class="nav-group-label">' + ui.esc(group.label) + '</div>';
      html += items.map(function (item) {
        const count = counts[item.page] || 0;
        return '<a href="' + ui.attr(item.href) + '" class="nav-link" data-nav-page="' + ui.attr(item.page) + '">' +
          ui.icon(item.icon) +
          '<span>' + ui.esc(item.label) + '</span>' +
          (count > 0 ? '<span class="nav-count">' + ui.esc(count > 99 ? '99+' : String(count)) + '</span>' : '') +
        '</a>';
      }).join('');
    });
    els.sidebarNav.innerHTML = html;
    if (currentRoute) markNav(currentRoute.page);
  }

  function markNav(pageId) {
    if (!els.sidebarNav) return;
    els.sidebarNav.querySelectorAll('.nav-link').forEach(function (link) {
      const active = store.currentUser() && store.currentUser().role === 'pasien'
        ? link.getAttribute('href') === location.hash
        : Boolean(pageId) && link.dataset.navPage === pageId;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function renderSidebarClinic() {
    if (!els.sidebarClinic) return;
    const clinic = store.clinic;
    const town = String(clinic.alamat || '').split(',')[0] || clinic.jamOperasional || 'Layanan kesehatan';
    els.sidebarClinic.innerHTML =
      '<div class="clinic-kicker"><span>Fasilitas kesehatan</span><span class="status-dot"></span></div>' +
      '<strong>' + ui.esc(clinic.instansi || clinic.nama) + '</strong>' +
      '<small>' + ui.icon('map-pin') + '<span>' + ui.esc(town) + '</span></small>';
  }

  function updateTopbarUser(user) {
    const meta = roleMeta(user.role);
    const initials = ui.initials(user.name);
    [els.topbarAvatar, els.userMenuAvatar].forEach(function (avatar) {
      if (!avatar) return;
      avatar.textContent = initials;
      avatar.style.setProperty('--avatar-tone', meta.color);
    });
    if (els.topbarUserName) {
      els.topbarUserName.textContent = user.name;
      els.topbarUserName.title = user.name;
    }
    if (els.topbarUserRole) els.topbarUserRole.textContent = meta.label;
    if (els.userMenuName) els.userMenuName.textContent = user.name;
    if (els.userMenuUsername) els.userMenuUsername.textContent = '@' + user.username;
    document.querySelectorAll('[data-admin-only]').forEach(function (element) {
      element.style.display = user.role === 'admin' ? '' : 'none';
    });
  }

  function queueScopeFor(user, active) {
    if (user.role === 'dokter' && user.poli) {
      return active.filter(function (queue) { return queue.poli === user.poli; });
    }
    return active;
  }

  function buildNotifications(user) {
    const items = [];
    try {
      const data = store.load();
      const today = NS.core.dateKey();
      const activeQueues = data.queues.filter(function (queue) {
        return queue.tanggal === today && ACTIVE_QUEUE_STATUS.includes(queue.status);
      });
      const waiting = activeQueues.filter(function (queue) { return queue.status === 'menunggu'; });
      const scoped = queueScopeFor(user, activeQueues);
      const pendingRx = store.pendingPrescriptions();
      const alerts = store.stockAlerts();
      const unpaid = data.bills.filter(function (bill) { return bill.status === 'belum'; });
      const bpjsPending = unpaid.filter(function (bill) { return bill.penjamin === 'BPJS'; });
      const lowStock = alerts.low.length + alerts.out.length;
      const expiry = alerts.expired.length + alerts.expiring.length;

      const push = function (item) {
        if (!item || !item.title) return;
        items.push(item);
      };
      const pharmacyLink = canOpen('pharmacy') ? '#/farmasi/resep' : canOpen('examinations') ? '#/pemeriksaan' : '#/dashboard';
      const stockLink = canOpen('pharmacy') ? '#/farmasi/obat' : '#/dashboard';
      const billingLink = canOpen('billing') ? '#/pembayaran' : '#/dashboard';
      const queueLink = canOpen('queues') ? '#/antrean' : '#/dashboard';
      const examLink = canOpen('examinations') ? '#/pemeriksaan' : '#/dashboard';

      if (user.role === 'dokter') {
        const waitingScoped = scoped.filter(function (queue) { return queue.status === 'menunggu'; });
        if (waitingScoped.length) {
          push({ tone: 'info', icon: 'queue', title: waitingScoped.length + ' pasien menunggu', text: 'Antrean aktif di ' + (user.poli ? NS.core.getPoli(user.poli).nama : 'semua poli') + '.', href: queueLink });
        }
        const drafts = data.exams.filter(function (exam) {
          return exam.status === 'draft' && (!user.poli || exam.poli === user.poli);
        });
        if (drafts.length) {
          push({ tone: 'warning', icon: 'clipboard', title: drafts.length + ' rekam medis draf', text: 'Selesaikan asesmen dan diagnosis pasien.', href: examLink });
        }
        if (pendingRx.length) {
          push({ tone: 'info', icon: 'pill', title: pendingRx.length + ' resep menunggu farmasi', text: 'Resep sudah dikirim untuk disiapkan.', href: pharmacyLink });
        }
      } else if (user.role === 'perawat') {
        const triage = scoped.filter(function (queue) {
          const exam = data.exams.find(function (item) { return item.queueId === queue.id; });
          return !exam || (exam.status === 'draft' && !exam.pemeriksaanFisik.tekananDarah && !exam.pemeriksaanFisik.suhu);
        });
        if (triage.length) {
          push({ tone: 'warning', icon: 'activity', title: triage.length + ' pasien perlu asesmen awal', text: 'Tanda vital belum dicatat untuk pasien ini.', href: examLink });
        }
        const called = scoped.filter(function (queue) { return queue.status === 'dipanggil'; });
        if (called.length) {
          push({ tone: 'info', icon: 'megaphone', title: called.length + ' antrean dipanggil', text: called.map(function (queue) { return queue.kode; }).slice(0, 4).join(', '), href: queueLink });
        }
      } else if (user.role === 'farmasi') {
        if (pendingRx.length) {
          push({ tone: 'warning', icon: 'pill', title: pendingRx.length + ' resep menunggu', text: 'Siapkan obat dan serahkan kepada pasien.', href: '#/farmasi/resep' });
        }
        if (lowStock) {
          push({ tone: 'danger', icon: 'package', title: lowStock + ' obat perlu perhatian stok', text: alerts.out.length + ' habis, ' + alerts.low.length + ' menipis.', href: '#/farmasi/obat' });
        }
        if (expiry) {
          push({ tone: 'warning', icon: 'alert', title: expiry + ' batch obat bermasalah', text: alerts.expired.length + ' kedaluwarsa, ' + alerts.expiring.length + ' segera kedaluwarsa.', href: '#/farmasi/obat' });
        }
      } else if (user.role === 'kasir') {
        if (unpaid.length) {
          push({ tone: 'warning', icon: 'receipt', title: unpaid.length + ' tagihan belum dibayar', text: 'Total ' + ui.currency(unpaid.reduce(function (total, bill) { return total + (Number(bill.total) || 0); }, 0)) + ' menunggu penyelesaian.', href: '#/pembayaran' });
        }
        if (bpjsPending.length) {
          push({ tone: 'info', icon: 'shield', title: bpjsPending.length + ' verifikasi BPJS', text: 'Tagihan penjaminan belum diverifikasi.', href: '#/pembayaran' });
        }
        const paidToday = data.bills.filter(function (bill) {
          return bill.status === 'lunas' && bill.paidAt && NS.core.dateKey(new Date(bill.paidAt)) === today;
        });
        if (paidToday.length) {
          push({ tone: 'success', icon: 'check-circle', title: paidToday.length + ' transaksi lunas hari ini', text: 'Pendapatan ' + ui.currency(paidToday.reduce(function (total, bill) { return total + (Number(bill.total) || 0); }, 0)) + '.', href: '#/pembayaran/transaksi' });
        }
      } else if (user.role === 'pendaftaran') {
        if (waiting.length) {
          push({ tone: 'info', icon: 'queue', title: waiting.length + ' antrean menunggu', text: 'Panggil pasien sesuai urutan dan prioritas.', href: '#/antrean' });
        }
        const cancelled = data.queues.filter(function (queue) { return queue.tanggal === today && queue.status === 'batal'; });
        if (cancelled.length) {
          push({ tone: 'warning', icon: 'x', title: cancelled.length + ' antrean dibatalkan', text: 'Tinjau alasan pembatalan pada daftar antrean.', href: '#/antrean' });
        }
      } else {
        if (waiting.length) {
          push({ tone: 'info', icon: 'queue', title: waiting.length + ' pasien menunggu', text: activeQueues.length + ' antrean masih aktif hari ini.', href: '#/antrean' });
        }
        if (pendingRx.length) {
          push({ tone: 'warning', icon: 'pill', title: pendingRx.length + ' resep menunggu', text: 'Belum diserahkan oleh petugas farmasi.', href: pharmacyLink });
        }
        if (lowStock) {
          push({ tone: 'danger', icon: 'package', title: lowStock + ' obat perlu perhatian', text: alerts.out.length + ' habis, ' + alerts.low.length + ' menipis.', href: stockLink });
        }
        if (expiry) {
          push({ tone: 'warning', icon: 'alert', title: expiry + ' batch obat bermasalah', text: alerts.expired.length + ' kedaluwarsa, ' + alerts.expiring.length + ' segera kedaluwarsa.', href: stockLink });
        }
        if (unpaid.length) {
          push({ tone: 'info', icon: 'receipt', title: unpaid.length + ' tagihan belum dibayar', text: 'Termasuk ' + bpjsPending.length + ' tagihan BPJS.', href: billingLink });
        }
      }
    } catch (error) {
      console.warn('Sehat Bersama - Puskesmas Arbes: notifikasi tidak dapat dimuat', error);
    }
    return items;
  }

  function renderNotifications(user) {
    if (!els.notifPanel || !els.notifBadge) return;
    const items = user.role === 'pasien' ? [] : buildNotifications(user);
    els.notifBadge.hidden = items.length === 0;
    els.notifBadge.textContent = items.length > 9 ? '9+' : String(items.length);
    els.notifPanel.innerHTML = '<div class="notif-head"><strong>Notifikasi</strong><span>' + (items.length ? items.length + ' perlu perhatian' : 'Semua terkendali') + '</span></div>' +
      (items.length
        ? '<div class="notif-list">' + items.slice(0, 7).map(function (item) {
            return '<a class="notif-item" href="' + ui.attr(item.href) + '">' +
              '<span class="notif-icon' + (item.tone === 'warning' ? ' is-warning' : item.tone === 'danger' ? ' is-danger' : item.tone === 'info' ? ' is-info' : '') + '">' + ui.icon(item.icon) + '</span>' +
              '<span class="notif-copy"><strong>' + ui.esc(item.title) + '</strong><small>' + ui.esc(item.text) + '</small></span>' +
            '</a>';
          }).join('') + '</div>'
        : '<div class="notif-empty">' + ui.icon('check-circle') + 'Tidak ada tugas mendesak saat ini.</div>') +
      '<div class="notif-foot"><a href="#/dashboard" class="text-link">Buka dashboard ' + ui.icon('arrow-right') + '</a></div>';
  }

  function updateClock() {
    if (!els.topbarClock) return;
    const now = new Date();
    els.topbarClock.innerHTML = ui.fmtTime(now) + ' WIB<small>' + ui.esc(ui.fmtDate(now, 'medium')) + '</small>';
  }

  function refreshChrome() {
    if (!isAppVisible()) return;
    const user = store.currentUser();
    if (!user) return;
    renderSidebarClinic();
    renderNav(user);
    updateTopbarUser(user);
    renderNotifications(user);
    updateClock();
    if (els.footerYear) els.footerYear.textContent = new Date().getFullYear();
    if (els.sprintLabel) els.sprintLabel.textContent = C.SPRINT + ' · v' + C.APP_VERSION;
    if (currentRoute) applyRouteChrome(currentRoute);
  }

  function refresh() {
    if (!store.currentUser()) {
      handleRoute();
      return;
    }
    handleRoute();
  }

  /* ------------------------------------------------------------------------
     Aksi global & siklus hidup
     ------------------------------------------------------------------------ */
  function doLogout() {
    if (displayActive) teardownDisplay();
    store.logout();
    apiRequest('/api/auth/logout', {}).catch(function () { /* server mungkin sudah mati */ });
    intendedHash = '';
    currentRoute = null;
    ui.closeAllDropdowns();
    closeSidebar();
    ui.closeModal();
    if (location.hash === '#/login') handleRoute();
    else location.hash = '#/login';
    ui.toast('Anda telah keluar dari sistem.', 'info', 'Sesi berakhir');
  }

  function logout(force) {
    if (force === true) {
      doLogout();
      return;
    }
    ui.confirm('Anda akan keluar dari sesi ini. Pastikan tidak ada pekerjaan yang belum disimpan.', {
      title: 'Keluar dari akun?',
      subtitle: 'Sesi Anda pada perangkat ini akan diakhiri.',
      okText: 'Ya, keluar',
      danger: false
    }).then(function (confirmed) {
      if (confirmed) doLogout();
    });
  }

  function bindEvents() {
    if (els.skipLink) {
      els.skipLink.addEventListener('click', function (event) {
        event.preventDefault();
        if (els.mainContent) els.mainContent.focus();
      });
    }

    if (els.menuToggle) {
      els.menuToggle.addEventListener('click', function (event) {
        event.stopPropagation();
        toggleSidebar();
      });
    }

    if (els.notifBtn) {
      els.notifBtn.addEventListener('click', function (event) {
        event.stopPropagation();
        const opening = els.notifPanel.hidden;
        ui.closeAllDropdowns();
        if (!opening) return;
        const user = store.currentUser();
        if (user) renderNotifications(user);
        els.notifPanel.hidden = false;
        els.notifBtn.setAttribute('aria-expanded', 'true');
      });
    }

    if (els.userMenuBtn) {
      els.userMenuBtn.addEventListener('click', function (event) {
        event.stopPropagation();
        const opening = els.userMenu.hidden;
        ui.closeAllDropdowns();
        if (!opening) return;
        els.userMenu.hidden = false;
        els.userMenuBtn.setAttribute('aria-expanded', 'true');
      });
    }

    if (els.logoutBtn) {
      els.logoutBtn.addEventListener('click', function () {
        ui.closeAllDropdowns();
        logout();
      });
    }

    if (els.notifPanel) {
      els.notifPanel.addEventListener('click', function (event) {
        if (event.target.closest('a')) ui.closeAllDropdowns();
      });
    }

    if (els.userMenu) {
      els.userMenu.addEventListener('click', function (event) {
        if (event.target.closest('a')) ui.closeAllDropdowns();
      });
    }

    if (els.sidebarNav) {
      els.sidebarNav.addEventListener('click', function (event) {
        if (event.target.closest('.nav-link')) closeSidebar();
      });
    }

    document.addEventListener('click', function (event) {
      if (!event.target.closest('.dropdown-wrap')) ui.closeAllDropdowns();
      if (event.target.closest('[data-close-sidebar]')) closeSidebar();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        ui.closeAllDropdowns();
        closeSidebar();
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 1080) closeSidebar();
    });

    window.addEventListener('hashchange', handleRoute);

    window.addEventListener('storage', function (event) {
      if (event.key === DB_KEY) {
        store.reload();
        if (isAppVisible()) refreshChrome();
      } else if (event.key === SESSION_KEY) {
        if (!displayActive) handleRoute();
      }
    });
  }

  async function init() {
    cacheElements();
    if (!els.authView || !els.appView) return;
    if (els.footerYear) els.footerYear.textContent = new Date().getFullYear();
    if (els.sprintLabel) els.sprintLabel.textContent = C.SPRINT + ' · v' + C.APP_VERSION;
    els.authView.innerHTML = '<div class="boot-message">Memeriksa sesi lokal…</div>';
    try {
      const result = await apiRequest('/api/auth/session', {});
      if (result.user.role === 'admin') store.syncServerUsers(result.users || []);
      store.acceptServerUser(result.user, true);
    } catch(error) { store.logout(); }
    bindEvents();

    store.subscribe(function () {
      if (isAppVisible()) refreshChrome();
    });

    updateClock();
    clockTimer = window.setInterval(updateClock, 15000);

    if (!location.hash || location.hash === '#' || location.hash === '#mainContent') {
      history.replaceState(null, '', '#/dashboard');
    }
    handleRoute();
  }

  NS.app = {
    refreshChrome: refreshChrome,
    refresh: refresh,
    logout: logout,
    navigate: navigate,
    get currentRoute() { return currentRoute; }
  };

  init();
})(window);
