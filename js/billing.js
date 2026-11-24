/* ==========================================================================
   Sehat Bersama - Puskesmas Arbes — Modul kasir, tagihan, tarif, dan pembayaran
   ========================================================================== */
(function (window) {
  'use strict';

  const NS = window.PK;
  const ui = NS.ui;
  const store = NS.store;

  const state = {
    tab: 'tagihan',
    billSearch: '',
    billStatus: '',
    billDate: '',
    billPage: 1,
    billPerPage: 8,
    txSearch: '',
    txMethod: '',
    txStart: NS.core.addDaysKey(NS.core.dateKey(), -29),
    txEnd: NS.core.dateKey(),
    txPage: 1,
    txPerPage: 10,
    tariffSearch: '',
    tariffCategory: '',
    tariffStatus: '',
    tariffPage: 1,
    tariffPerPage: 10
  };

  function today() {
    return NS.core.dateKey();
  }

  function dateKeyOf(value) {
    if (!value) return '';
    return NS.core.dateKey(new Date(value));
  }

  function sum(list, getter) {
    return (list || []).reduce(function (total, item) { return total + (Number(getter(item)) || 0); }, 0);
  }

  function patientOf(bill) {
    return store.patientById(bill.patientId);
  }

  function userName(id) {
    const user = store.users().find(function (item) { return item.id === id; });
    return user ? user.name : '—';
  }

  function billAmountPaid(bill) {
    return Number(bill.jumlahBayar) || (bill.status === 'ditanggung' ? Number(bill.total) || 0 : 0);
  }

  function verificationStatus(bill) {
    return bill.verification && bill.verification.status === 'terverifikasi' ? 'Terverifikasi' : 'Belum diverifikasi';
  }

  function itemTypeLabel(type) {
    if (type === 'obat') return 'Obat';
    if (type === 'konsultasi') return 'Konsultasi';
    return 'Layanan';
  }

  /* ------------------------------------------------------------------------
     Daftar tagihan
     ------------------------------------------------------------------------ */
  function filteredBills() {
    let list = store.bills();
    if (state.billSearch) {
      const query = state.billSearch.toLowerCase();
      list = list.filter(function (bill) {
        const patient = patientOf(bill);
        return [bill.noBill, patient ? patient.nama : '', patient ? patient.noRM : '', bill.poli ? NS.core.getPoli(bill.poli).nama : ''].some(function (value) {
          return String(value || '').toLowerCase().includes(query);
        });
      });
    }
    if (state.billStatus) list = list.filter(function (bill) { return bill.status === state.billStatus; });
    if (state.billDate) list = list.filter(function (bill) { return bill.tanggal === state.billDate; });
    return list;
  }

  function billRow(bill) {
    const patient = patientOf(bill);
    return '<tr>' +
      '<td data-label="Tagihan"><a href="#/pembayaran/' + ui.attr(bill.id) + '" class="person-cell"><span class="avatar avatar-sm">' + ui.esc(ui.initials(patient ? patient.nama : 'Bill')) + '</span><span class="person-copy"><strong>' + ui.esc(bill.noBill) + '</strong><small>' + ui.esc(patient ? patient.noRM : '—') + '</small></span></a></td>' +
      '<td data-label="Pasien"><strong>' + ui.esc(patient ? patient.nama : 'Pasien') + '</strong><small class="table-sub">' + (patient ? (patient.jenisKepersertaan === 'BPJS' ? 'Peserta BPJS' : 'Pasien umum') : '—') + '</small></td>' +
      '<td data-label="Tanggal">' + ui.esc(ui.fmtDate(bill.tanggal, 'medium')) + '<small class="table-sub">' + (bill.poli ? ui.esc(NS.core.getPoli(bill.poli).nama) : 'Tagihan manual') + '</small></td>' +
      '<td data-label="Penjamin">' + (bill.penjamin === 'BPJS' ? '<span class="badge badge-info">' + ui.icon('shield') + 'BPJS</span>' : '<span class="badge badge-muted">Umum</span>') + '</td>' +
      '<td data-label="Total"><span class="bill-amount">' + ui.currency(bill.total) + '</span><small class="table-sub">' + (bill.items || []).length + ' item layanan</small></td>' +
      '<td data-label="Status">' + ui.billBadge(bill.status) + (bill.penjamin === 'BPJS' && bill.status === 'belum' ? '<small class="table-sub">' + (bill.verification && bill.verification.status === 'terverifikasi' ? 'SEP terverifikasi' : 'Perlu verifikasi') + '</small>' : '') + '</td>' +
      '<td data-label="Aksi"><div class="table-actions">' +
        '<a class="icon-btn icon-btn-sm" href="#/pembayaran/' + ui.attr(bill.id) + '" title="Buka tagihan" aria-label="Buka tagihan ' + ui.attr(bill.noBill) + '">' + ui.icon('eye') + '</a>' +
        '<button type="button" class="icon-btn icon-btn-sm" data-bill-action="print" data-id="' + ui.attr(bill.id) + '" title="Cetak" aria-label="Cetak ' + ui.attr(bill.noBill) + '">' + ui.icon('printer') + '</button>' +
        (bill.status === 'belum' && store.can('billing.manage') ? '<a class="icon-btn icon-btn-sm accent" href="#/pembayaran/' + ui.attr(bill.id) + '" title="Bayar / verifikasi" aria-label="Bayar ' + ui.attr(bill.noBill) + '">' + ui.icon('credit-card') + '</a>' : '') +
      '</div></td>' +
    '</tr>';
  }

  function billStats() {
    const bills = store.bills();
    const unpaid = bills.filter(function (bill) { return bill.status === 'belum'; });
    const paidToday = bills.filter(function (bill) { return bill.status === 'lunas' && bill.paidAt && dateKeyOf(bill.paidAt) === today(); });
    const bpjsPending = unpaid.filter(function (bill) { return bill.penjamin === 'BPJS'; });
    return '<div class="stats-grid stats-grid-compact">' +
      ui.statCard({ label: 'Tagihan belum dibayar', value: unpaid.length, icon: 'receipt', tone: 'amber', hint: ui.currency(sum(unpaid, function (bill) { return bill.total; })) + ' total' }) +
      ui.statCard({ label: 'Pendapatan hari ini', value: ui.currency(sum(paidToday, function (bill) { return bill.total; })), icon: 'wallet', tone: 'green', hint: paidToday.length + ' transaksi lunas' }) +
      ui.statCard({ label: 'Menunggu verifikasi BPJS', value: bpjsPending.length, icon: 'shield', tone: 'blue', hint: 'Tagihan penjaminan' }) +
      ui.statCard({ label: 'Total tagihan', value: bills.length, icon: 'file-text', tone: 'violet', hint: 'Seluruh riwayat tagihan' }) +
    '</div>';
  }

  function renderBills(root) {
    const all = store.bills();
    const list = filteredBills();
    const totalPages = Math.max(1, Math.ceil(list.length / state.billPerPage));
    if (state.billPage > totalPages) state.billPage = totalPages;
    const shown = list.slice((state.billPage - 1) * state.billPerPage, state.billPage * state.billPerPage);

    root.innerHTML = ui.pageHeader({
      eyebrow: 'Kasir & Penjaminan',
      title: 'Tagihan Pasien',
      description: 'Verifikasi penjaminan, terima pembayaran, dan cetak kuitansi transaksi.',
      actions: '<button type="button" class="btn btn-secondary" id="billExportBtn">' + ui.icon('download') + 'Ekspor CSV</button>' +
        '<button type="button" class="btn btn-primary" id="manualBillBtn">' + ui.icon('file-plus') + 'Tagihan Manual</button>'
    }) +
    billStats() +
    '<div class="pharmacy-toolbar">' + ui.pageTabs([
      { id: 'tagihan', label: 'Daftar tagihan', count: all.filter(function (bill) { return bill.status === 'belum'; }).length, icon: 'receipt' },
      { id: 'transaksi', label: 'Riwayat transaksi', icon: 'wallet' }
    ], state.tab) + '<div class="pharmacy-toolbar-actions">' +
      '<a href="#/tarif" class="btn btn-secondary btn-sm">' + ui.icon('credit-card') + 'Kelola Tarif</a>' +
    '</div></div>' +
    (state.tab === 'transaksi' ? transactionsMarkup(root) :
      '<section class="card">' +
        '<div class="filter-bar">' +
          '<div class="search-field">' + ui.icon('search') + '<input type="search" id="billSearch" class="input" placeholder="Cari no. tagihan, pasien, atau no. RM…" value="' + ui.attr(state.billSearch) + '" aria-label="Cari tagihan">' + (state.billSearch ? '<button type="button" class="search-clear" id="billSearchClear" aria-label="Hapus pencarian">' + ui.icon('x') + '</button>' : '') + '</div>' +
          '<select id="billStatus" class="input input-auto" aria-label="Filter status tagihan">' + ui.options([
            { value: 'belum', label: 'Belum dibayar' },
            { value: 'lunas', label: 'Lunas' },
            { value: 'ditanggung', label: 'Ditanggung BPJS' }
          ], state.billStatus, 'Semua status') + '</select>' +
          '<input type="date" id="billDate" class="input input-auto" value="' + ui.attr(state.billDate) + '" aria-label="Filter tanggal tagihan">' +
          ui.pageSizeSelect(state.billPerPage, 'billPageSize') +
          '<button type="button" class="btn btn-secondary btn-sm" id="resetBillFilter">' + ui.icon('refresh') + 'Reset</button>' +
        '</div>' +
        '<div class="table-responsive">' +
          (shown.length ? '<table class="data-table bill-table"><thead><tr><th>No. Tagihan</th><th>Pasien</th><th>Tanggal</th><th>Penjamin</th><th>Total</th><th>Status</th><th class="th-actions">Aksi</th></tr></thead><tbody>' + shown.map(billRow).join('') + '</tbody></table>' :
            ui.emptyState('receipt', 'Tagihan tidak ditemukan', 'Ubah filter atau buat tagihan manual untuk pasien.', '<button type="button" class="btn btn-secondary btn-sm" id="emptyResetBills">Reset filter</button>')) +
        '</div>' +
        (list.length ? ui.pagination(list.length, state.billPage, state.billPerPage) : '') +
      '</section>');

    root.querySelectorAll('.pharmacy-toolbar .tab[data-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () { state.tab = tab.dataset.tab; state.billPage = 1; renderBills(root); });
    });
    const manualButton = root.querySelector('#manualBillBtn');
    if (manualButton) manualButton.addEventListener('click', function () { openManualBillModal(root); });
    if (state.tab === 'transaksi') {
      bindTransactions(root);
      return;
    }

    const search = root.querySelector('#billSearch');
    search.addEventListener('input', ui.debounce(function () {
      state.billSearch = search.value;
      state.billPage = 1;
      renderBills(root);
      const next = root.querySelector('#billSearch');
      if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
    }, 220));
    const clear = root.querySelector('#billSearchClear');
    if (clear) clear.addEventListener('click', function () { state.billSearch = ''; state.billPage = 1; renderBills(root); });
    root.querySelector('#billStatus').addEventListener('change', function (event) { state.billStatus = event.target.value; state.billPage = 1; renderBills(root); });
    root.querySelector('#billDate').addEventListener('change', function (event) { state.billDate = event.target.value; state.billPage = 1; renderBills(root); });
    root.querySelector('#billPageSize').addEventListener('change', function (event) { state.billPerPage = Number(event.target.value); state.billPage = 1; renderBills(root); });
    function reset() { state.billSearch = ''; state.billStatus = ''; state.billDate = ''; state.billPage = 1; renderBills(root); }
    root.querySelector('#resetBillFilter').addEventListener('click', reset);
    const empty = root.querySelector('#emptyResetBills');
    if (empty) empty.addEventListener('click', reset);
    root.querySelectorAll('[data-page]').forEach(function (button) {
      button.addEventListener('click', function () { state.billPage = Number(button.dataset.page) || 1; renderBills(root); });
    });
    root.querySelectorAll('[data-bill-action]').forEach(function (button) {
      button.addEventListener('click', function () {
        if (button.dataset.billAction === 'print') printBill(button.dataset.id);
      });
    });
    root.querySelector('#billExportBtn').addEventListener('click', function () {
      ui.exportCsv('tagihan-' + today() + '.csv', ['No. Tagihan', 'No. RM', 'Pasien', 'Tanggal', 'Poli', 'Penjamin', 'Status', 'Subtotal', 'Diskon', 'Total', 'Metode', 'Dibayar', 'Kembalian', 'SEP'], list.map(function (bill) {
        const patient = patientOf(bill);
        return [bill.noBill, patient ? patient.noRM : '', patient ? patient.nama : '', bill.tanggal, bill.poli ? NS.core.getPoli(bill.poli).nama : 'Manual', bill.penjamin, NS.constants.BILL_STATUS_META[bill.status].label, bill.subtotal, bill.diskon, bill.total, bill.metode || '', bill.jumlahBayar || 0, bill.kembalian || 0, bill.verification ? bill.verification.noSEP : ''];
      }));
    });
  }

  /* ------------------------------------------------------------------------
     Riwayat transaksi
     ------------------------------------------------------------------------ */
  function transactionList() {
    let list = store.bills().filter(function (bill) { return bill.status === 'lunas' || bill.status === 'ditanggung'; });
    if (state.txSearch) {
      const query = state.txSearch.toLowerCase();
      list = list.filter(function (bill) {
        const patient = patientOf(bill);
        return [bill.noBill, bill.metode, patient ? patient.nama : '', patient ? patient.noRM : ''].some(function (value) {
          return String(value || '').toLowerCase().includes(query);
        });
      });
    }
    if (state.txMethod) list = list.filter(function (bill) { return bill.metode === state.txMethod; });
    if (state.txStart) list = list.filter(function (bill) { return bill.paidAt && dateKeyOf(bill.paidAt) >= state.txStart; });
    if (state.txEnd) list = list.filter(function (bill) { return bill.paidAt && dateKeyOf(bill.paidAt) <= state.txEnd; });
    return list.sort(function (a, b) { return new Date(b.paidAt || 0) - new Date(a.paidAt || 0); });
  }

  function transactionsMarkup() {
    const list = transactionList();
    const totalPages = Math.max(1, Math.ceil(list.length / state.txPerPage));
    if (state.txPage > totalPages) state.txPage = totalPages;
    const shown = list.slice((state.txPage - 1) * state.txPerPage, state.txPage * state.txPerPage);
    const total = sum(list, function (bill) { return bill.total; });
    const cash = sum(list.filter(function (bill) { return bill.metode === 'Tunai'; }), function (bill) { return bill.total; });
    const nonCash = total - cash;
    return '<div class="report-kpis" style="margin-bottom:16px">' +
        '<div class="report-kpi"><span>Total transaksi</span><strong>' + ui.number(list.length) + '</strong><small>pembayaran & penjaminan</small></div>' +
        '<div class="report-kpi"><span>Nilai transaksi</span><strong>' + ui.currency(total) + '</strong><small>periode terpilih</small></div>' +
        '<div class="report-kpi"><span>Tunai</span><strong>' + ui.currency(cash) + '</strong><small>uang diterima kasir</small></div>' +
        '<div class="report-kpi"><span>Non-tunai / BPJS</span><strong>' + ui.currency(nonCash) + '</strong><small>QRIS, transfer, kartu, penjamin</small></div>' +
      '</div>' +
      '<section class="card">' +
        '<div class="filter-bar">' +
          '<div class="search-field">' + ui.icon('search') + '<input type="search" id="txSearch" class="input" placeholder="Cari no. tagihan, pasien, metode…" value="' + ui.attr(state.txSearch) + '" aria-label="Cari transaksi">' + (state.txSearch ? '<button type="button" class="search-clear" id="txSearchClear" aria-label="Hapus pencarian">' + ui.icon('x') + '</button>' : '') + '</div>' +
          '<select id="txMethod" class="input input-auto" aria-label="Filter metode pembayaran">' + ui.options(['Tunai', 'QRIS', 'Transfer Bank', 'Kartu Debit', 'BPJS'], state.txMethod, 'Semua metode') + '</select>' +
          '<input type="date" id="txStart" class="input input-auto" value="' + ui.attr(state.txStart) + '" aria-label="Tanggal mulai transaksi">' +
          '<input type="date" id="txEnd" class="input input-auto" value="' + ui.attr(state.txEnd) + '" aria-label="Tanggal akhir transaksi">' +
          '<button type="button" class="btn btn-secondary btn-sm" id="txApply">' + ui.icon('filter') + 'Terapkan</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" id="txExport">' + ui.icon('download') + 'CSV</button>' +
        '</div>' +
        '<div class="table-responsive"><table class="data-table bill-table"><thead><tr><th>Waktu</th><th>No. Tagihan</th><th>Pasien</th><th>Metode</th><th>Jumlah</th><th>Kasir</th><th class="th-actions">Aksi</th></tr></thead><tbody>' +
        (shown.length ? shown.map(function (bill) {
          const patient = patientOf(bill);
          return '<tr><td data-label="Waktu">' + ui.esc(ui.fmtDateTime(bill.paidAt)) + '</td>' +
            '<td data-label="Tagihan"><a href="#/pembayaran/' + ui.attr(bill.id) + '" class="mono small">' + ui.esc(bill.noBill) + '</a></td>' +
            '<td data-label="Pasien"><strong>' + ui.esc(patient ? patient.nama : '—') + '</strong><small class="table-sub">' + ui.esc(patient ? patient.noRM : '') + '</small></td>' +
            '<td data-label="Metode">' + (bill.metode === 'BPJS' ? '<span class="badge badge-info">BPJS</span>' : '<span class="badge badge-muted">' + ui.esc(bill.metode || '—') + '</span>') + '</td>' +
            '<td data-label="Jumlah"><span class="bill-amount">' + ui.currency(bill.total) + '</span></td>' +
            '<td data-label="Kasir">' + ui.esc(userName(bill.kasirId)) + '</td>' +
            '<td data-label="Aksi"><div class="table-actions"><button type="button" class="icon-btn icon-btn-sm" data-tx-print="' + ui.attr(bill.id) + '" title="Cetak kuitansi" aria-label="Cetak kuitansi">' + ui.icon('printer') + '</button><a class="icon-btn icon-btn-sm" href="#/pembayaran/' + ui.attr(bill.id) + '" title="Detail" aria-label="Detail">' + ui.icon('eye') + '</a></div></td></tr>';
        }).join('') : '<tr><td colspan="7">' + ui.emptyState('wallet', 'Belum ada transaksi', 'Transaksi pembayaran yang selesai akan tampil di sini.') + '</td></tr>') +
        '</tbody></table></div>' +
        (list.length ? ui.pagination(list.length, state.txPage, state.txPerPage) : '') +
      '</section>';
  }

  function bindTransactions(root) {
    const search = root.querySelector('#txSearch');
    search.addEventListener('input', ui.debounce(function () {
      state.txSearch = search.value;
      state.txPage = 1;
      renderBills(root);
      const next = root.querySelector('#txSearch');
      if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
    }, 220));
    const clear = root.querySelector('#txSearchClear');
    if (clear) clear.addEventListener('click', function () { state.txSearch = ''; state.txPage = 1; renderBills(root); });
    root.querySelector('#txMethod').addEventListener('change', function (event) { state.txMethod = event.target.value; state.txPage = 1; renderBills(root); });
    root.querySelector('#txApply').addEventListener('click', function () {
      state.txStart = root.querySelector('#txStart').value;
      state.txEnd = root.querySelector('#txEnd').value;
      if (state.txStart && state.txEnd && state.txStart > state.txEnd) { ui.toast('Tanggal mulai melebihi tanggal akhir.', 'warning'); return; }
      state.txPage = 1;
      renderBills(root);
    });
    root.querySelectorAll('[data-page]').forEach(function (button) {
      button.addEventListener('click', function () { state.txPage = Number(button.dataset.page) || 1; renderBills(root); });
    });
    root.querySelectorAll('[data-tx-print]').forEach(function (button) {
      button.addEventListener('click', function () { printBill(button.dataset.txPrint); });
    });
    root.querySelector('#txExport').addEventListener('click', function () {
      const list = transactionList();
      ui.exportCsv('riwayat-transaksi-' + state.txStart + '-sd-' + state.txEnd + '.csv', ['Waktu', 'No. Tagihan', 'No. RM', 'Pasien', 'Metode', 'Status', 'Total', 'Dibayar', 'Kasir', 'SEP'], list.map(function (bill) {
        const patient = patientOf(bill);
        return [ui.fmtDateTime(bill.paidAt), bill.noBill, patient ? patient.noRM : '', patient ? patient.nama : '', bill.metode, NS.constants.BILL_STATUS_META[bill.status].label, bill.total, bill.jumlahBayar || bill.total, userName(bill.kasirId), bill.verification ? bill.verification.noSEP : ''];
      }));
    });
  }

  /* ------------------------------------------------------------------------
     Detail tagihan & pembayaran
     ------------------------------------------------------------------------ */
  function renderDetail(root, billId) {
    const bill = store.billById(billId);
    if (!bill) {
      root.innerHTML = ui.emptyState('search', 'Tagihan tidak ditemukan', 'Tagihan yang Anda cari tidak tersedia atau telah dihapus.', '<a href="#/pembayaran" class="btn btn-secondary">Kembali ke daftar</a>');
      return;
    }
    const patient = patientOf(bill);
    const exam = bill.examinationId ? store.examById(bill.examinationId) : null;
    const canManage = store.can('billing.manage');
    const canVerify = store.can('billing.verify') || store.can('billing.manage');
    const isBPJS = bill.penjamin === 'BPJS';
    const isVerified = bill.verification && bill.verification.status === 'terverifikasi';

    root.innerHTML = ui.pageHeader({
      eyebrow: 'Kasir & Penjaminan',
      title: 'Detail Tagihan',
      description: 'Periksa rincian layanan, verifikasi penjaminan, dan selesaikan pembayaran pasien.',
      actions: '<a href="#/pembayaran" class="btn btn-ghost">' + ui.icon('arrow-left') + 'Daftar Tagihan</a>' +
        '<button type="button" class="btn btn-secondary" id="printBillBtn">' + ui.icon('printer') + 'Cetak</button>' +
        (patient && store.hasAccess('patients') ? '<a href="#/pasien/' + ui.attr(patient.id) + '" class="btn btn-secondary">' + ui.icon('user') + 'Profil Pasien</a>' : '')
    }) +
    '<div class="bill-detail-grid">' +
      '<div class="bill-main">' +
        '<section class="card bill-hero">' +
          '<div class="bill-hero-main">' +
            '<div><div class="hero-title-row"><h2>' + ui.esc(bill.noBill) + '</h2>' + ui.billBadge(bill.status) + (isBPJS ? ' <span class="badge badge-info">BPJS</span>' : '') + '</div>' +
              '<p>Diterbitkan ' + ui.esc(ui.fmtDateTime(bill.createdAt)) + ' · ' + (bill.poli ? ui.esc(NS.core.getPoli(bill.poli).nama) : 'Tagihan manual') + '</p>' +
              '<div style="margin-top:9px">' + (patient ? '<a href="#/pasien/' + ui.attr(patient.id) + '" class="person-cell"><span class="avatar avatar-sm">' + ui.esc(ui.initials(patient.nama)) + '</span><span class="person-copy"><strong>' + ui.esc(patient.nama) + '</strong><small>' + ui.esc(patient.noRM) + ' · ' + ui.esc(ui.ageLabel(patient.tanggalLahir)) + '</small></span></a>' : '<span class="muted">Pasien tidak ditemukan</span>') + '</div>' +
            '</div>' +
            '<div class="bill-hero-total"><span>Total tagihan</span><strong>' + ui.currency(bill.total) + '</strong><small class="table-sub">' + (bill.items || []).length + ' item layanan</small></div>' +
          '</div>' +
          '<div class="bill-hero-stats">' +
            '<div><span>Penjamin</span><strong>' + ui.esc(bill.penjamin) + '</strong></div>' +
            '<div><span>Tanggal</span><strong>' + ui.esc(ui.fmtDate(bill.tanggal, 'medium')) + '</strong></div>' +
            '<div><span>' + (bill.status === 'belum' ? 'Dibuat oleh' : 'Kasir') + '</span><strong>' + ui.esc(userName(bill.status === 'belum' ? bill.createdBy : bill.kasirId)) + '</strong></div>' +
            '<div><span>' + (isBPJS ? 'SEP' : 'Metode') + '</span><strong>' + ui.esc(isBPJS ? (bill.verification && bill.verification.noSEP ? bill.verification.noSEP : 'Belum ada SEP') : (bill.metode || '—')) + '</strong></div>' +
          '</div>' +
        '</section>' +
        '<section class="card">' +
          ui.sectionHeader('Rincian layanan', 'Item layanan, konsultasi, dan obat pada kunjungan ini.', '<span class="soft-chip">' + ui.icon('receipt') + ui.currency(bill.subtotal) + '</span>', 'receipt') +
          '<div class="table-responsive"><table class="data-table bill-items-table"><thead><tr><th>Jenis</th><th>Layanan</th><th>Harga</th><th>Qty</th><th>Total</th>' + (bill.status === 'belum' && canManage ? '<th class="th-actions">Aksi</th>' : '') + '</tr></thead><tbody>' +
          (bill.items || []).map(function (item) {
            return '<tr><td><span class="bill-item-type is-' + ui.attr(item.tipe) + '">' + ui.esc(itemTypeLabel(item.tipe)) + '</span></td>' +
              '<td><strong>' + ui.esc(item.label) + '</strong></td>' +
              '<td>' + ui.currency(item.harga) + '</td>' +
              '<td>' + ui.number(item.qty) + '</td>' +
              '<td><strong>' + ui.currency(item.total) + '</strong></td>' +
              (bill.status === 'belum' && canManage ? '<td><div class="table-actions"><button type="button" class="icon-btn icon-btn-sm" data-remove-item="' + ui.attr(item.id) + '" title="Hapus item" aria-label="Hapus item">' + ui.icon('trash') + '</button></div></td>' : '') + '</tr>';
          }).join('') +
          '</tbody></table></div>' +
          (bill.status === 'belum' && canManage ? '<div class="bill-add-item"><div class="field"><label for="addItemTariff">Tambah layanan</label><select id="addItemTariff" class="input">' + '<option value="">Pilih tarif layanan…</option>' + activeTariffOptions() + '</select></div><div class="field"><label for="addItemQty">Qty</label><input id="addItemQty" type="number" min="1" step="1" class="input" value="1"></div><button type="button" class="btn btn-secondary" id="addItemBtn">' + ui.icon('plus') + 'Tambah</button></div>' : '') +
          '<div class="bill-totals">' +
            '<div class="bill-total-row"><span>Subtotal</span><strong>' + ui.currency(bill.subtotal) + '</strong></div>' +
            '<div class="bill-total-row is-discount"><span>Diskon</span><strong>− ' + ui.currency(bill.diskon || 0) + '</strong></div>' +
            '<div class="bill-grand-total"><span>Total tagihan</span><strong>' + ui.currency(bill.total) + '</strong></div>' +
          '</div>' +
          (exam ? '<div class="inline-alert inline-alert-info" style="margin-top:12px">' + ui.icon('stethoscope') + '<span>Pemeriksaan <a href="#/pemeriksaan/' + ui.attr(exam.id) + '" class="text-link">' + ui.esc(exam.noPemeriksaan) + '</a> · Diagnosis: ' + ui.esc(exam.diagnosis || '—') + '</span></div>' : '') +
        '</section>' +
      '</div>' +
      '<aside class="bill-aside">' +
        (bill.status === 'belum' && isBPJS ? verificationCard(bill, canVerify) : '') +
        (bill.status === 'belum' && !isBPJS && canManage ? paymentCard(bill) : '') +
        (bill.status === 'belum' && isBPJS ? '<section class="card payment-card"><div class="section-header" style="padding:15px 17px"><div class="section-header-copy"><span class="section-icon">' + ui.icon('info') + '</span><div><h2>Pembayaran BPJS</h2><p>Tagihan akan ditanggung setelah SEP diverifikasi.</p></div></div></div><div class="payment-body"><div class="inline-alert inline-alert-info">' + ui.icon('shield') + '<span>Tagihan penjaminan BPJS tidak memerlukan pembayaran tunai. Verifikasi terlebih dahulu untuk menyelesaikan tagihan.</span></div></div></section>' : '') +
        (bill.status !== 'belum' ? completedPaymentCard(bill) : '') +
        '<section class="card">' +
          '<h3 class="aside-title">Informasi pasien</h3>' +
          '<div class="info-list">' +
            '<div><span>No. RM</span><strong>' + ui.esc(patient ? patient.noRM : '—') + '</strong></div>' +
            '<div><span>NIK</span><strong class="mono small">' + ui.esc(patient ? ui.groupNik(patient.nik) : '—') + '</strong></div>' +
            '<div><span>Kepesertaan</span><strong>' + ui.esc(patient ? patient.jenisKepersertaan : '—') + '</strong></div>' +
            '<div><span>No. BPJS</span><strong class="mono small">' + ui.esc(patient && patient.noBPJS ? patient.noBPJS : '—') + '</strong></div>' +
            '<div><span>Telepon</span><strong>' + ui.esc(patient ? patient.noTelepon : '—') + '</strong></div>' +
          '</div>' +
        '</section>' +
        '<section class="card">' +
          '<h3 class="aside-title">Aksi cepat</h3>' +
          '<div class="quick-action-list">' +
            '<button type="button" class="quick-action" id="billPrintSide"><span class="task-icon task-icon-blue">' + ui.icon('printer') + '</span><span><strong>Cetak dokumen</strong><small>Kuitansi / tagihan pasien</small></span>' + ui.icon('chevron-right') + '</button>' +
            (exam && store.hasAccess('examinations') ? '<a href="#/pemeriksaan/' + ui.attr(exam.id) + '" class="quick-action"><span class="task-icon task-icon-violet">' + ui.icon('stethoscope') + '</span><span><strong>Rekam medis</strong><small>Lihat pemeriksaan dokter</small></span>' + ui.icon('chevron-right') + '</a>' : '') +
            (patient && store.hasAccess('patients') ? '<a href="#/pasien/' + ui.attr(patient.id) + '" class="quick-action"><span class="task-icon task-icon-teal">' + ui.icon('user') + '</span><span><strong>Profil pasien</strong><small>Riwayat kunjungan</small></span>' + ui.icon('chevron-right') + '</a>' : '') +
          '</div>' +
        '</section>' +
      '</aside>' +
    '</div>';

    root.querySelector('#printBillBtn').addEventListener('click', function () { printBill(bill.id); });
    const sidePrint = root.querySelector('#billPrintSide');
    if (sidePrint) sidePrint.addEventListener('click', function () { printBill(bill.id); });
    const receiptFromCard = root.querySelector('#receiptFromCard');
    if (receiptFromCard) receiptFromCard.addEventListener('click', function () { printBill(bill.id); });

    const addButton = root.querySelector('#addItemBtn');
    if (addButton) {
      addButton.addEventListener('click', function () {
        const tariffId = root.querySelector('#addItemTariff').value;
        const qty = Number(root.querySelector('#addItemQty').value) || 1;
        if (!tariffId) { ui.toast('Pilih tarif layanan terlebih dahulu.', 'warning'); return; }
        try {
          store.addBillItem(bill.id, { tarifId: tariffId, qty: qty });
          ui.toast('Item layanan berhasil ditambahkan ke tagihan.', 'success');
          renderDetail(root, bill.id);
        } catch (error) { ui.showError(error); }
      });
    }
    root.querySelectorAll('[data-remove-item]').forEach(function (button) {
      button.addEventListener('click', function () {
        const item = (bill.items || []).find(function (entry) { return entry.id === button.dataset.removeItem; });
        ui.confirm('Hapus item “' + (item ? item.label : 'layanan') + '” dari tagihan?', { title: 'Hapus item', okText: 'Ya, hapus' }).then(function (confirmed) {
          if (!confirmed) return;
          try {
            store.removeBillItem(bill.id, button.dataset.removeItem);
            ui.toast('Item tagihan dihapus.', 'success');
            renderDetail(root, bill.id);
          } catch (error) { ui.showError(error); }
        });
      });
    });

    const verifyForm = root.querySelector('#verifyForm');
    if (verifyForm) {
      verifyForm.addEventListener('submit', function (event) {
        event.preventDefault();
        if (!verifyForm.reportValidity()) return;
        const button = verifyForm.querySelector('[type="submit"]');
        const values = ui.readForm(verifyForm);
        ui.setSubmitting(button, true, 'Memverifikasi…');
        try {
          store.verifyBill(bill.id, values);
          ui.toast('Penjaminan BPJS berhasil diverifikasi. Tagihan ditanggung BPJS.', 'success', 'Verifikasi berhasil');
          renderDetail(root, bill.id);
        } catch (error) {
          ui.setSubmitting(button, false);
          const host = verifyForm.closest('.verify-card').querySelector('.form-error-host');
          if (host) host.innerHTML = ui.formError(error.message);
          ui.showError(error);
        }
      });
    }

    const paymentForm = root.querySelector('#paymentForm');
    if (paymentForm) {
      const amountInput = paymentForm.querySelector('#paymentAmount');
      const methodRadios = paymentForm.querySelectorAll('input[name="metode"]');
      const changeHost = paymentForm.querySelector('#paymentChange');
      const total = Number(bill.total) || 0;
      function updateChange() {
        const amount = Number(amountInput.value) || 0;
        const change = Math.max(0, amount - total);
        if (changeHost) changeHost.textContent = ui.currency(change);
      }
      amountInput.addEventListener('input', updateChange);
      paymentForm.querySelectorAll('[data-amount]').forEach(function (button) {
        button.addEventListener('click', function () {
          amountInput.value = button.dataset.amount === 'exact' ? total : Number(button.dataset.amount) || 0;
          updateChange();
        });
      });
      paymentForm.addEventListener('submit', function (event) {
        event.preventDefault();
        if (!paymentForm.reportValidity()) return;
        const method = paymentForm.querySelector('input[name="metode"]:checked');
        if (!method) { ui.toast('Pilih metode pembayaran.', 'warning'); return; }
        const amount = Number(amountInput.value);
        if (amount < total) { ui.toast('Nominal pembayaran kurang dari total tagihan.', 'warning'); amountInput.focus(); return; }
        const button = paymentForm.querySelector('[type="submit"]');
        ui.setSubmitting(button, true, 'Memproses…');
        try {
          store.payBill(bill.id, { metode: method.value, jumlahBayar: amount });
          ui.toast('Pembayaran ' + ui.currency(amount) + ' berhasil diterima.', 'success', 'Pembayaran lunas');
          renderDetail(root, bill.id);
        } catch (error) {
          ui.setSubmitting(button, false);
          const host = paymentForm.querySelector('.form-error-host');
          if (host) host.innerHTML = ui.formError(error.message);
          ui.showError(error);
        }
      });
      updateChange();
    }
  }

  function activeTariffOptions() {
    return store.tariffs().filter(function (tariff) { return tariff.aktif; }).map(function (tariff) {
      return '<option value="' + ui.attr(tariff.id) + '">' + ui.esc(tariff.nama + ' · ' + ui.currency(tariff.tarif)) + '</option>';
    }).join('');
  }

  function verificationCard(bill, canVerify) {
    const patient = patientOf(bill);
    const verified = bill.verification && bill.verification.status === 'terverifikasi';
    return '<section class="card verify-card">' +
      '<h3>Verifikasi BPJS</h3><p>Pastikan kepesertaan aktif dan nomor SEP sesuai sebelum tagihan ditanggung.</p>' +
      '<div class="verify-status' + (verified ? ' is-verified' : '') + '">' + ui.icon(verified ? 'check-circle' : 'shield') + '<span>' + (verified ? 'Terverifikasi · SEP ' + ui.esc(bill.verification.noSEP || '—') : 'Belum diverifikasi') + '</span></div>' +
      (verified ? '<div class="info-list" style="margin-top:10px"><div><span>No. BPJS</span><strong class="mono small">' + ui.esc(bill.verification.noBPJS || (patient ? patient.noBPJS : '—')) + '</strong></div><div><span>Diverifikasi</span><strong>' + ui.esc(ui.fmtDateTime(bill.verification.verifiedAt)) + '</strong></div><div><span>Petugas</span><strong>' + ui.esc(userName(bill.verification.verifiedBy)) + '</strong></div></div>' :
        canVerify ? '<form id="verifyForm" style="margin-top:11px" novalidate><div class="form-error-host"></div><div class="field"><label for="verifyNoBPJS">Nomor kartu BPJS <span class="required">*</span></label><input id="verifyNoBPJS" name="noBPJS" class="input mono" inputmode="numeric" maxlength="13" value="' + ui.attr(patient && patient.noBPJS ? patient.noBPJS : '') + '" required></div><div class="field" style="margin-top:9px"><label for="verifyNoSEP">Nomor SEP <span class="label-note">opsional</span></label><input id="verifyNoSEP" name="noSEP" class="input mono" placeholder="Otomatis jika kosong"></div><div class="field" style="margin-top:9px"><label for="verifyNote">Catatan</label><input id="verifyNote" name="catatan" class="input" placeholder="Catatan verifikasi"></div><button type="submit" class="btn btn-secondary btn-block" style="margin-top:11px">' + ui.icon('shield') + 'Verifikasi Sekarang</button></form>' :
          '<p class="muted" style="margin-top:10px">Anda tidak memiliki akses verifikasi penjaminan.</p>') +
    '</section>';
  }

  function paymentCard(bill) {
    const total = Number(bill.total) || 0;
    return '<section class="card payment-card">' +
      '<div class="section-header"><div class="section-header-copy"><span class="section-icon">' + ui.icon('credit-card') + '</span><div><h2>Pembayaran</h2><p>Pilih metode dan masukkan nominal uang diterima.</p></div></div></div>' +
      '<form id="paymentForm" class="payment-body" novalidate>' +
        '<div class="form-error-host"></div>' +
        '<div class="payment-methods">' +
          ['Tunai', 'QRIS', 'Transfer Bank', 'Kartu Debit'].map(function (method, index) {
            return '<label class="payment-method"><input type="radio" name="metode" value="' + ui.attr(method) + '"' + (index === 0 ? ' checked' : '') + '><span>' + ui.icon(method === 'Tunai' ? 'wallet' : method === 'QRIS' ? 'activity' : method === 'Kartu Debit' ? 'credit-card' : 'building') + ui.esc(method) + '</span></label>';
          }).join('') +
        '</div>' +
        '<div class="field"><label for="paymentAmount">Uang diterima</label><div class="payment-amount"><span>Rp</span><input type="number" id="paymentAmount" class="input" min="' + total + '" step="1" value="' + total + '" required></div></div>' +
        '<div class="cash-quick"><button type="button" data-amount="exact">Uang pas</button><button type="button" data-amount="' + (Math.ceil(total / 10000) * 10000) + '">' + ui.currency(Math.ceil(total / 10000) * 10000) + '</button><button type="button" data-amount="' + (Math.ceil(total / 50000) * 50000) + '">' + ui.currency(Math.ceil(total / 50000) * 50000) + '</button><button type="button" data-amount="' + (Math.ceil(total / 100000) * 100000) + '">' + ui.currency(Math.ceil(total / 100000) * 100000) + '</button></div>' +
        '<div class="payment-summary"><div><span>Total tagihan</span><strong>' + ui.currency(total) + '</strong></div><div><span>Kembalian</span><strong id="paymentChange">Rp0</strong></div></div>' +
        '<button type="submit" class="btn btn-primary btn-block">' + ui.icon('check-circle') + 'Proses Pembayaran</button>' +
        '<p class="payment-note">' + ui.icon('lock') + 'Transaksi dicatat atas nama kasir yang sedang masuk.</p>' +
      '</form>' +
    '</section>';
  }

  function completedPaymentCard(bill) {
    return '<section class="card verify-card">' +
      '<h3>' + (bill.status === 'ditanggung' ? 'Ditanggung BPJS' : 'Pembayaran selesai') + '</h3>' +
      '<div class="verify-status is-verified">' + ui.icon('check-circle') + '<span>' + ui.esc(bill.status === 'ditanggung' ? 'Tagihan telah diverifikasi dan ditanggung BPJS' : 'Lunas pada ' + ui.fmtDateTime(bill.paidAt)) + '</span></div>' +
      '<div class="info-list" style="margin-top:11px">' +
        '<div><span>Metode</span><strong>' + ui.esc(bill.metode || '—') + '</strong></div>' +
        '<div><span>Total</span><strong>' + ui.currency(bill.total) + '</strong></div>' +
        '<div><span>Dibayar</span><strong>' + ui.currency(billAmountPaid(bill)) + '</strong></div>' +
        '<div><span>Kembalian</span><strong>' + ui.currency(bill.kembalian || 0) + '</strong></div>' +
        '<div><span>Kasir</span><strong>' + ui.esc(userName(bill.kasirId)) + '</strong></div>' +
      '</div>' +
      '<button type="button" class="btn btn-secondary btn-block" style="margin-top:11px" id="receiptFromCard">' + ui.icon('printer') + 'Cetak Kuitansi</button>' +
    '</section>';
  }

  /* ------------------------------------------------------------------------
     Tagihan manual
     ------------------------------------------------------------------------ */
  function openManualBillModal(root) {
    const patients = store.patients().slice().sort(function (a, b) { return a.nama.localeCompare(b.nama, 'id'); });
    const tariffs = store.tariffs().filter(function (tariff) { return tariff.aktif; });
    if (!tariffs.length) {
      ui.toast('Belum ada tarif aktif. Tambahkan tarif terlebih dahulu.', 'warning');
      return;
    }
    function rowMarkup() {
      return '<div class="bill-line-row" data-manual-row><div class="field"><label>Layanan</label><select class="input manual-tariff"><option value="">Pilih tarif…</option>' + activeTariffOptions() + '</select></div><div class="field"><label>Qty</label><input type="number" class="input manual-qty" min="1" step="1" value="1"></div><button type="button" class="icon-btn icon-btn-sm manual-remove" title="Hapus baris" aria-label="Hapus baris">' + ui.icon('trash') + '</button></div>';
    }
    function recalc(layer) {
      const total = Array.from(layer.querySelectorAll('[data-manual-row]')).reduce(function (sum, row) {
        const tariff = tariffs.find(function (item) { return item.id === row.querySelector('.manual-tariff').value; });
        const qty = Number(row.querySelector('.manual-qty').value) || 0;
        return sum + (tariff ? tariff.tarif * qty : 0);
      }, 0);
      const host = layer.querySelector('#manualTotal');
      if (host) host.textContent = ui.currency(total);
      return total;
    }
    ui.modal({
      title: 'Tagihan Manual',
      subtitle: 'Buat tagihan layanan untuk pasien tanpa pemeriksaan dokter.',
      icon: 'file-plus',
      size: 'lg',
      content: '<form id="manualBillForm" novalidate><div class="form-error-host"></div>' +
        '<div class="form-grid-2">' +
          '<div class="field full"><label for="manualPatient">Pasien <span class="required">*</span></label><select id="manualPatient" name="patientId" class="input" required><option value="">Pilih pasien…</option>' + patients.map(function (patient) { return '<option value="' + ui.attr(patient.id) + '">' + ui.esc(patient.nama + ' · ' + patient.noRM + ' · ' + patient.jenisKepersertaan) + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label for="manualPayer">Penjamin <span class="required">*</span></label><select id="manualPayer" name="penjamin" class="input">' + ui.options(['Umum', 'BPJS'], 'Umum') + '</select><div class="field-feedback" id="payerFeedback">BPJS hanya berlaku untuk peserta BPJS.</div></div>' +
          '<div class="field"><label>Tanggal</label><input class="input" value="' + ui.esc(ui.fmtDate(today(), 'full')) + '" disabled></div>' +
        '</div>' +
        '<div class="form-section-title" style="margin:17px 0 9px">' + ui.icon('receipt') + 'Item layanan</div>' +
        '<div class="bill-line-editor" id="manualRows">' + rowMarkup() + '</div>' +
        '<button type="button" class="btn btn-secondary btn-sm" id="manualAddRow" style="margin-top:9px">' + ui.icon('plus') + 'Tambah Baris</button>' +
        '<div class="bill-manual-total" style="margin-top:13px"><span>Total tagihan</span><strong id="manualTotal">Rp0</strong></div>' +
        '<div class="inline-alert inline-alert-info" style="margin-top:12px">' + ui.icon('info') + '<span>Setelah tagihan dibuat, Anda dapat menambah item, memverifikasi BPJS, dan menerima pembayaran pada halaman detail.</span></div>' +
      '</form>',
      footer: '<button type="button" class="btn btn-secondary" data-modal-close>Batal</button><button type="submit" form="manualBillForm" class="btn btn-primary">' + ui.icon('file-plus') + 'Buat Tagihan</button>',
      onMount: function (layer) {
        const form = layer.querySelector('#manualBillForm');
        const rows = layer.querySelector('#manualRows');
        function bindRow(row) {
          row.querySelector('.manual-tariff').addEventListener('change', function () { recalc(layer); });
          row.querySelector('.manual-qty').addEventListener('input', function () { recalc(layer); });
          row.querySelector('.manual-remove').addEventListener('click', function () {
            if (rows.querySelectorAll('[data-manual-row]').length <= 1) { ui.toast('Minimal satu baris layanan.', 'warning'); return; }
            row.remove();
            recalc(layer);
          });
        }
        bindRow(rows.firstElementChild);
        layer.querySelector('#manualAddRow').addEventListener('click', function () {
          const wrapper = document.createElement('div');
          wrapper.innerHTML = rowMarkup();
          const row = wrapper.firstElementChild;
          rows.appendChild(row);
          bindRow(row);
          recalc(layer);
        });
        form.querySelector('#manualPatient').addEventListener('change', function () {
          const patient = store.patientById(this.value);
          const payer = form.querySelector('#manualPayer');
          const feedback = form.querySelector('#payerFeedback');
          if (!patient) { payer.value = 'Umum'; return; }
          if (patient.jenisKepersertaan === 'BPJS') {
            payer.value = 'BPJS';
            feedback.textContent = 'Pasien terdaftar sebagai peserta BPJS.';
          } else {
            payer.value = 'Umum';
            feedback.textContent = 'Pasien umum — penjamin BPJS tidak tersedia.';
          }
        });
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          if (!form.reportValidity()) return;
          const patientId = form.querySelector('#manualPatient').value;
          const penjamin = form.querySelector('#manualPayer').value;
          let items;
          try {
            items = Array.from(rows.querySelectorAll('[data-manual-row]')).map(function (row, index) {
              const tarifId = row.querySelector('.manual-tariff').value;
              const qty = Number(row.querySelector('.manual-qty').value) || 1;
              if (!tarifId) throw new Error('Pilih layanan pada baris ke-' + (index + 1) + '.');
              return { tarifId: tarifId, qty: qty };
            });
          } catch (error) {
            form.querySelector('.form-error-host').innerHTML = ui.formError(error.message);
            return;
          }
          if (!patientId) { form.querySelector('.form-error-host').innerHTML = ui.formError('Pilih pasien terlebih dahulu.'); return; }
          if (!items.length) { form.querySelector('.form-error-host').innerHTML = ui.formError('Tambahkan minimal satu item layanan.'); return; }
          const button = layer.querySelector('[form="manualBillForm"]');
          ui.setSubmitting(button, true, 'Membuat…');
          try {
            const bill = store.createManualBill({ patientId: patientId, items: items, penjamin: penjamin });
            ui.closeModal();
            ui.toast('Tagihan ' + bill.noBill + ' berhasil dibuat.', 'success', 'Tagihan baru');
            if (root) {
              location.hash = '#/pembayaran/' + bill.id;
            }
          } catch (error) {
            ui.setSubmitting(button, false);
            form.querySelector('.form-error-host').innerHTML = ui.formError(error.message || String(error));
          }
        });
        recalc(layer);
      }
    });
  }

  /* ------------------------------------------------------------------------
     Tarif layanan
     ------------------------------------------------------------------------ */
  function filteredTariffs() {
    let list = store.tariffs();
    if (state.tariffSearch) {
      const query = state.tariffSearch.toLowerCase();
      list = list.filter(function (tariff) {
        return [tariff.nama, tariff.kode, tariff.kategori, tariff.poli ? NS.core.getPoli(tariff.poli).nama : ''].some(function (value) {
          return String(value || '').toLowerCase().includes(query);
        });
      });
    }
    if (state.tariffCategory) list = list.filter(function (tariff) { return tariff.kategori === state.tariffCategory; });
    if (state.tariffStatus === 'aktif') list = list.filter(function (tariff) { return tariff.aktif; });
    if (state.tariffStatus === 'nonaktif') list = list.filter(function (tariff) { return !tariff.aktif; });
    return list;
  }

  function renderTariffs(root) {
    const all = store.tariffs();
    const list = filteredTariffs();
    const totalPages = Math.max(1, Math.ceil(list.length / state.tariffPerPage));
    if (state.tariffPage > totalPages) state.tariffPage = totalPages;
    const shown = list.slice((state.tariffPage - 1) * state.tariffPerPage, state.tariffPage * state.tariffPerPage);
    const categories = Array.from(new Set(all.map(function (tariff) { return tariff.kategori; }))).sort(function (a, b) { return a.localeCompare(b, 'id'); });
    const canManage = store.can('tariff.manage');

    root.innerHTML = ui.pageHeader({
      eyebrow: 'Kasir & Administrasi',
      title: 'Tarif Layanan',
      description: 'Atur tarif konsultasi, tindakan, pemeriksaan penunjang, dan administrasi puskesmas.',
      actions: (canManage ? '<button type="button" class="btn btn-primary" id="newTariffBtn">' + ui.icon('plus') + 'Tarif Baru</button>' : '') +
        '<button type="button" class="btn btn-secondary" id="tariffExportBtn">' + ui.icon('download') + 'Ekspor CSV</button>'
    }) +
    '<div class="stats-grid stats-grid-compact">' +
      ui.statCard({ label: 'Tarif aktif', value: all.filter(function (tariff) { return tariff.aktif; }).length, icon: 'credit-card', tone: 'teal', hint: all.length + ' total tarif' }) +
      ui.statCard({ label: 'Kategori layanan', value: categories.length, icon: 'filter', tone: 'blue', hint: 'Konsultasi, tindakan, administrasi…' }) +
      ui.statCard({ label: 'Rata-rata tarif', value: ui.currency(all.length ? sum(all.filter(function (tariff) { return tariff.aktif; }), function (tariff) { return tariff.tarif; }) / Math.max(1, all.filter(function (tariff) { return tariff.aktif; }).length) : 0), icon: 'wallet', tone: 'green', hint: 'Tarif aktif' }) +
      ui.statCard({ label: 'Tarif tertinggi', value: ui.currency(Math.max.apply(null, all.filter(function (tariff) { return tariff.aktif; }).map(function (tariff) { return tariff.tarif; }).concat([0]))), icon: 'trending-up', tone: 'violet', hint: 'Layanan dengan nominal terbesar' }) +
    '</div>' +
    '<section class="card">' +
      '<div class="filter-bar tariff-filter">' +
        '<div class="search-field">' + ui.icon('search') + '<input type="search" id="tariffSearch" class="input" placeholder="Cari nama tarif, kode, atau poli…" value="' + ui.attr(state.tariffSearch) + '" aria-label="Cari tarif">' + (state.tariffSearch ? '<button type="button" class="search-clear" id="tariffSearchClear" aria-label="Hapus pencarian">' + ui.icon('x') + '</button>' : '') + '</div>' +
        '<select id="tariffCategory" class="input input-auto" aria-label="Filter kategori tarif">' + ui.options(categories, state.tariffCategory, 'Semua kategori') + '</select>' +
        '<select id="tariffStatus" class="input input-auto" aria-label="Filter status tarif">' + ui.options([{ value: 'aktif', label: 'Aktif' }, { value: 'nonaktif', label: 'Nonaktif' }], state.tariffStatus, 'Semua status') + '</select>' +
        ui.pageSizeSelect(state.tariffPerPage, 'tariffPageSize') +
        '<button type="button" class="btn btn-secondary btn-sm" id="resetTariffFilter">' + ui.icon('refresh') + 'Reset</button>' +
      '</div>' +
      '<div class="table-responsive"><table class="data-table tariff-table"><thead><tr><th>Kode</th><th>Layanan</th><th>Kategori</th><th>Poli</th><th>Tarif</th><th>Status</th><th class="th-actions">Aksi</th></tr></thead><tbody>' +
      (shown.length ? shown.map(function (tariff) {
        return '<tr><td data-label="Kode"><span class="mono small">' + ui.esc(tariff.kode) + '</span></td>' +
          '<td data-label="Layanan"><strong>' + ui.esc(tariff.nama) + '</strong></td>' +
          '<td data-label="Kategori">' + ui.esc(tariff.kategori) + '</td>' +
          '<td data-label="Poli">' + (tariff.poli ? ui.poliBadge(tariff.poli, true) : '<span class="muted">Semua poli</span>') + '</td>' +
          '<td data-label="Tarif"><span class="tariff-amount">' + ui.currency(tariff.tarif) + '</span></td>' +
          '<td data-label="Status">' + (tariff.aktif ? '<span class="badge badge-success">Aktif</span>' : '<span class="badge badge-muted">Nonaktif</span>') + '</td>' +
          '<td data-label="Aksi"><div class="table-actions">' +
            (canManage ? '<button type="button" class="icon-btn icon-btn-sm" data-tariff-action="edit" data-id="' + ui.attr(tariff.id) + '" title="Ubah tarif" aria-label="Ubah ' + ui.attr(tariff.nama) + '">' + ui.icon('edit') + '</button>' : '') +
            (canManage ? '<button type="button" class="icon-btn icon-btn-sm ' + (tariff.aktif ? '' : 'accent') + '" data-tariff-action="toggle" data-id="' + ui.attr(tariff.id) + '" title="' + (tariff.aktif ? 'Nonaktifkan' : 'Aktifkan') + '" aria-label="' + (tariff.aktif ? 'Nonaktifkan' : 'Aktifkan') + '">' + ui.icon(tariff.aktif ? 'toggle-right' : 'toggle-left') + '</button>' : '') +
          '</div></td></tr>';
      }).join('') : '<tr><td colspan="7">' + ui.emptyState('credit-card', 'Tarif tidak ditemukan', 'Ubah filter atau tambahkan tarif layanan baru.') + '</td></tr>') +
      '</tbody></table></div>' +
      (list.length ? ui.pagination(list.length, state.tariffPage, state.tariffPerPage) : '') +
    '</section>';

    const search = root.querySelector('#tariffSearch');
    search.addEventListener('input', ui.debounce(function () {
      state.tariffSearch = search.value;
      state.tariffPage = 1;
      renderTariffs(root);
      const next = root.querySelector('#tariffSearch');
      if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
    }, 220));
    const clear = root.querySelector('#tariffSearchClear');
    if (clear) clear.addEventListener('click', function () { state.tariffSearch = ''; state.tariffPage = 1; renderTariffs(root); });
    root.querySelector('#tariffCategory').addEventListener('change', function (event) { state.tariffCategory = event.target.value; state.tariffPage = 1; renderTariffs(root); });
    root.querySelector('#tariffStatus').addEventListener('change', function (event) { state.tariffStatus = event.target.value; state.tariffPage = 1; renderTariffs(root); });
    root.querySelector('#tariffPageSize').addEventListener('change', function (event) { state.tariffPerPage = Number(event.target.value); state.tariffPage = 1; renderTariffs(root); });
    root.querySelector('#resetTariffFilter').addEventListener('click', function () { state.tariffSearch = ''; state.tariffCategory = ''; state.tariffStatus = ''; state.tariffPage = 1; renderTariffs(root); });
    root.querySelectorAll('[data-page]').forEach(function (button) {
      button.addEventListener('click', function () { state.tariffPage = Number(button.dataset.page) || 1; renderTariffs(root); });
    });
    const newButton = root.querySelector('#newTariffBtn');
    if (newButton) newButton.addEventListener('click', function () { openTariffModal(null, root); });
    root.querySelectorAll('[data-tariff-action]').forEach(function (button) {
      button.addEventListener('click', function () {
        if (button.dataset.tariffAction === 'edit') openTariffModal(button.dataset.id, root);
        if (button.dataset.tariffAction === 'toggle') {
          const tariff = store.tariffs().find(function (item) { return item.id === button.dataset.id; });
          ui.confirm((tariff.aktif ? 'Nonaktifkan' : 'Aktifkan') + ' tarif “' + tariff.nama + '”?', { title: 'Ubah status tarif', okText: 'Ya, lanjutkan', danger: false }).then(function (confirmed) {
            if (!confirmed) return;
            try {
              store.toggleTariff(tariff.id);
              ui.toast('Status tarif berhasil diubah.', 'success');
              renderTariffs(root);
            } catch (error) { ui.showError(error); }
          });
        }
      });
    });
    root.querySelector('#tariffExportBtn').addEventListener('click', function () {
      ui.exportCsv('tarif-layanan-' + today() + '.csv', ['Kode', 'Nama', 'Kategori', 'Poli', 'Tarif', 'Aktif'], list.map(function (tariff) {
        return [tariff.kode, tariff.nama, tariff.kategori, tariff.poli ? NS.core.getPoli(tariff.poli).nama : 'Semua poli', tariff.tarif, tariff.aktif ? 'Ya' : 'Tidak'];
      }));
    });
  }

  function openTariffModal(id, root) {
    const tariff = id ? store.tariffs().find(function (item) { return item.id === id; }) : null;
    const categories = Array.from(new Set(store.tariffs().map(function (item) { return item.kategori; }))).sort(function (a, b) { return a.localeCompare(b, 'id'); });
    ui.modal({
      title: tariff ? 'Ubah Tarif Layanan' : 'Tambah Tarif Layanan',
      subtitle: tariff ? tariff.kode + ' · ' + tariff.nama : 'Tetapkan nominal layanan untuk tagihan pasien.',
      icon: 'credit-card',
      content: '<form id="tariffForm" novalidate><div class="form-error-host"></div><div class="form-grid-2">' +
        '<div class="field full"><label for="tariffName">Nama layanan <span class="required">*</span></label><input id="tariffName" name="nama" class="input" value="' + ui.attr(tariff ? tariff.nama : '') + '" placeholder="Contoh: Konsultasi Dokter Umum" required></div>' +
        '<div class="field"><label for="tariffCategory">Kategori <span class="required">*</span></label><input id="tariffCategory" name="kategori" class="input" list="tariffCategories" value="' + ui.attr(tariff ? tariff.kategori : '') + '" placeholder="Konsultasi / Tindakan / …" required><datalist id="tariffCategories">' + categories.map(function (category) { return '<option value="' + ui.attr(category) + '"></option>'; }).join('') + '</datalist></div>' +
        '<div class="field"><label for="tariffAmount">Nominal (Rp) <span class="required">*</span></label><input id="tariffAmount" name="tarif" type="number" min="0" step="1" class="input" value="' + ui.attr(tariff ? tariff.tarif : '') + '" required></div>' +
        '<div class="field"><label for="tariffPoli">Berlaku untuk poli</label><select id="tariffPoli" name="poli" class="input">' + ui.options(NS.constants.POLI.map(function (poli) { return { value: poli.id, label: poli.nama }; }), tariff ? tariff.poli || '' : '', 'Semua poli') + '</select></div>' +
        '<div class="field"><label class="check-card compact" for="tariffActive"><input type="checkbox" id="tariffActive" name="aktif" value="1"' + (!tariff || tariff.aktif ? ' checked' : '') + '><span class="check-card-copy"><strong>Tarif aktif</strong><small>Tarif nonaktif tidak tersedia saat membuat tagihan.</small></span><span class="switch" aria-hidden="true"></span></label></div>' +
      '</div></form>',
      footer: '<button type="button" class="btn btn-secondary" data-modal-close>Batal</button><button type="submit" form="tariffForm" class="btn btn-primary">' + ui.icon('check') + (tariff ? 'Simpan Perubahan' : 'Tambah Tarif') + '</button>',
      onMount: function (layer) {
        const form = layer.querySelector('#tariffForm');
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          if (!form.reportValidity()) return;
          const button = layer.querySelector('[form="tariffForm"]');
          const values = ui.readForm(form);
          const payload = {
            nama: values.nama,
            kategori: values.kategori,
            tarif: values.tarif,
            poli: values.poli || null,
            aktif: Boolean(form.querySelector('#tariffActive').checked)
          };
          ui.setSubmitting(button, true, 'Menyimpan…');
          try {
            store.saveTariff(payload, tariff ? tariff.id : null);
            ui.closeModal();
            ui.toast(tariff ? 'Tarif berhasil diperbarui.' : 'Tarif baru berhasil ditambahkan.', 'success');
            renderTariffs(root);
          } catch (error) {
            ui.setSubmitting(button, false);
            form.querySelector('.form-error-host').innerHTML = ui.formError(error.message);
          }
        });
      }
    });
  }

  /* ------------------------------------------------------------------------
     Cetak kuitansi / tagihan
     ------------------------------------------------------------------------ */
  function printBill(billId) {
    const bill = store.billById(billId);
    if (!bill) {
      ui.toast('Tagihan tidak ditemukan.', 'error');
      return;
    }
    const patient = patientOf(bill);
    const isPaid = bill.status === 'lunas';
    const isBpjs = bill.status === 'ditanggung' || bill.penjamin === 'BPJS';
    const title = isPaid ? 'KUITANSI PEMBAYARAN' : isBpjs ? 'BUKTI PENJAMINAN BPJS' : 'TAGIHAN PASIEN';
    const content = ui.printLetterhead(title) +
      '<div class="print-doc-meta">' +
        '<div class="print-doc-meta-block"><span>No. Tagihan</span><strong>' + ui.esc(bill.noBill) + '</strong></div>' +
        '<div class="print-doc-meta-block"><span>Tanggal</span><strong>' + ui.esc(ui.fmtDate(bill.tanggal, 'full')) + '</strong></div>' +
        '<div class="print-doc-meta-block"><span>Status</span><strong>' + ui.esc(NS.constants.BILL_STATUS_META[bill.status].label) + '</strong></div>' +
      '</div>' +
      '<div class="print-patient-box">' +
        '<div><span>Nama Pasien</span><strong>' + ui.esc(patient ? patient.nama : '—') + '</strong></div>' +
        '<div><span>No. RM</span><strong>' + ui.esc(patient ? patient.noRM : '—') + '</strong></div>' +
        '<div><span>Penjamin</span><strong>' + ui.esc(bill.penjamin) + '</strong></div>' +
        '<div><span>No. BPJS / SEP</span><strong>' + ui.esc(bill.verification ? (bill.verification.noBPJS || '—') + ' / ' + (bill.verification.noSEP || '—') : '—') + '</strong></div>' +
        '<div><span>Poli</span><strong>' + ui.esc(bill.poli ? NS.core.getPoli(bill.poli).nama : 'Tagihan manual') + '</strong></div>' +
        '<div><span>Kasir</span><strong>' + ui.esc(userName(bill.kasirId) || '—') + '</strong></div>' +
      '</div>' +
      '<table class="print-table"><thead><tr><th>No</th><th>Layanan</th><th>Qty</th><th>Harga</th><th>Total</th></tr></thead><tbody>' +
      (bill.items || []).map(function (item, index) {
        return '<tr><td>' + (index + 1) + '</td><td>' + ui.esc(item.label) + '</td><td>' + ui.number(item.qty) + '</td><td>' + ui.currency(item.harga) + '</td><td>' + ui.currency(item.total) + '</td></tr>';
      }).join('') +
      '</tbody><tfoot>' +
        '<tr><td colspan="4" style="text-align:right">Subtotal</td><td>' + ui.currency(bill.subtotal) + '</td></tr>' +
        (bill.diskon ? '<tr><td colspan="4" style="text-align:right">Diskon</td><td>− ' + ui.currency(bill.diskon) + '</td></tr>' : '') +
        '<tr class="report-total-row"><td colspan="4" style="text-align:right">Total</td><td>' + ui.currency(bill.total) + '</td></tr>' +
      '</tfoot></table>' +
      '<div class="print-payment-grid">' +
        '<div><span>Metode pembayaran</span><strong>' + ui.esc(bill.metode || (isBpjs ? 'BPJS' : 'Belum dibayar')) + '</strong></div>' +
        '<div><span>Jumlah dibayar</span><strong>' + ui.currency(bill.jumlahBayar || (isBpjs ? bill.total : 0)) + '</strong></div>' +
        '<div><span>Kembalian</span><strong>' + ui.currency(bill.kembalian || 0) + '</strong></div>' +
        '<div><span>Waktu pembayaran</span><strong>' + ui.esc(bill.paidAt ? ui.fmtDateTime(bill.paidAt, true) : '—') + '</strong></div>' +
      '</div>' +
      '<div class="print-note">' + ui.icon('info') + '<span>' + (isPaid ? 'Pembayaran telah diterima. Simpan kuitansi ini sebagai bukti transaksi yang sah.' : isBpjs ? 'Tagihan ini ditanggung oleh BPJS setelah verifikasi penjaminan. Tidak ada pembayaran tunai.' : 'Tagihan ini belum dibayar. Silakan lakukan pembayaran di kasir puskesmas.') + '</span></div>' +
      '<div class="print-signatures"><div><span>Pasien / Keluarga</span><div class="signature-space"></div><strong>' + ui.esc(patient ? patient.nama : '—') + '</strong></div><div><span>Petugas Kasir</span><div class="signature-space"></div><strong>' + ui.esc(userName(bill.kasirId) === '—' ? store.currentUser().name : userName(bill.kasirId)) + '</strong></div></div>' +
      (bill.status === 'belum' ? '<div class="print-watermark">BELUM DIBAYAR</div>' : '') +
      ui.printFooter();
    ui.printDocument(content, { title: title + ' — ' + (patient ? patient.nama : bill.noBill) });
  }

  /* ------------------------------------------------------------------------
     Render & ekspor modul
     ------------------------------------------------------------------------ */
  function render(root, tab) {
    state.tab = tab === 'transaksi' ? 'transaksi' : 'tagihan';
    renderBills(root);
  }

  NS.pages = NS.pages || {};
  NS.pages.billing = {
    render: render,
    detail: renderDetail,
    tariffs: renderTariffs,
    print: printBill,
    openManualBill: openManualBillModal
  };
})(window);
