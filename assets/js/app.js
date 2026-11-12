/* ============================================================
   app.js — Shell aplikasi, routing berbasis hash, guard role,
   penanganan aksi terpusat, dan penyimpanan form generik.
   ============================================================ */

window.MT = window.MT || {};

(function (MT) {
  'use strict';

  var elAuth = document.getElementById('view-auth');
  var elApp = document.getElementById('view-app');
  var elSessionLoading = document.getElementById('session-loading');
  var elContent = document.getElementById('konten');
  var elNav = document.getElementById('sidebar-nav');
  var elRailNav = document.getElementById('rail-nav');
  var elJudul = document.getElementById('page-title');
  var elBreadcrumb = document.getElementById('breadcrumb');
  var modalRoot = document.getElementById('modal-root');

  /* Registri ini sudah disiapkan di store.js dan diisi oleh berkas view.
     Gunakan `|| {}` agar tidak menghapus pendaftaran yang sudah ada. */
  MT.aksi = MT.aksi || {};                 /* aksi global: data-action="..." */
  MT.modulHandler = MT.modulHandler || {}; /* handler toolbar per modul */
  MT.rute = MT.rute || {};                 /* daftar rute */
  var tokenRender = 0;

  /* ---------------- Navigasi ---------------- */

  /* Grup menu untuk hierarchy sidebar utama */
  var NAV_SECTIONS = [
    {
      judul: 'nav.workspace',
      items: [
        { nama: 'dashboard', label: 'nav.dashboard', ikon: 'dashboard' }
      ]
    },
    {
      judul: 'nav.pengelolaan',
      items: [
        { nama: 'tugas', label: 'nav.manajemen_tugas', ikon: 'tasks' },
        { nama: 'laporan', label: 'nav.manajemen_laporan', ikon: 'report' },
        { nama: 'pengingat', label: 'nav.pengingat', ikon: 'reminder' }
      ]
    },
    {
      judul: 'nav.administrasi',
      items: [
        { nama: 'pengguna', label: 'nav.manajemen_pengguna', ikon: 'users', hanyaOwner: true },
        { nama: 'aktivitas', label: 'nav.aktivitas', ikon: 'book' }
      ]
    }
  ];

  function hitungNav(nama) {
    var ringkasan = MT.store.ringkasan();
    if (nama === 'tugas') {
      var t = ringkasan.tugas;
      return (Number(t.belum) || 0) + (Number(t.proses) || 0);
    }
    if (nama === 'laporan') {
      var l = ringkasan.laporan;
      return (Number(l.belum) || 0) + (Number(l.proses) || 0);
    }
    if (nama === 'pengingat') {
      return Number(ringkasan.pengingat.aktif) || 0;
    }
    return null;
  }

  function gambarNav(namaAktif) {
    var owner = MT.store.adalahOwner();
    var html = '';
    var railHtml = '';
    NAV_SECTIONS.forEach(function (sec) {
      html += '<section class="nav-group"><h2 class="nav-section">' + MT.esc(MT.t(sec.judul)) + '</h2><ul class="nav-list">';
      railHtml += '<section class="rail-group"><span class="rail-section-spacer" aria-hidden="true"></span><ul class="rail-list">';
      sec.items.forEach(function (item) {
        var label = MT.t(item.label);
        var terkunci = item.hanyaOwner && !owner;
        var jumlah = terkunci ? null : hitungNav(item.nama);
        var aktif = namaAktif === item.nama;
        var kelasAktif = aktif ? ' is-active' : '';
        var kelasTerkunci = terkunci ? ' is-locked' : '';
        var atributAktif = aktif ? ' aria-current="page"' : '';
        var atributTerkunci = terkunci ? ' aria-disabled="true" tabindex="-1"' : '';
        html += '<li class="nav-list-item"><a class="nav-item' + kelasAktif + kelasTerkunci + '" ' +
          'href="#/' + item.nama + '" data-nav="' + item.nama + '"' +
          atributAktif + atributTerkunci +
          '>' +
          '<span class="nav-label">' + MT.esc(label) + '</span>' +
          (jumlah != null ? '<span class="nav-count" title="' + MT.esc(MT.t('nav.jumlah_data')) + '">' + jumlah + '</span>' : '') +
          (terkunci ? '<span class="nav-count">' + MT.esc(MT.t('role.owner')) + '</span>' : '') +
          '</a></li>';
        railHtml += '<li class="rail-list-item"><a class="rail-item' + kelasAktif + kelasTerkunci + '" ' +
          'href="#/' + item.nama + '" data-nav="' + item.nama + '" title="' + MT.esc(label) + '" aria-label="' + MT.esc(label) + '"' +
          atributAktif + atributTerkunci +
          '><span class="rail-icon">' + MT.icon(item.ikon) + '</span></a></li>';
      });
      html += '</ul></section>';
      railHtml += '</ul></section>';
    });
    if (elNav) elNav.innerHTML = html;
    if (elRailNav) elRailNav.innerHTML = railHtml;
    var railLogout = document.querySelector('.rail-logout .rail-icon');
    if (railLogout && !railLogout.innerHTML) railLogout.innerHTML = MT.icon('logout');
  }

  function gambarProfilShell() {
    var u = MT.store.penggunaAktif();
    if (!u) return;
    var labelRole = MT.t(u.role === 'owner' ? 'role.owner' : 'role.user');
    document.getElementById('rail-avatar').textContent = MT.inisial(u.nama);
    document.getElementById('sidebar-user-name').textContent = u.nama;
    document.getElementById('sidebar-user-role').textContent = MT.t('label.masuk_sebagai') + ' ' + labelRole;
    document.getElementById('topbar-avatar').textContent = MT.inisial(u.nama);
    document.getElementById('topbar-user-name').textContent = u.nama;
    document.getElementById('topbar-user-role').textContent = labelRole;
    document.getElementById('dropdown-user-name').textContent = u.nama;
    document.getElementById('dropdown-user-email').textContent = u.email;
  }

  function tautkanSorotNav(container) {
    if (!container) return;
    function tautkan(el) {
      if (!el || !el.dataset.nav) return;
      document.querySelectorAll('.nav-item[data-nav], .rail-item[data-nav]').forEach(function (pasangan) {
        if (pasangan.dataset.nav === el.dataset.nav) pasangan.classList.add('is-linked-highlight');
      });
    }
    function lepaskan(el, relatedTarget) {
      if (!el || !el.dataset.nav) return;
      var tujuan = relatedTarget && relatedTarget.closest
        ? relatedTarget.closest('.nav-item[data-nav], .rail-item[data-nav]')
        : null;
      if (tujuan && tujuan.dataset.nav === el.dataset.nav) return;
      var fokus = document.activeElement && document.activeElement.closest
        ? document.activeElement.closest('.nav-item[data-nav], .rail-item[data-nav]')
        : null;
      var pasanganNav = document.querySelectorAll('.nav-item[data-nav], .rail-item[data-nav]');
      if (fokus && fokus.dataset.nav === el.dataset.nav) return;
      for (var i = 0; i < pasanganNav.length; i++) {
        if (pasanganNav[i].dataset.nav === el.dataset.nav && pasanganNav[i].matches(':hover')) return;
      }
      pasanganNav.forEach(function (pasangan) {
        if (pasangan.dataset.nav === el.dataset.nav) pasangan.classList.remove('is-linked-highlight');
      });
    }
    container.addEventListener('pointerover', function (event) {
      var el = event.target.closest('.nav-item[data-nav], .rail-item[data-nav]');
      if (el && !(event.relatedTarget && el.contains(event.relatedTarget))) tautkan(el);
    });
    container.addEventListener('pointerout', function (event) {
      lepaskan(event.target.closest('.nav-item[data-nav], .rail-item[data-nav]'), event.relatedTarget);
    });
    container.addEventListener('focusin', function (event) {
      tautkan(event.target.closest('.nav-item[data-nav], .rail-item[data-nav]'));
    });
    container.addEventListener('focusout', function (event) {
      lepaskan(event.target.closest('.nav-item[data-nav], .rail-item[data-nav]'), event.relatedTarget);
    });
  }

  tautkanSorotNav(elNav);
  tautkanSorotNav(elRailNav);

  function setJudul(judul, remah) {
    elJudul.textContent = judul;
    var html = remah.map(function (r, i) {
      var terakhir = i === remah.length - 1;
      return terakhir
        ? '<span aria-current="page">' + MT.esc(r.label) + '</span>'
        : '<a href="#/' + r.rute + '">' + MT.esc(r.label) + '</a><span class="crumb-sep" aria-hidden="true">/</span>';
    }).join('');
    elBreadcrumb.innerHTML = html;
  }

  /* ---------------- Routing ---------------- */

  function uraiHash() {
    var bersih = location.hash.replace(/^#\/?/, '');
    var bagian = bersih.split('/').filter(Boolean);
    if (bagian[0] === 'pengaturan-akun' || bagian[0] === 'account-settings') {
      bagian[0] = 'profil';
    }
    var id = null;
    if (bagian[1]) {
      try {
        id = decodeURIComponent(bagian[1]);
      } catch {
        return { nama: '__invalid_route__', id: null };
      }
    }
    return { nama: bagian[0] || 'dashboard', id: id };
  }

  function pulihkanRutePath() {
    if (location.hash && location.hash !== '#/') return;
    var path = location.pathname.replace(/\/+$/, '').toLowerCase();
    if (!path || path === '/index.html') return;
    var rute = {
      '/dashboard': 'dashboard',
      '/tasks': 'tugas',
      '/tugas': 'tugas',
      '/reports': 'laporan',
      '/laporan': 'laporan',
      '/reminders': 'pengingat',
      '/pengingat': 'pengingat',
      '/users': 'pengguna',
      '/pengguna': 'pengguna',
      '/activity': 'aktivitas',
      '/aktivitas': 'aktivitas',
      '/notes': 'catatan',
      '/catatan': 'catatan',
      '/profile': 'profil',
      '/profil': 'profil',
      '/pengaturan-akun': 'profil',
      '/account-settings': 'profil'
    };
    location.hash = '#/' + (rute[path] || '__not_found__');
  }

  function halamanAksesDitolak() {
    return '<div class="panel"><div class="state-block">' +
      '<span class="state-icon">' + MT.icon('shield') + '</span>' +
      '<h3>Akses modul ini terbatas untuk Owner</h3>' +
      '<p>Akun Anda terdaftar sebagai <strong>User</strong>. Pada matriks izin sementara, pengelolaan data user hanya tersedia untuk Owner. ' +
      'Pemeriksaan izin pada aplikasi nyata wajib dilakukan di sisi server, bukan hanya menyembunyikan menu.</p>' +
      '<div class="state-actions">' +
      '<a class="btn btn-primary" href="#/dashboard">' + MT.icon('arrowLeft') + 'Kembali ke Dashboard</a>' +
      '<a class="btn btn-ghost" href="#/catatan">Lihat catatan izin &amp; keputusan terbuka</a>' +
      '</div></div></div>';
  }

  function halamanTidakDitemukan() {
    return '<div class="panel"><div class="state-block">' +
      '<span class="state-icon">' + MT.icon('search') + '</span>' +
      '<h3>Halaman tidak ditemukan</h3>' +
      '<p>Alamat yang Anda buka tidak tersedia pada aplikasi ini. Gunakan navigasi di samping untuk kembali ke modul yang tersedia.</p>' +
      '<div class="state-actions"><a class="btn btn-primary" href="#/dashboard">' + MT.icon('arrowLeft') + 'Ke Dashboard</a></div>' +
      '</div></div>';
  }

  function halamanGalatMuat(pesan) {
    return '<div class="panel">' + MT.comp.stateGalat({
      judul: 'Halaman gagal dimuat',
      pesan: pesan || 'Terjadi kendala saat menghubungi server. Periksa koneksi Anda, lalu coba muat ulang halaman.',
      aksiCobaLagi: 'app.muatUlang'
    }) + '</div>';
  }

  MT.renderRute = function () {
    if (!MT.store.penggunaAktif()) return;
    var r = uraiHash();
    if (r.nama === 'dev') { location.hash = '#/dashboard'; return; }
    var token = ++tokenRender;
    var rute = MT.rute[r.nama];
    var namaRute = r.nama;
    var mulaiTandai = 'route-start-' + namaRute + '-' + Date.now();
    MT.perf.tandai(mulaiTandai);
    performance.mark('route-transition-' + Date.now());

    if (!rute && MT.lazyChunks[r.nama]) {
      elContent.innerHTML = MT.comp.skeletonHalaman();
      elContent.setAttribute('aria-busy', 'true');
      MT.muatView(r.nama).then(function () {
        if (token !== tokenRender) return;
        MT.renderRute();
      }).catch(function (err) {
        if (token !== tokenRender) return;
        elContent.removeAttribute('aria-busy');
        elContent.innerHTML = halamanGalatMuat(err && err.message);
      });
      return;
    }

    if (!rute) {
      gambarNav(null);
      setJudul('Halaman tidak ditemukan', [{ label: 'Beranda', rute: 'dashboard' }, { label: 'Tidak ditemukan' }]);
      elContent.innerHTML = halamanTidakDitemukan();
      elContent.focus();
      MT.perf.ukur('route-' + namaRute, mulaiTandai, 'render-end-' + namaRute + '-' + Date.now());
      return;
    }

    /* UI guard for convenience; API endpoints enforce authorization. */
    if (rute.hanyaOwner && !MT.store.adalahOwner()) {
      gambarNav(r.nama);
      setJudul('Akses ditolak', [{ label: 'Dashboard', rute: 'dashboard' }, { label: 'Manajemen Pengguna' }]);
      elContent.innerHTML = halamanAksesDitolak();
      elContent.focus();
      MT.perf.ukur('route-' + namaRute, mulaiTandai, 'render-end-' + namaRute + '-' + Date.now());
      return;
    }

    gambarNav(r.nama);
    setJudul(rute.judul(r.id), rute.remah ? rute.remah(r.id) : [{ label: rute.judul(r.id) }]);
    elContent.innerHTML = MT.comp.skeletonHalaman();
    elContent.setAttribute('aria-busy', 'true');

    var viewPromise = Promise.resolve();
    if (MT.lazyChunks[r.nama]) {
      viewPromise = MT.muatView(r.nama);
    }

    viewPromise.then(function () {
      return MT.store.muat();
    }).then(function () {
      return rute.render(r.id);
    }).then(function (html) {
      if (token !== tokenRender) return;
      elContent.removeAttribute('aria-busy');
      elContent.innerHTML = html;
      elContent.focus();
      if (rute.setelah) rute.setelah(r.id);
      MT.perf.ukur('route-' + namaRute, mulaiTandai, 'render-end-' + namaRute + '-' + Date.now());
    }).catch(function (err) {
      if (token !== tokenRender) return;
      elContent.removeAttribute('aria-busy');
      if (err && err.status === 401) {
        MT.sesiBerakhir();
        MT.toast('info', 'Sesi berakhir', 'Silakan masuk kembali untuk melanjutkan.');
        return;
      }
      elContent.innerHTML = halamanGalatMuat(err && err.pesan);
    });
  };

  MT.tampilkanPemulihan = function (gagal) {
    elApp.hidden = true;
    elAuth.hidden = true;
    if (elSessionLoading) {
      elSessionLoading.hidden = false;
      elSessionLoading.setAttribute('aria-busy', gagal ? 'false' : 'true');
      elSessionLoading.classList.toggle('is-error', !!gagal);
      var pesan = elSessionLoading.querySelector('[data-session-message]');
      var ulang = elSessionLoading.querySelector('[data-action="auth.retry"]');
      if (pesan) pesan.textContent = gagal
        ? 'Sesi belum dapat diperiksa. Periksa koneksi, lalu coba lagi.'
        : 'Memeriksa sesi Anda...';
      if (ulang) ulang.hidden = !gagal;
    }
    document.title = 'Memeriksa sesi — ManagenTugas.id';
  };

  MT.tampilkanAuth = function () {
    elApp.hidden = true;
    if (elSessionLoading) elSessionLoading.hidden = true;
    elAuth.hidden = false;
    document.title = MT.t('app.title.auth');
    var email = document.getElementById('auth-email');
    if (email) setTimeout(function () { if (!elAuth.hidden) email.focus(); }, 0);
  };

  MT.sesiBerakhir = function () {
    MT.store.bersihkanSesi();
    MT.tampilkanAuth();
  };

  MT.tampilkanApp = function () {
    if (elSessionLoading) elSessionLoading.hidden = true;
    elAuth.hidden = true;
    elApp.hidden = false;
    var pengguna = MT.store.penggunaAktif();
    if (pengguna && pengguna.tema && MT.theme) {
      MT.theme.set(pengguna.tema);
      if (MT.applyTheme) MT.applyTheme();
    }
    if (pengguna && pengguna.bahasa && MT.i18n && pengguna.bahasa !== MT.i18n.getLocale()) {
      MT.i18n.setLocale(pengguna.bahasa).catch(function (error) {
        console.error('Preferensi bahasa akun gagal dimuat.', error);
        MT.toast('error', 'Preferensi bahasa belum diterapkan', 'Periksa koneksi lalu muat ulang halaman.');
      });
    }
    gambarProfilShell();
    var themeContainer = document.getElementById('theme-switch-container');
    if (themeContainer && MT.themeSwitcher) {
      themeContainer.innerHTML = MT.themeSwitcher();
    }
    var langContainer = document.getElementById('lang-switch-container');
    if (langContainer && MT.bahasaSwitcher) {
      langContainer.innerHTML = MT.bahasaSwitcher();
    }
    if (!location.hash || location.hash === '#/') location.hash = '#/dashboard';
    if (MT.updateMeta) MT.updateMeta();
    MT.renderRute();
  };

  MT.masukBerhasil = function () {
    MT.tampilkanApp();
    MT.toast('success', MT.t('toast.berhasil_masuk'), MT.t('toast.selamat_datang', { nama: MT.store.penggunaAktif().nama }));
  };

  var SESSION_EVENT_KEY = 'MT.auth.session-event';

  function umumkanKeluar() {
    try {
      localStorage.setItem(SESSION_EVENT_KEY, JSON.stringify({
        event: 'logout',
        id: Date.now() + '-' + Math.random().toString(36).slice(2)
      }));
    } catch (error) {
      console.warn('Logout lintas tab tidak dapat disinkronkan.', error);
    }
  }

  function jalankanKeluar(ctrl) {
    var tombolKeluar = ctrl && ctrl.el.querySelector('[data-logout-confirm]');
    var tombolBatal = ctrl && ctrl.el.querySelector('[data-logout-cancel]');
    var status = ctrl && ctrl.el.querySelector('[data-logout-status]');
    if (tombolKeluar) MT.setTombolLoading(tombolKeluar, true, 'Mengakhiri sesi...');
    if (tombolBatal) tombolBatal.disabled = true;

    return MT.store.keluar().then(function () {
      umumkanKeluar();
      if (ctrl && ctrl.el.isConnected) ctrl.tutup();
      MT.tampilkanAuth();
      MT.toast('info', 'Anda telah keluar', 'Sesi Anda telah diakhiri.');
    }).catch(function (err) {
      var pesan = (err && err.pesan) || 'Sesi belum dapat diakhiri.';
      if (status && ctrl.el.isConnected) {
        status.textContent = 'Gagal keluar: ' + pesan;
        status.hidden = false;
        MT.setTombolLoading(tombolKeluar, false);
        if (tombolBatal) tombolBatal.disabled = false;
      } else {
        MT.toast('error', 'Gagal keluar', pesan);
      }
    });
  }

  MT.keluar = function (opsi) {
    if (opsi && opsi.otomatis) {
      return jalankanKeluar(null);
    }
    var pemicu = document.activeElement;
    if (pemicu && pemicu.closest && pemicu.closest('#user-dropdown')) {
      tutupMenuPengguna();
      var tombolPengguna = document.getElementById('user-chip');
      if (tombolPengguna) tombolPengguna.focus();
    }
    var ctrl = MT.modal({
      ukuran: 'sm',
      judul: 'Keluar dari akun?',
      body: '<p>Anda perlu masuk kembali untuk mengakses ruang kerja.</p>' +
        '<p class="muted-sm" data-logout-status role="status" hidden></p>',
      footer: '<button type="button" class="btn btn-ghost" data-logout-cancel data-autofocus>Tetap masuk</button>' +
        '<button type="button" class="btn btn-danger" data-logout-confirm><span class="btn-spinner"></span>' +
          '<span class="btn-label">Keluar</span></button>'
    });
    ctrl.el.querySelector('[data-logout-cancel]').addEventListener('click', ctrl.tutup);
    ctrl.el.querySelector('[data-logout-confirm]').addEventListener('click', function () {
      jalankanKeluar(ctrl);
    });
    return ctrl;
  };

  /* ---------------- Penyimpanan form generik ---------------- */

  function kumpulkanNilai(form) {
    var nilai = {};
    new FormData(form).forEach(function (v, k) {
      nilai[k] = typeof v === 'string' && k !== 'kataSandi' ? v.trim() : v;
    });
    return nilai;
  }

  MT.bersihkanGalat = function (form) {
    form.querySelectorAll('[aria-invalid="true"]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
    form.querySelectorAll('.field-error').forEach(function (el) { el.hidden = true; el.textContent = ''; });
    var slot = form.querySelector('[data-slot-ringkasan]');
    if (slot) slot.innerHTML = '';
  };

  MT.tampilkanGalatValidasi = function (form, galat) {
    var kunci = Object.keys(galat);
    kunci.forEach(function (nama) {
      var input = form.querySelector('[name="' + nama + '"]');
      if (!input) return;
      var field = input.closest('.field');
      var pesanEl = field ? field.querySelector('.field-error') : null;
      input.setAttribute('aria-invalid', 'true');
      if (pesanEl) {
        pesanEl.hidden = false;
        pesanEl.innerHTML = MT.icon('alert') + MT.esc(galat[nama]);
      }
    });
    var slot = form.querySelector('[data-slot-ringkasan]');
    if (slot) slot.innerHTML = MT.comp.ringkasanGalat(kunci.length);
    var pertama = form.querySelector('[aria-invalid="true"]');
    if (pertama) pertama.focus();
  };

  /* Simpan data: validasi -> loading -> sukses/gagal.
     Selalu mempertahankan isian pengguna saat gagal. */
  MT.simpanForm = function (opsi) {
    var form = opsi.form;
    var koleksi = opsi.koleksi;
    var mode = opsi.mode;
    var tombol = opsi.tombol;
    var nilai = kumpulkanNilai(form);

    MT.bersihkanGalat(form);
    var hasil = MT.validasi(nilai, MT.aturan[koleksi], mode);

    if (!hasil.valid) {
      MT.tampilkanGalatValidasi(form, hasil.galat);
      MT.toast('error', 'Data belum lengkap', 'Periksa ' + hasil.jumlah + ' isian yang ditandai pada formulir.');
      return Promise.resolve(false);
    }

    MT.setTombolLoading(tombol, true, mode === 'tambah' ? 'Menyimpan…' : 'Memperbarui…');
    var permintaan = mode === 'tambah'
      ? MT.store.tambah(koleksi, nilai)
      : MT.store.ubah(koleksi, opsi.id, nilai);

    return permintaan.then(function (hasilData) {
      MT.setTombolLoading(tombol, false);
      MT.toast('success',
        mode === 'tambah' ? 'Data berhasil disimpan' : 'Perubahan berhasil disimpan',
        '“' + MT.potong(hasilData.nama, 46) + '” tersimpan di database.');
      if (opsi.setelahSukses) opsi.setelahSukses(hasilData);
      return true;
    }).catch(function (err) {
      MT.setTombolLoading(tombol, false);
      var slot = form.querySelector('[data-slot-ringkasan]');
      var pesanServer = (err && err.pesan) || 'Data belum dapat disimpan. Silakan coba lagi.';
      if (err && err.fields) {
        MT.tampilkanGalatValidasi(form, err.fields);
      } else if (err && err.field) {
        var input = form.querySelector('[name="' + err.field + '"]');
        if (input) {
          input.setAttribute('aria-invalid', 'true');
          var field = input.closest('.field');
          var pesanEl = field ? field.querySelector('.field-error') : null;
          if (pesanEl) { pesanEl.hidden = false; pesanEl.innerHTML = MT.icon('alert') + MT.esc(err.pesanField || err.pesan); }
          input.focus();
        }
      }
      if (slot) {
        slot.innerHTML = '<div class="alert alert-danger" role="alert" style="margin-bottom:16px">' +
          '<span class="alert-icon">' + MT.icon('alert') + '</span>' +
          '<div><strong>' + MT.esc(mode === 'tambah' ? 'Data belum dapat disimpan' : 'Perubahan belum dapat disimpan') + '</strong>' +
          '<p>' + MT.esc(pesanServer) + ' Isian Anda tidak hilang — silakan tekan simpan kembali.</p></div></div>';
      }
      MT.toast('error', mode === 'tambah' ? 'Gagal menyimpan' : 'Gagal memperbarui', pesanServer);
      return false;
    });
  };

  /* Hapus terkonfirmasi */
  MT.hapusTerkonfirmasi = function (o) {
    return MT.konfirmasi({
      judul: 'Hapus ' + o.label + '?',
      pesanSingkat: 'Tindakan ini tidak dapat dibatalkan',
      pesan: '“' + o.nama + '” akan dihapus dari daftar ' + o.label + '.',
      catatan: 'Penghapusan tidak dapat dibatalkan.',
      labelYa: 'Ya, hapus',
      nada: 'danger'
    }).then(function (ya) {
      if (!ya) {
        MT.toast('info', 'Penghapusan dibatalkan', 'Data tidak berubah.');
        return false;
      }
      return MT.store.hapus(o.koleksi, o.id).then(function () {
        MT.toast('success', MT.comp.kapital(o.label) + ' berhasil dihapus', '“' + MT.potong(o.nama, 46) + '” telah dihapus dari database.');
        if (o.setelahSukses) o.setelahSukses();
        return true;
      }).catch(function (err) {
        MT.toast('error', 'Gagal menghapus', (err && err.pesan) || 'Data belum dapat dihapus. Silakan coba lagi.');
        return false;
      });
    });
  };

  /* ---------------- Mode developer (panel terpisah) ----------------
     Alat uji state, pergantian role, dan akun contoh. Tidak muncul
     pada antarmuka normal; dibuka lewat Ctrl/Cmd + Shift + D atau #/dev. */

  var elDevDrawer = document.getElementById('dev-drawer');
  var elDevScrim = document.getElementById('dev-scrim');
  var elDevBody = document.getElementById('dev-body');

  function barisUji(judul, deskripsi, aktif, kunci) {
    return '<div class="toggle-row">' +
      '<div class="toggle-row-text"><strong>' + judul + '</strong><span>' + deskripsi + '</span></div>' +
      '<button type="button" class="switch" role="switch" aria-checked="' + (aktif ? 'true' : 'false') + '" ' +
      'aria-label="' + judul + '" data-action="dev.toggle" data-kunci="' + kunci + '"></button>' +
      '</div>';
  }

  function gambarDev() {
    var p = MT.store.prefs;
    var u = MT.store.penggunaAktif();
    var roleSekarang = u ? (u.role === 'owner' ? 'Owner' : 'User') : 'belum masuk';
    elDevBody.innerHTML =
      '<div class="dev-section">' +
        '<p class="dev-eyebrow">Pergantian role</p>' +
        '<p class="dev-note">Masuk cepat sebagai akun contoh untuk menguji perbedaan tampilan dan izin. Role saat ini: <strong>' + roleSekarang + '</strong>.</p>' +
        '<div class="dev-actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-action="dev.masuk" data-role="owner">Masuk sebagai Owner</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-action="dev.masuk" data-role="user">Masuk sebagai User</button>' +
        '</div>' +
      '</div>' +
      '<div class="dev-section">' +
        '<p class="dev-eyebrow">Simulasi state</p>' +
        barisUji('Gagal memuat daftar', 'Menampilkan state error beserta tombol “Coba lagi”.', p.errorMuat, 'errorMuat') +
        barisUji('Gagal menyimpan', 'Setiap simpan, ubah, dan hapus berakhir dengan pesan kegagalan server.', p.errorSimpan, 'errorSimpan') +
        barisUji('Koneksi lambat', 'Menambah jeda muat ±2 detik untuk menguji indikator loading.', p.jedaMuat > 1000, 'lambat') +
      '</div>' +
      '<div class="dev-section">' +
        '<p class="dev-eyebrow">Data &amp; dokumentasi</p>' +
        '<p class="dev-note">Data aplikasi disimpan di server; fitur reset data tidak tersedia.</p>' +
        '<div class="dev-actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-action="dev.reset">' + MT.icon('refresh') + 'Reset data (nonaktif)</button>' +
          '<a class="btn btn-ghost btn-sm" href="#/catatan">' + MT.icon('book') + 'Catatan &amp; handoff</a>' +
        '</div>' +
      '</div>';
  }

  function bukaDev() {
    if (!MT.store.devMode) return;
    gambarDev();
    elDevDrawer.classList.add('is-open');
    elDevDrawer.removeAttribute('inert');
    elDevDrawer.setAttribute('aria-hidden', 'false');
    elDevScrim.hidden = false;
    var fokus = elDevDrawer.querySelector('[data-action="dev.close"]');
    if (fokus) fokus.focus();
    elDevDrawer.addEventListener('keydown', onDevKeydown);
  }

  function tutupDev() {
    if (!elDevDrawer.classList.contains('is-open')) return;
    elDevDrawer.classList.remove('is-open');
    elDevDrawer.setAttribute('inert', '');
    elDevDrawer.setAttribute('aria-hidden', 'true');
    elDevScrim.hidden = true;
    elDevDrawer.removeEventListener('keydown', onDevKeydown);
  }

  function onDevKeydown(e) {
    if (e.key === 'Escape') { tutupDev(); return; }
    if (e.key !== 'Tab') return;
    var fokusable = elDevDrawer.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!fokusable.length) return;
    var pertama = fokusable[0];
    var terakhir = fokusable[fokusable.length - 1];
    if (e.shiftKey && document.activeElement === pertama) { e.preventDefault(); terakhir.focus(); }
    else if (!e.shiftKey && document.activeElement === terakhir) { e.preventDefault(); pertama.focus(); }
  }

  function toggleDev() {
    if (elDevDrawer.classList.contains('is-open')) tutupDev(); else bukaDev();
  }

  MT.dev = { buka: bukaDev, tutup: tutupDev, toggle: toggleDev };

  MT.aksi['dev.close'] = function () { tutupDev(); };

  MT.aksi['dev.masuk'] = function (ds) {
    MT.toast('info', 'Mode demo dinonaktifkan', 'Gunakan akun yang dibuat di database.');
  };

  MT.aksi['dev.toggle'] = function (ds, e, el) {
    var kunci = ds.kunci;
    var prefsAwal = MT.store.prefs;
    if (kunci === 'lambat') {
      MT.store.setPrefs({ jedaMuat: prefsAwal.jedaMuat > 1000 ? 420 : 2200 });
    } else {
      var perubahan = {};
      perubahan[kunci] = !prefsAwal[kunci];
      MT.store.setPrefs(perubahan);
    }
    var p = MT.store.prefs;
    el.setAttribute('aria-checked', (kunci === 'lambat' ? (p.jedaMuat > 1000) : p[kunci]) ? 'true' : 'false');
    MT.toast('info', 'Pengaturan uji diperbarui',
      kunci === 'lambat'
        ? 'Simulasi koneksi lambat ' + (p.jedaMuat > 1000 ? 'aktif' : 'nonaktif') + '.'
        : kunci === 'errorMuat'
          ? 'Simulasi gagal memuat ' + (p.errorMuat ? 'aktif' : 'nonaktif') + '.'
          : 'Simulasi gagal menyimpan ' + (p.errorSimpan ? 'aktif' : 'nonaktif') + '.');
  };

  MT.aksi['dev.reset'] = function () {
    MT.toast('info', 'Data demo tidak tersedia', 'Data tersimpan di database dan tidak dapat di-reset dari aplikasi.');
  };

  MT.aksi['app.muatUlang'] = function () {
    MT.renderRute();
  };

  MT.aksi['i18n.switch'] = function (ds) {
    var locale = ds.locale;
    if (!locale) return;
    var sebelumnya = MT.i18n.getLocale();
    MT.i18n.setLocale(locale).then(function () {
      document.documentElement.lang = MT.i18n.getLocale();
      MT.renderRute();
      var pengguna = MT.store.penggunaAktif();
      if (pengguna && pengguna.bahasa !== locale) {
        return MT.store.simpanProfil({ bahasa: locale }).catch(function (error) {
          console.error('Preferensi bahasa gagal disimpan.', error);
          MT.i18n.setLocale(sebelumnya).then(function () {
            document.documentElement.lang = MT.i18n.getLocale();
            MT.renderRute();
          }).catch(function (rollbackError) {
            console.error('Bahasa sebelumnya gagal dipulihkan.', rollbackError);
          });
          MT.toast('error', 'Bahasa belum tersimpan',
            (error && error.pesan) || 'Periksa koneksi lalu coba lagi.');
        });
      }
    }).catch(function (error) {
      console.error('Bahasa aplikasi gagal dimuat.', error);
      MT.toast('error', 'Bahasa belum dapat dimuat', 'Periksa koneksi lalu coba lagi.');
    });
  };

  /* ---------------- Navigasi shell ---------------- */

  function tutupSidebar() {
    document.getElementById('sidebar').classList.remove('is-open');
    var scrim = document.querySelector('.sidebar-scrim');
    if (scrim) scrim.hidden = true;
  }

  MT.aksi['nav.openSidebar'] = function () {
    document.getElementById('sidebar').classList.add('is-open');
    var scrim = document.querySelector('.sidebar-scrim');
    if (scrim) scrim.hidden = false;
    var fokus = document.querySelector('.sidebar-close');
    if (fokus) fokus.focus();
  };

  MT.aksi['nav.closeSidebar'] = tutupSidebar;

  function tutupMenuPengguna() {
    var dd = document.getElementById('user-dropdown');
    var chip = document.getElementById('user-chip');
    if (dd) dd.hidden = true;
    if (chip) chip.setAttribute('aria-expanded', 'false');
  }

  MT.aksi['userMenu.toggle'] = function (ds, e, el) {
    var dd = document.getElementById('user-dropdown');
    var terbuka = !dd.hidden;
    dd.hidden = terbuka;
    el.setAttribute('aria-expanded', terbuka ? 'false' : 'true');
    /* Tutup panel glass select lain */
    document.querySelectorAll('[data-fg-select] .fg-panel').forEach(function (p) { p.hidden = true; });
    document.querySelectorAll('[data-fg-select] .fg-select-trigger').forEach(function (t) {
      t.setAttribute('aria-expanded', 'false');
    });
  };

  MT.aksi['auth.logout'] = function () { MT.keluar(); };
  var cobaPulihkanSesi = null;
  MT.aksi['auth.retry'] = function () {
    if (cobaPulihkanSesi) cobaPulihkanSesi();
  };

  /* ---------------- Event delegation ---------------- */

  document.addEventListener('click', function (e) {
    var target = e.target.closest('[data-action]');
    if (target) {
      var aksi = target.getAttribute('data-action');
      var fn = MT.aksi[aksi];
      if (fn) {
        e.preventDefault();
        fn(Object.assign({}, target.dataset), e, target);
      } else {
        console.warn('Aksi belum terdaftar:', aksi);
      }
      return;
    }
    if (!e.target.closest('.user-menu')) tutupMenuPengguna();
    if (e.target.closest('a[href^="#/"]')) { tutupSidebar(); tutupDev(); }
  });

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
      e.preventDefault();
      if (MT.store.devMode) toggleDev();
      return;
    }
    if (e.key === 'Escape') {
      tutupMenuPengguna();
      tutupDev();
      if (typeof tutupSemuaFgSelect === 'function') tutupSemuaFgSelect();
      return;
    }

    /* Arrow key navigation: user dropdown menu */
    var userDropdown = document.getElementById('user-dropdown');
    if (userDropdown && !userDropdown.hidden) {
      var menuItems = userDropdown.querySelectorAll('[role="menuitem"]');
      if (menuItems.length) {
        var currentIndex = Array.prototype.indexOf.call(menuItems, document.activeElement);
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          e.preventDefault();
          var nextIndex = currentIndex < menuItems.length - 1 ? currentIndex + 1 : 0;
          menuItems[nextIndex].focus();
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          e.preventDefault();
          var prevIndex = currentIndex > 0 ? currentIndex - 1 : menuItems.length - 1;
          menuItems[prevIndex].focus();
        } else if (e.key === 'Home') {
          e.preventDefault();
          menuItems[0].focus();
        } else if (e.key === 'End') {
          e.preventDefault();
          menuItems[menuItems.length - 1].focus();
        }
      }
    }

    /* Arrow key navigation: glass select listbox */
    var activePanel = document.querySelector('.fg-panel:not([hidden])');
    if (activePanel && activePanel.getAttribute('role') === 'listbox') {
      var options = activePanel.querySelectorAll('[role="option"]');
      if (options.length) {
        var currentOptIndex = Array.prototype.indexOf.call(options, document.activeElement);
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          e.preventDefault();
          var nextOptIndex = currentOptIndex < options.length - 1 ? currentOptIndex + 1 : 0;
          options[nextOptIndex].focus();
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          e.preventDefault();
          var prevOptIndex = currentOptIndex > 0 ? currentOptIndex - 1 : options.length - 1;
          options[prevOptIndex].focus();
        } else if (e.key === 'Home') {
          e.preventDefault();
          options[0].focus();
        } else if (e.key === 'End') {
          e.preventDefault();
          options[options.length - 1].focus();
        }
      }
    }
  });

  /* Toolbar: pencarian, filter, urutan, paginasi */
  var timerCari = null;
  elContent.addEventListener('input', function (e) {
    var t = e.target;
    if (t.getAttribute && t.getAttribute('data-toolbar') === 'cari') {
      var modul = t.getAttribute('data-modul');
      var nilai = t.value;
      clearTimeout(timerCari);
      timerCari = setTimeout(function () {
        var h = MT.modulHandler[modul];
        if (h && h.cari) h.cari(nilai);
      }, 220);
    }
  });

  elContent.addEventListener('change', function (e) {
    var t = e.target;
    if (!t.getAttribute || !t.getAttribute('data-toolbar')) return;
    var jenis = t.getAttribute('data-toolbar');
    var modul = t.getAttribute('data-modul');
    var h = MT.modulHandler[modul];
    if (!h) return;
    if (jenis === 'filter' && h.filter) h.filter(t.getAttribute('data-nama'), t.value);
    if (jenis === 'urut' && h.urut) h.urut(t.value);
    if (jenis === 'rekap' && h.rekap) h.rekap(t.getAttribute('data-nama'), t.value);
  });

  /* Floating glass select: buka/tutup panel */
  var fgTriggerAktif = null;

  function tutupSemuaFgSelect(kecuali) {
    var triggerUntukFokus = fgTriggerAktif;
    document.querySelectorAll('[data-fg-select]').forEach(function (wrap) {
      if (kecuali && wrap === kecuali) return;
      var trigger = wrap.querySelector('.fg-select-trigger');
      var panel = wrap.querySelector('.fg-panel');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
      if (panel) panel.hidden = true;
    });
    if (triggerUntukFokus && triggerUntukFokus.focus && !kecuali) {
      triggerUntukFokus.focus();
    }
    if (!kecuali) fgTriggerAktif = null;
  }

  elContent.addEventListener('click', function (e) {
    /* Toggle custom select */
    var trigger = e.target.closest('[data-toolbar-trigger]');
    if (trigger) {
      e.preventDefault();
      e.stopPropagation();
      var wrap = trigger.closest('[data-fg-select]');
      var panel = wrap && wrap.querySelector('.fg-panel');
      var terbuka = trigger.getAttribute('aria-expanded') === 'true';
      tutupSemuaFgSelect(wrap);
      if (panel) {
        panel.hidden = terbuka;
        trigger.setAttribute('aria-expanded', terbuka ? 'false' : 'true');
        if (!terbuka) {
          fgTriggerAktif = trigger;
          var aktif = panel.querySelector('.fg-item.is-active') || panel.querySelector('.fg-item');
          if (aktif) aktif.focus();
        }
      }
      return;
    }

    /* Pilih item di panel glass */
    var item = e.target.closest('[data-toolbar][data-value]');
    if (item) {
      e.preventDefault();
      e.stopPropagation();
      var jenis = item.getAttribute('data-toolbar');
      var modul = item.getAttribute('data-modul');
      var h = MT.modulHandler[modul];
      var nilai = item.getAttribute('data-value');
      var wrap = item.closest('[data-fg-select]');
      /* Update label trigger & active state sebelum re-render slot */
      if (wrap) {
        var labelEl = wrap.querySelector('.fg-select-value');
        var labelTeks = item.querySelector('.fg-item-body strong');
        if (labelEl && labelTeks) labelEl.textContent = labelTeks.textContent;
        wrap.querySelectorAll('.fg-item').forEach(function (it) {
          var aktif = it === item;
          it.classList.toggle('is-active', aktif);
          it.setAttribute('aria-selected', aktif ? 'true' : 'false');
        });
      }
      if (h) {
        if (jenis === 'filter' && h.filter) h.filter(item.getAttribute('data-nama'), nilai);
        if (jenis === 'urut' && h.urut) h.urut(nilai);
        if (jenis === 'rekap' && h.rekap) h.rekap(item.getAttribute('data-nama'), nilai);
      }
      tutupSemuaFgSelect();
      return;
    }

    var t = e.target.closest('[data-toolbar]');
    if (!t) return;
    var jenis2 = t.getAttribute('data-toolbar');
    if (jenis2 !== 'halaman' && jenis2 !== 'urut-kolom') return;
    var modul2 = t.getAttribute('data-modul');
    var h2 = MT.modulHandler[modul2];
    if (!h2) return;
    if (jenis2 === 'halaman' && h2.halaman) h2.halaman(Number(t.getAttribute('data-hal')));
    if (jenis2 === 'urut-kolom' && h2.urutKolom) h2.urutKolom(t.getAttribute('data-kunci'));
  });

  /* Tutup glass panel saat klik di luar */
  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-fg-select]')) tutupSemuaFgSelect();
  });

  /* Form: submit terdelegasi */
  document.addEventListener('submit', function (e) {
    var form = e.target.closest('form[data-form-modul], form[data-form-pengguna]');
    if (!form) return;
    e.preventDefault();
    var koleksi = form.getAttribute('data-form-modul') || 'pengguna';
    var id = form.getAttribute('data-id') || null;
    var tombol = form.querySelector('button[type="submit"], [data-tombol-simpan]');
    var penangan = MT.penanganForm[koleksi];
    if (penangan) penangan({ form: form, koleksi: koleksi, id: id, tombol: tombol });
  });

  MT.penanganForm = MT.penanganForm || {};

  /* ---------------- Session timeout enforcement ---------------- */

  var SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes inactivity
  var WARNING_BEFORE_MS = 5 * 60 * 1000; // warning 5 minutes before timeout
  var timerIdle = null;
  var timerWarning = null;
  var lastActivity = Date.now();

  function resetIdleTimer() {
    lastActivity = Date.now();
    clearTimeout(timerWarning);
    clearTimeout(timerIdle);
    if (!MT.store.penggunaAktif()) return;
    timerWarning = setTimeout(showIdleWarning, SESSION_TIMEOUT_MS - WARNING_BEFORE_MS);
    timerIdle = setTimeout(enforceIdleTimeout, SESSION_TIMEOUT_MS);
  }

  function showIdleWarning() {
    if (!MT.store.penggunaAktif()) return;
    tutupMenuPengguna();
    tutupSemuaFgSelect();
    var ctrl = MT.modal({
      judul: 'Sesi akan berakhir',
      body: '<p>Anda tidak aktif selama beberapa menit. Sesi akan berakhir dalam 5 menit untuk menjaga keamanan akun.</p>' +
        '<p class="muted-sm" style="margin-top:10px">Klik "Tetap masuk" untuk melanjutkan bekerja.</p>',
      footer: '<button type="button" class="btn btn-ghost" data-idle-logout>Keluar sekarang</button>' +
        '<button type="button" class="btn btn-primary" data-idle-stay>Tetap masuk</button>',
      alert: true
    });
    ctrl.el.querySelector('[data-idle-stay]').addEventListener('click', function () {
      ctrl.tutup();
      resetIdleTimer();
    });
    ctrl.el.querySelector('[data-idle-logout]').addEventListener('click', function () {
      ctrl.tutup();
      MT.keluar();
    });
  }

  function enforceIdleTimeout() {
    if (!MT.store.penggunaAktif()) return;
    MT.toast('info', 'Sesi berakhir', 'Anda keluar otomatis karena tidak aktif.');
    MT.keluar({ otomatis: true });
  }

  ['click', 'keydown', 'mousemove', 'touchstart'].forEach(function (event) {
    document.addEventListener(event, function () {
      if (timerIdle || timerWarning) resetIdleTimer();
    }, { passive: true });
  });

  /* ---------------- Lazy view loader ---------------- */

  var viewScriptCache = {};
  MT.lazyChunks = {
    catatan: 'assets/js/views-notes.js',
    profil: 'assets/js/views-notes.js',
    aktivitas: 'assets/js/views-activity.js',
    pengguna: 'assets/js/views-users.js'
  };

  MT.muatView = function (nama) {
    if (viewScriptCache[nama]) return Promise.resolve();
    var src = MT.lazyChunks[nama];
    if (!src) return Promise.resolve();
    var lazyMark = 'lazy-start-' + nama + '-' + Date.now();
    try { performance.mark(lazyMark); } catch (e) { /* noop */ }
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = function () {
        viewScriptCache[nama] = true;
        try {
          var lazyEnd = 'lazy-end-' + nama + '-' + Date.now();
          performance.mark(lazyEnd);
          performance.measure('lazy-load-' + nama, lazyMark, lazyEnd);
        } catch (e) { /* noop */ }
        if (MT.analytics && MT.analytics.onViewLoaded) {
          MT.analytics.onViewLoaded(nama);
        }
        resolve();
      };
      script.onerror = function () {
        reject(new Error('Gagal memuat modul: ' + nama));
      };
      document.head.appendChild(script);
    });
  };

  /* ---------------- Performance marks ---------------- */

  MT.perf = {
    requestCounter: 0,
    tandai: function (nama) {
      try { performance.mark(nama); } catch (e) { /* noop */ }
    },
    ukur: function (nama, mulai, akhir) {
      try {
        performance.mark(akhir);
        performance.measure(nama, mulai, akhir);
        var items = performance.getEntriesByName(nama);
        if (items.length) {
          return Math.round(items[items.length - 1].duration);
        }
      } catch (e) { /* noop */ }
      return null;
    }
  };

  /* ---------------- Render cache for static fragments ---------------- */

  var renderCache = {};
  function cacheRender(kunci, builder) {
    if (renderCache[kunci]) return renderCache[kunci];
    var html = builder();
    renderCache[kunci] = html;
    return html;
  }

  /* ---------------- Inisialisasi ---------------- */

  window.addEventListener('unhandledrejection', function (event) {
    var error = event.reason;
    if (error && error.pesan) {
      MT.toast('error', 'Terjadi kesalahan tak terduga', error.pesan);
    } else {
      MT.toast('error', 'Terjadi kesalahan tak terduga', 'Periksa koneksi lalu muat ulang halaman.');
    }
    console.error('Unhandled promise rejection:', error);
  });

  var sudahInit = false;
  function init() {
    if (sudahInit) return;
    sudahInit = true;
    MT.applyTheme && MT.applyTheme();
    var i18nSiap = MT.i18n.init().then(function () {
      document.documentElement.lang = MT.i18n.getLocale();
      MT.i18n.onChange(function (locale) {
        document.documentElement.lang = locale;
        var langContainer = document.getElementById('lang-switch-container');
        if (langContainer && MT.bahasaSwitcher) {
          langContainer.innerHTML = MT.bahasaSwitcher();
        }
        if (MT.applyTheme) MT.applyTheme();
        if (MT.store.penggunaAktif()) MT.renderRute();
      });
    });
    MT.store.langganan(function () {
      if (MT.store.penggunaAktif()) {
        gambarProfilShell();
        var r = uraiHash();
        gambarNav(MT.rute[r.nama] ? r.nama : null);
      }
    });

    window.addEventListener('hashchange', function () {
      if (!MT.store.penggunaAktif()) return;
      MT.renderRute();
    });

    function mulai() {
      MT.auth.init();
      pulihkanRutePath();
      var sedangPulih = false;
      cobaPulihkanSesi = function () {
        if (sedangPulih) return;
        sedangPulih = true;
        MT.tampilkanPemulihan(false);
        var sessionMark = 'session-start-' + Date.now();
        try { performance.mark(sessionMark); } catch (e) { /* noop */ }
        Promise.resolve().then(function () {
          return MT.store.sesi();
        }).then(function (pengguna) {
          try {
            var sessionEnd = 'session-end-' + Date.now();
            performance.mark(sessionEnd);
            performance.measure('session-load', sessionMark, sessionEnd);
          } catch (e) { /* noop */ }
          if (pengguna) MT.tampilkanApp();
          else MT.tampilkanAuth();
        }).catch(function (error) {
          var kode = error && error.code ? String(error.code).toUpperCase() : '';
          if ((error && error.status === 401) ||
              ['AUTH_SESSION_MISSING', 'EMAIL_NOT_VERIFIED', 'ACCOUNT_INACTIVE'].includes(kode)) {
            MT.sesiBerakhir();
            MT.toast('info', 'Sesi tidak tersedia', 'Silakan masuk untuk melanjutkan.');
          } else {
            MT.tampilkanPemulihan(true);
            MT.toast('error', MT.t('toast.sesi_gagal_dimuat'), MT.t('toast.periksa_koneksi_server'));
          }
        }).finally(function () {
          sedangPulih = false;
        });
      };
      cobaPulihkanSesi();
    }

    window.addEventListener('storage', function (event) {
      if (event.key !== SESSION_EVENT_KEY || !event.newValue) return;
      try {
        var message = JSON.parse(event.newValue);
        if (message.event !== 'logout' || !MT.store.penggunaAktif()) return;
        MT.sesiBerakhir();
        MT.toast('info', 'Sesi diakhiri di tab lain', 'Silakan masuk kembali untuk melanjutkan.');
      } catch (error) {
        console.warn('Pemberitahuan sesi lintas tab tidak valid.', error);
      }
    });
    i18nSiap.then(mulai).catch(mulai);

    if (MT.serviceWorker && MT.serviceWorker.register) {
      MT.serviceWorker.register();
    }
  }

  window.MT.app = { init: init, gambarNav: gambarNav, setJudul: setJudul, uraiHash: uraiHash };

  /* ---------------- Service worker registration & update prompt ---------------- */

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/assets/js/service-worker.js', {
      scope: '/',
      updateViaCache: 'none'
    }).then(function (reg) {
      reg.addEventListener('updatefound', function () {
        var newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', function () {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            var ctrl = MT.modal({
              judul: 'Versi baru tersedia',
              body: '<p>Tersedia pembaruan aplikasi. Muat ulang untuk menggunakan versi terbaru.</p>',
              footer: '<button type="button" class="btn btn-ghost" data-sw-dismiss>Nanti</button>' +
                '<button type="button" class="btn btn-primary" data-sw-reload>Muat ulang sekarang</button>'
            });
            ctrl.el.querySelector('[data-sw-reload]').addEventListener('click', function () {
              ctrl.tutup();
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            });
            ctrl.el.querySelector('[data-sw-dismiss]').addEventListener('click', function () {
              ctrl.tutup();
            });
          }
        });
      });
    }).catch(function (err) {
      console.warn('Service worker registration failed:', err);
    });
  }

  MT.serviceWorker = MT.serviceWorker || { register: registerServiceWorker };

  document.addEventListener('click', function (event) {
    var toggle = event.target && event.target.closest ? event.target.closest('[data-theme-toggle]') : null;
    if (!toggle || !MT.theme || !MT.applyTheme) return;
    event.preventDefault();
    var sebelumnya = MT.theme.get();
    var berikutnya = MT.theme.toggle();
    MT.applyTheme();
    var themeContainer = document.getElementById('theme-switch-container');
    if (themeContainer && MT.themeSwitcher) {
      themeContainer.innerHTML = MT.themeSwitcher();
    }
    if (MT.store.penggunaAktif() && MT.store.penggunaAktif().tema !== berikutnya) {
      MT.store.simpanProfil({ tema: berikutnya }).catch(function (error) {
        console.error('Preferensi tema gagal disimpan.', error);
        MT.theme.set(sebelumnya);
        MT.applyTheme();
        if (themeContainer && MT.themeSwitcher) {
          themeContainer.innerHTML = MT.themeSwitcher();
        }
        MT.toast('error', 'Tema belum tersimpan',
          (error && error.pesan) || 'Periksa koneksi lalu coba lagi.');
      });
    }
  });

  document.addEventListener('DOMContentLoaded', init);
  if (document.readyState !== 'loading') init();
})(window.MT);
