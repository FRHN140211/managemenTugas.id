/* ============================================================
   modules/notifications.js — Toast, modal, icons, and text utilities.
   Emits events for toast/modal lifecycle.
   ============================================================ */

(function (MT) {
  'use strict';

  if (!MT.EventEmitter) {
    console.warn('MT.EventEmitter belum dimuat. Muat emitter.js sebelum notifications.js.');
    return;
  }

  function NotificationManager() {
    MT.EventEmitter.call(this);
  }
  NotificationManager.prototype = Object.create(MT.EventEmitter.prototype);
  NotificationManager.prototype.constructor = NotificationManager;

  /* ---------------- Ikon (SVG garis) ---------------- */

  var IKON = {
    dashboard: '<rect x="3" y="3" width="7.5" height="9" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="5.5" rx="1.6"/><rect x="13.5" y="12" width="7.5" height="9" rx="1.6"/><rect x="3" y="15.5" width="7.5" height="5.5" rx="1.6"/>',
    users: '<circle cx="9" cy="8" r="3.4"/><path d="M3.4 20c0-3.1 2.5-5.2 5.6-5.2s5.6 2.1 5.6 5.2"/><path d="M16 5.4a3 3 0 0 1 0 5.9"/><path d="M17.6 15.4c2.1.6 3.6 2.3 3.6 4.6"/>',
    tasks: '<rect x="3.5" y="3.5" width="17" height="17" rx="3.2"/><path d="m8.2 12.3 2.5 2.5 5-5"/>',
    report: '<path d="M14 3.5H7.6A2.1 2.1 0 0 0 5.5 5.6v12.8a2.1 2.1 0 0 0 2.1 2.1h8.8a2.1 2.1 0 0 0 2.1-2.1V8z"/><path d="M14 3.5V8h4.5"/><path d="M8.8 13h6.4M8.8 16.4h4.2"/>',
    reminder: '<path d="M6.4 9.6a5.6 5.6 0 1 1 11.2 0c0 3.9 1.5 5.4 1.5 5.4H4.9s1.5-1.5 1.5-5.4Z"/><path d="M9.9 18.4a2.2 2.2 0 0 0 4.2 0"/>',
    book: '<path d="M4.6 5.6A2.1 2.1 0 0 1 6.7 3.5H19v14.9H6.7a2.1 2.1 0 0 0-2.1 2.1z"/><path d="M4.6 5.6v14.9"/><path d="M9 8.4h6"/>',
    user: '<circle cx="12" cy="8" r="3.5"/><path d="M5.2 20c0-3.6 3-6.1 6.8-6.1s6.8 2.5 6.8 6.1"/>',
    logout: '<path d="M15.2 4.6H18a1.6 1.6 0 0 1 1.6 1.6v12a1.6 1.6 0 0 1-1.6 1.6h-2.8"/><path d="M9.4 12h9.8"/><path d="m12.6 8.6-3.4 3.4 3.4 3.4"/>',
    plus: '<path d="M12 5.2v13.6M5.2 12h13.6"/>',
    search: '<circle cx="11" cy="11" r="6.6"/><path d="m15.9 15.9 4.4 4.4"/>',
    filter: '<path d="M4 5.6h16l-6.1 7.1v5.5l-3.8 2v-7.5z"/>',
    edit: '<path d="M5 19.2h3.6L19 8.8a2.5 2.5 0 0 0-3.6-3.6L5 15.6z"/><path d="m14.4 6.6 3.2 3.2"/>',
    trash: '<path d="M4.6 7h14.8"/><path d="M9.6 7V4.6h4.8V7"/><path d="m6.6 7 1 12.4h8.8L17.4 7"/><path d="M10.5 10.8v5.6M13.5 10.8v5.6"/>',
    check: '<path d="m5 12.6 4.4 4.4L19 7.4"/>',
    close: '<path d="M6.2 6.2l11.6 11.6M17.8 6.2 6.2 17.8"/>',
    alert: '<path d="M12 4.4 2.8 19.6h18.4z"/><path d="M12 10.2v4.4M12 17.4v.2"/>',
    info: '<circle cx="12" cy="12" r="8.6"/><path d="M12 11.2v5.2M12 7.9v.2"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    mail: '<rect x="3.4" y="5.4" width="17.2" height="13.2" rx="2.4"/><path d="m4.6 7.6 7.4 5.4 7.4-5.4"/>',
    lock: '<rect x="4.6" y="10.4" width="14.8" height="9.6" rx="2.4"/><path d="M8 10.4V8a4 4 0 0 1 8 0v2.4"/>',
    eye: '<path d="M2.6 12S6.2 5.6 12 5.6 21.4 12 21.4 12 17.8 18.4 12 18.4 2.6 12 2.6 12Z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M9.7 6a8.7 8.7 0 0 1 2.3-.3c5.8 0 9.4 6.3 9.4 6.3a17 17 0 0 1-2.6 3.3"/><path d="M6.2 7.6A17 17 0 0 0 2.6 12S6.2 18.4 12 18.4a8.9 8.9 0 0 0 3.7-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="m4.4 4.4 15.2 15.2"/>',
    calendar: '<rect x="3.5" y="5.4" width="17" height="15.1" rx="2.4"/><path d="M3.5 10h17M8.6 3.4v4M15.4 3.4v4"/>',
    clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.3V12l3.1 2"/>',
    sort: '<path d="M8 5.4v13.2M8 5.4 5.1 8.3M8 5.4l2.9 2.9"/><path d="M16 18.6V5.4M16 18.6l2.9-2.9M16 18.6l-2.9-2.9"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.5-5.8"/><path d="M20 4.2v4.6h-4.6"/>',
    download: '<path d="M12 4.4v11"/><path d="m7.6 10.9 4.4 4.4 4.4-4.4"/><path d="M5 19.4h14"/>',
    chevronDown: '<path d="m6.4 9.8 5.6 5.6 5.6-5.6"/>',
    chevronUp: '<path d="m6.4 14.2 5.6-5.6 5.6 5.6"/>',
    chevronLeft: '<path d="m14.2 6-6 6 6 6"/>',
    chevronRight: '<path d="m9.8 6 6 6-6 6"/>',
    arrowLeft: '<path d="M19.4 12H4.6"/><path d="m10.8 5.8-6 6.2 6 6.2"/>',
    arrowRight: '<path d="M4.6 12h14.8"/><path d="m13.2 5.8 6 6.2-6 6.2"/>',
    dots: '<circle cx="5.4" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18.6" cy="12" r="1.5"/>',
    inbox: '<path d="M3.4 12.6 6 5.4h12l2.6 7.2v6.4a1.6 1.6 0 0 1-1.6 1.6H5a1.6 1.6 0 0 1-1.6-1.6z"/><path d="M3.4 12.6h4.2l1 2.4h6.8l1-2.4h4.2"/>',
    tools: '<path d="M5 7.4h8.4M17.6 7.4h1.4M5 16.6h2.4M11.6 16.6h7.4"/><circle cx="15.6" cy="7.4" r="2"/><circle cx="9.6" cy="16.6" r="2"/>',
    shield: '<path d="M12 3.6 5.4 6.2v5.3c0 4 2.7 7.4 6.6 8.6 3.9-1.2 6.6-4.6 6.6-8.6V6.2z"/><path d="m9.4 12 1.9 1.9 3.5-3.5"/>',
    database: '<ellipse cx="12" cy="6.4" rx="7" ry="2.9"/><path d="M5 6.4v11.2c0 1.6 3.1 2.9 7 2.9s7-1.3 7-2.9V6.4"/><path d="M5 12c0 1.6 3.1 2.9 7 2.9s7-1.3 7-2.9"/>',
    flag: '<path d="M6 20.4V4.6h11.4l-1.6 3.7 1.6 3.7H6"/>',
    bell: '<path d="M6.4 9.6a5.6 5.6 0 1 1 11.2 0c0 3.9 1.5 5.4 1.5 5.4H4.9s1.5-1.5 1.5-5.4Z"/><path d="M9.9 18.4a2.2 2.2 0 0 0 4.2 0"/>',
    list: '<path d="M8.6 6.4h11M8.6 12h11M8.6 17.6h11"/><circle cx="4.6" cy="6.4" r="1.2"/><circle cx="4.6" cy="12" r="1.2"/><circle cx="4.6" cy="17.6" r="1.2"/>',
    trend: '<path d="M4 16.4l4.8-4.8 3.2 3.2L20 6.8"/><path d="M15.4 6.8H20v4.6"/>'
  };

  /* ---------------- Utilitas teks & tanggal ---------------- */

  var NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  /* ---------------- Metode publik ---------------- */

  NotificationManager.prototype.icon = function (nama, extraKelas) {
    var isi = IKON[nama] || IKON.info;
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' +
      (extraKelas ? ' class="' + extraKelas + '"' : '') + '>' + isi + '</svg>';
  };

  NotificationManager.prototype.esc = function (teks) {
    if (teks === null || teks === undefined) return '';
    return String(teks)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  NotificationManager.prototype.tanggalSelisih = function (hari) {
    var tanggal = new Date();
    tanggal.setHours(12, 0, 0, 0);
    tanggal.setDate(tanggal.getDate() + hari);
    return tanggal.toISOString().slice(0, 10);
  };

  NotificationManager.prototype.formatTanggal = function (iso) {
    if (!iso) return '—';
    var bagian = String(iso).slice(0, 10).split('-');
    if (bagian.length !== 3) return '—';
    var d = new Date(Number(bagian[0]), Number(bagian[1]) - 1, Number(bagian[2]));
    return d.getDate() + ' ' + BULAN_SINGKAT[d.getMonth()] + ' ' + d.getFullYear();
  };

  NotificationManager.prototype.formatTanggalLengkap = function (iso) {
    if (!iso) return '—';
    var bagian = String(iso).slice(0, 10).split('-');
    if (bagian.length !== 3) return '—';
    var d = new Date(Number(bagian[0]), Number(bagian[1]) - 1, Number(bagian[2]));
    return NAMA_HARI[d.getDay()] + ', ' + d.getDate() + ' ' + NAMA_BULAN[d.getMonth()] + ' ' + d.getFullYear();
  };

  NotificationManager.prototype.labelBulan = function (tahunBulan) {
    var bagian = String(tahunBulan).split('-');
    var bulan = Number(bagian[1]) - 1;
    return (NAMA_BULAN[bulan] || '—') + ' ' + bagian[0];
  };

  NotificationManager.prototype.labelPendekTanggal = function (iso) {
    if (!iso) return '—';
    var bagian = String(iso).slice(0, 10).split('-');
    if (bagian.length !== 3) return '—';
    var d = new Date(Number(bagian[0]), Number(bagian[1]) - 1, Number(bagian[2]));
    return d.getDate() + ' ' + BULAN_SINGKAT[d.getMonth()];
  };

  NotificationManager.prototype.selisihHari = function (iso) {
    if (!iso) return null;
    var bagian = String(iso).slice(0, 10).split('-');
    if (bagian.length !== 3) return null;
    var d = new Date(Number(bagian[0]), Number(bagian[1]) - 1, Number(bagian[2]));
    var hariIni = new Date();
    hariIni.setHours(0, 0, 0, 0);
    return Math.round((d - hariIni) / 86400000);
  };

  NotificationManager.prototype.infoDeadline = function (iso, status) {
    var selisih = this.selisihHari(iso);
    if (selisih === null) return { teks: 'Belum ditetapkan', nada: 'normal' };
    if (status === 'Selesai') return { teks: 'Sudah selesai', nada: 'done' };
    if (selisih < 0) return { teks: 'Lewat ' + Math.abs(selisih) + ' hari', nada: 'over' };
    if (selisih === 0) return { teks: 'Jatuh tempo hari ini', nada: 'soon' };
    if (selisih === 1) return { teks: 'Besok', nada: 'soon' };
    if (selisih <= 3) return { teks: selisih + ' hari lagi', nada: 'soon' };
    return { teks: selisih + ' hari lagi', nada: 'normal' };
  };

  NotificationManager.prototype.inisial = function (nama) {
    if (!nama) return '—';
    var bagian = String(nama).trim().split(/\s+/);
    if (bagian.length === 1) return bagian[0].slice(0, 2).toUpperCase();
    return (bagian[0][0] + bagian[bagian.length - 1][0]).toUpperCase();
  };

  NotificationManager.prototype.avatar = function (nama, kelas) {
    return '<span class="avatar ' + (kelas || '') + '" aria-hidden="true">' + this.esc(this.inisial(nama)) + '</span>';
  };

  NotificationManager.prototype.kelasStatus = function (status) {
    if (status === 'Sedang Dikerjakan') return 'status-proses';
    if (status === 'Selesai') return 'status-selesai';
    if (status === 'Belum Dimulai') return 'status-belum';
    if (status === 'Aktif') return 'status-aktif';
    if (status === 'Nonaktif') return 'status-nonaktif';
    return 'status-belum';
  };

  NotificationManager.prototype.badgeStatus = function (status) {
    return '<span class="status ' + this.kelasStatus(status) + '">' + this.esc(status || '—') + '</span>';
  };

  NotificationManager.prototype.badgeRole = function (role) {
    if (role === 'owner') return '<span class="badge badge-primary">Owner</span>';
    return '<span class="badge badge-neutral">User</span>';
  };

  NotificationManager.prototype.kapital = function (teks) {
    return String(teks || '').charAt(0).toUpperCase() + String(teks || '').slice(1);
  };

  NotificationManager.prototype.potong = function (teks, batas) {
    var t = String(teks || '');
    return t.length > batas ? t.slice(0, batas - 1).trim() + '…' : t;
  };

  NotificationManager.prototype.jeda = function (ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  };

  /* ---------------- Toast ---------------- */

  var IKON_TOAST = { success: 'check', error: 'alert', info: 'info' };

  NotificationManager.prototype.toast = function (tipe, judul, pesan) {
    var root = document.getElementById('toast-root');
    if (!root) return;
    var el = document.createElement('div');
    el.className = 'toast toast-' + tipe;
    el.setAttribute('role', tipe === 'error' ? 'alert' : 'status');
    el.innerHTML =
      '<span class="toast-icon">' + this.icon(IKON_TOAST[tipe] || 'info') + '</span>' +
      '<div class="toast-body"><strong>' + this.esc(judul) + '</strong>' +
      (pesan ? '<p>' + this.esc(pesan) + '</p>' : '') + '</div>' +
      '<button type="button" class="icon-button icon-button-sm" aria-label="Tutup notifikasi">' + this.icon('close') + '</button>';

    var self = this;
    function tutup() {
      el.style.opacity = '0';
      el.style.transform = 'translateY(6px)';
      el.style.transition = 'opacity .18s ease, transform .18s ease';
      setTimeout(function () { el.remove(); }, 200);
    }
    el.querySelector('button').addEventListener('click', tutup);
    root.appendChild(el);
    this.emit('toast:show', { tipe: tipe, judul: judul, pesan: pesan });
    setTimeout(tutup, 4800);
  };

  /* ---------------- Modal ---------------- */

  NotificationManager.prototype.modal = function (opsi) {
    var root = document.getElementById('modal-root');
    var pemicuSebelumnya = document.activeElement;

    var overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML =
      '<div class="modal ' + (opsi.ukuran === 'sm' ? 'modal-sm' : '') + '" role="dialog" aria-modal="true" ' +
      'aria-labelledby="modal-judul" aria-describedby="' + (opsi.subjudul ? 'modal-subjudul' : 'modal-judul') + '">' +
        '<div class="modal-head">' +
          '<div class="modal-head-text">' +
            '<h2 id="modal-judul">' + this.esc(opsi.judul) + '</h2>' +
            (opsi.subjudul ? '<p id="modal-subjudul">' + this.esc(opsi.subjudul) + '</p>' : '') +
          '</div>' +
          '<button type="button" class="icon-button" data-modal-close aria-label="Tutup dialog">' + this.icon('close') + '</button>' +
        '</div>' +
        '<div class="modal-body ' + (opsi.bodyTanpaPadding ? 'modal-body-flush' : '') + '">' + (opsi.body || '') + '</div>' +
        (opsi.footer ? '<div class="modal-foot">' + opsi.footer + '</div>' : '') +
      '</div>';

    root.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    var modalEl = overlay.querySelector('.modal');

    var self = this;
    function tutup() {
      overlay.remove();
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      if (pemicuSebelumnya && pemicuSebelumnya.focus) pemicuSebelumnya.focus();
      self.emit('modal:close', {});
    }

    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); tutup(); return; }
      if (e.key !== 'Tab') return;
      var fokusable = modalEl.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!fokusable.length) return;
      var pertama = fokusable[0];
      var terakhir = fokusable[fokusable.length - 1];
      if (e.shiftKey && document.activeElement === pertama) { e.preventDefault(); terakhir.focus(); }
      else if (!e.shiftKey && document.activeElement === terakhir) { e.preventDefault(); pertama.focus(); }
    }

    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) tutup(); });
    overlay.querySelectorAll('[data-modal-close]').forEach(function (btn) {
      btn.addEventListener('click', tutup);
    });
    document.addEventListener('keydown', onKey);

    var fokusAwal = overlay.querySelector('[data-autofocus]') || overlay.querySelector('input, select, textarea, button:not([data-modal-close])');
    if (fokusAwal) setTimeout(function () { fokusAwal.focus(); }, 30);

    this.emit('modal:open', { judul: opsi.judul });

    return {
      el: overlay,
      modal: modalEl,
      tutup: tutup,
      body: overlay.querySelector('.modal-body'),
      footer: overlay.querySelector('.modal-foot')
    };
  };

  /* ---------------- Dialog konfirmasi ---------------- */

  NotificationManager.prototype.konfirmasi = function (opsi) {
    var self = this;
    return new Promise(function (resolve) {
      var nada = opsi.nada || 'danger';
      var ctrl = self.modal({
        ukuran: 'sm',
        judul: opsi.judul,
        body:
          '<div class="alert alert-' + (nada === 'danger' ? 'danger' : 'warning') + '">' +
            '<span class="alert-icon">' + self.icon(nada === 'danger' ? 'alert' : 'info') + '</span>' +
            '<div><strong>' + self.esc(opsi.pesanSingkat || 'Perlu konfirmasi') + '</strong>' +
            '<p>' + self.esc(opsi.pesan) + '</p></div>' +
          '</div>' +
          (opsi.catatan ? '<p class="muted-sm" style="margin-top:12px">' + self.esc(opsi.catatan) + '</p>' : ''),
        footer:
          '<button type="button" class="btn btn-ghost" data-konfirmasi="batal">Batal</button>' +
          '<button type="button" class="btn ' + (nada === 'danger' ? 'btn-danger' : 'btn-primary') + '" data-konfirmasi="ya">' +
            '<span class="btn-spinner"></span><span class="btn-label">' + self.esc(opsi.labelYa || 'Hapus') + '</span>' +
          '</button>'
      });

      ctrl.el.querySelector('[data-konfirmasi="batal"]').addEventListener('click', function () {
        ctrl.tutup(); resolve(false);
      });
      var tombolYa = ctrl.el.querySelector('[data-konfirmasi="ya"]');
      tombolYa.addEventListener('click', function () {
        ctrl.tutup(); resolve(true);
      });
      setTimeout(function () { tombolYa.focus(); }, 40);
    });
  };

  /* ---------------- Tombol loading ---------------- */

  NotificationManager.prototype.setTombolLoading = function (tombol, loading, labelLoading) {
    if (!tombol) return;
    var label = tombol.querySelector('.btn-label');
    if (loading) {
      if (!tombol.dataset.labelAsli && label) tombol.dataset.labelAsli = label.textContent;
      tombol.classList.add('is-loading');
      tombol.setAttribute('aria-disabled', 'true');
      tombol.setAttribute('aria-busy', 'true');
      tombol.disabled = true;
      if (label && labelLoading) label.textContent = labelLoading;
    } else {
      tombol.classList.remove('is-loading');
      tombol.removeAttribute('aria-disabled');
      tombol.removeAttribute('aria-busy');
      tombol.disabled = false;
      if (label && tombol.dataset.labelAsli) label.textContent = tombol.dataset.labelAsli;
    }
  };

  NotificationManager.prototype.labelTombolKerja = function (teks) {
    return '<span class="btn-spinner"></span><span class="btn-label">' + this.esc(teks) + '</span>';
  };

  /* ---------------- Backward compatibility: expose on MT ---------------- */

  MT.icon = function (nama, extraKelas) { return MT._modules && MT._modules.notifications ? MT._modules.notifications.icon(nama, extraKelas) : (new NotificationManager()).icon(nama, extraKelas); };
  MT.esc = function (teks) { return MT._modules && MT._modules.notifications ? MT._modules.notifications.esc(teks) : (new NotificationManager()).esc(teks); };
  MT.tanggalSelisih = function (hari) { return MT._modules && MT._modules.notifications ? MT._modules.notifications.tanggalSelisih(hari) : (new NotificationManager()).tanggalSelisih(hari); };
  MT.formatTanggal = function (iso) { return MT._modules && MT._modules.notifications ? MT._modules.notifications.formatTanggal(iso) : (new NotificationManager()).formatTanggal(iso); };
  MT.formatTanggalLengkap = function (iso) { return MT._modules && MT._modules.notifications ? MT._modules.notifications.formatTanggalLengkap(iso) : (new NotificationManager()).formatTanggalLengkap(iso); };
  MT.labelBulan = function (tahunBulan) { return MT._modules && MT._modules.notifications ? MT._modules.notifications.labelBulan(tahunBulan) : (new NotificationManager()).labelBulan(tahunBulan); };
  MT.labelPendekTanggal = function (iso) { return MT._modules && MT._modules.notifications ? MT._modules.notifications.labelPendekTanggal(iso) : (new NotificationManager()).labelPendekTanggal(iso); };
  MT.selisihHari = function (iso) { return MT._modules && MT._modules.notifications ? MT._modules.notifications.selisihHari(iso) : (new NotificationManager()).selisihHari(iso); };
  MT.infoDeadline = function (iso, status) { return MT._modules && MT._modules.notifications ? MT._modules.notifications.infoDeadline(iso, status) : (new NotificationManager()).infoDeadline(iso, status); };
  MT.inisial = function (nama) { return MT._modules && MT._modules.notifications ? MT._modules.notifications.inisial(nama) : (new NotificationManager()).inisial(nama); };
  MT.avatar = function (nama, kelas) { return MT._modules && MT._modules.notifications ? MT._modules.notifications.avatar(nama, kelas) : (new NotificationManager()).avatar(nama, kelas); };
  MT.kelasStatus = function (status) { return MT._modules && MT._modules.notifications ? MT._modules.notifications.kelasStatus(status) : (new NotificationManager()).kelasStatus(status); };
  MT.badgeStatus = function (status) { return MT._modules && MT._modules.notifications ? MT._modules.notifications.badgeStatus(status) : (new NotificationManager()).badgeStatus(status); };
  MT.badgeRole = function (role) { return MT._modules && MT._modules.notifications ? MT._modules.notifications.badgeRole(role) : (new NotificationManager()).badgeRole(role); };
  MT.kapital = function (teks) { return MT._modules && MT._modules.notifications ? MT._modules.notifications.kapital(teks) : (new NotificationManager()).kapital(teks); };
  MT.potong = function (teks, batas) { return MT._modules && MT._modules.notifications ? MT._modules.notifications.potong(teks, batas) : (new NotificationManager()).potong(teks, batas); };
  MT.jeda = function (ms) { return MT._modules && MT._modules.notifications ? MT._modules.notifications.jeda(ms) : (new NotificationManager()).jeda(ms); };
  MT.toast = function (tipe, judul, pesan) { return MT._modules && MT._modules.notifications ? MT._modules.notifications.toast(tipe, judul, pesan) : (new NotificationManager()).toast(tipe, judul, pesan); };
  MT.modal = function (opsi) { return MT._modules && MT._modules.notifications ? MT._modules.notifications.modal(opsi) : (new NotificationManager()).modal(opsi); };
  MT.konfirmasi = function (opsi) { return MT._modules && MT._modules.notifications ? MT._modules.notifications.konfirmasi(opsi) : (new NotificationManager()).konfirmasi(opsi); };
  MT.setTombolLoading = function (tombol, loading, labelLoading) { return MT._modules && MT._modules.notifications ? MT._modules.notifications.setTombolLoading(tombol, loading, labelLoading) : (new NotificationManager()).setTombolLoading(tombol, loading, labelLoading); };
  MT.labelTombolKerja = function (teks) { return MT._modules && MT._modules.notifications ? MT._modules.notifications.labelTombolKerja(teks) : (new NotificationManager()).labelTombolKerja(teks); };

  MT.NotificationManager = NotificationManager;
})(window.MT);
