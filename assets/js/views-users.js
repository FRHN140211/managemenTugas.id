/* ============================================================
   views-users.js — Modul Manajemen Pengguna (khusus Owner).
   Field wajib: Nama User, Email, Password, Role.
   Catatan keamanan: kata sandi tidak pernah ditampilkan pada tabel
   maupun halaman detail; API menyimpan hash, bukan teks asli.
   ============================================================ */

window.MT = window.MT || {};

(function (MT) {
  'use strict';

  var state = { cari: '', role: 'Semua role', statusAkun: 'Semua status', urut: 'nama', hal: 1, perHal: 8 };
  var modalPengguna = null;
  var nomorMuatHalaman = 0;

  function dataTersaring() {
    return MT.store.state.pengguna;
  }

  function barisPengguna(u) {
    var sayaSendiri = MT.store.penggunaAktif().id === u.id;
    return '<div class="tr" role="row" data-id="' + MT.esc(u.id) + '">' +
      '<div class="td td-primary" role="cell" data-label="' + MT.t('users.profile_name') + '">' +
        '<a class="td-title" href="#/pengguna/' + encodeURIComponent(u.id) + '">' + MT.esc(u.nama) + '</a>' +
        '<span class="td-sub">' + MT.t('users.registered_since', { date: MT.esc(MT.formatTanggal(u.dibuatPada)) }) +
          (u.statusAkun === 'Nonaktif' ? ' · ' + MT.badgeStatus(u.statusAkun) : '') + '</span>' +
      '</div>' +
      '<div class="td" role="cell" data-label="' + MT.t('users.profile_email') + '"><span class="td-meta">' + MT.esc(u.email) + '</span></div>' +
      '<div class="td" role="cell" data-label="' + MT.t('users.profile_role') + '">' + MT.badgeRole(u.role) + '</div>' +
      '<div class="td td-actions" role="cell">' +
        '<button type="button" class="icon-button icon-button-sm" data-action="pengguna.detail" data-id="' + MT.esc(u.id) + '" ' +
          'aria-label="' + MT.esc(MT.t('btn.view_detail', { name: u.nama })) + '" title="' + MT.t('btn.view_detail_title') + '">' + MT.icon('eye') + '</button>' +
        '<button type="button" class="icon-button icon-button-sm" data-action="pengguna.edit" data-id="' + MT.esc(u.id) + '" ' +
          'aria-label="' + MT.esc(MT.t('btn.edit_named', { name: u.nama })) + '" title="' + MT.t('btn.edit') + '">' + MT.icon('edit') + '</button>' +
        (sayaSendiri
          ? '<button type="button" class="icon-button icon-button-sm" disabled aria-label="' + MT.t('users.cannot_delete_self') + '" ' +
            'title="' + MT.t('users.cannot_delete_self') + '">' + MT.icon('trash') + '</button>'
          : '<button type="button" class="icon-button icon-button-sm icon-button-danger" data-action="pengguna.hapus" ' +
            'data-id="' + MT.esc(u.id) + '" aria-label="' + MT.esc(MT.t('btn.delete_named', { name: u.nama })) + '" title="' + MT.t('btn.hapus') + '">' + MT.icon('trash') + '</button>') +
      '</div></div>';
  }

  function slotHTML() {
    var hasil = dataTersaring();
    var pagination = MT.store.state.pagination.pengguna ||
      { page: 1, pageSize: state.perHal, total: hasil.length, totalPages: 1 };
    var total = pagination.total;
    var totalHal = pagination.totalPages;
    var mulai = total ? (pagination.page - 1) * pagination.pageSize : 0;
    var baris = hasil;

    if (state.error) {
      return '<div class="alert alert-danger" role="alert"><span class="alert-icon">' + MT.icon('alert') +
        '</span><div><strong>' + MT.t('users.load_failed') + '</strong><p>' + MT.esc(state.error) +
        '</p><button type="button" class="btn btn-ghost btn-sm" data-action="pengguna.muatUlang">' + MT.t('btn.try_again') + '</button></div></div>';
    }
    if (state.loading) return '<div class="panel-pad"><p class="muted-sm" aria-live="polite">' + MT.t('users.loading') + '</p></div>';

    if (total === 0) {
      var adaData = !!state.cari || state.role !== 'Semua role' || state.statusAkun !== 'Semua status';
      return adaData
        ? MT.comp.stateKosongFilter({ modul: 'pengguna', kata: MT.t('users.label_word') })
        : MT.comp.stateKosong({
            ikon: 'users',
            judul: MT.t('users.empty_title'),
            pesan: MT.t('users.empty_desc'),
            aksi: '<div class="state-actions"><button type="button" class="btn btn-primary" data-action="pengguna.tambah">' +
              MT.icon('plus') + MT.t('btn.add_first', { label: MT.t('users.label_entry') }) + '</button></div>'
          });
    }

    return MT.comp.tabel({
      modul: 'pengguna',
      labelTabel: MT.t('list.table_title', { label: MT.t('users.label_entry') }),
      lebar: '1.9fr 2.1fr .95fr 124px',
      kolom: [
        { kunci: 'nama', label: MT.t('users.profile_name') },
        { kunci: 'email', label: MT.t('users.profile_email') },
        { kunci: 'role', label: MT.t('users.profile_role') },
        { label: MT.t('table.actions'), tanpaUrut: true }
      ],
      baris: baris.map(barisPengguna)
    }) +
    '<div class="table-foot">' +
      MT.comp.paginasi({
        modul: 'pengguna', hal: pagination.page, totalHal: totalHal, total: total, perHal: pagination.pageSize,
        dari: mulai + 1, sampai: Math.min(mulai + pagination.pageSize, total)
      }) +
    '</div>';
  }

  function segarkan() {
    var slot = document.getElementById('slot-pengguna');
    if (slot) slot.innerHTML = slotHTML();
  }

  function halamanDaftar() {
    var pagination = MT.store.state.pagination.pengguna;
    return '<div class="page-head">' +
        '<div class="page-head-text">' +
          '<h2>' + MT.t('users.page_title') + '</h2>' +
          '<p>' + MT.t('users.page_desc') + '</p>' +
        '</div>' +
        '<div class="page-head-actions">' +
          '<button type="button" class="btn btn-primary" data-action="pengguna.tambah">' + MT.icon('plus') + MT.t('btn.add_label', { label: MT.t('users.label_entry') }) + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="panel">' +
        MT.comp.toolbar({
          modul: 'pengguna',
          placeholderCari: MT.t('users.search_placeholder'),
          labelCari: MT.t('users.label_entry'),
          cariNilai: state.cari,
          filter: [
            { nama: 'role', label: MT.t('users.profile_role'), opsi: [
              { nilai: 'Semua role', label: MT.t('users.all_roles') },
              { nilai: 'owner', label: MT.t('role.owner') },
              { nilai: 'user', label: MT.t('role.user') }
            ], nilai: state.role },
            { nama: 'statusAkun', label: MT.t('users.profile_status'), opsi: [
              { nilai: 'Semua status', label: MT.t('filter.all_status') },
              { nilai: 'Aktif', label: MT.t('status.active') },
              { nilai: 'Nonaktif', label: MT.t('status.inactive') }
            ], nilai: state.statusAkun }
          ],
          urut: [
            { nilai: 'nama', label: MT.t('users.sort_name') },
            { nilai: 'email', label: MT.t('users.sort_email') },
            { nilai: 'role', label: MT.t('users.profile_role') },
            { nilai: 'terbaru', label: MT.t('users.sort_newest') }
          ],
          urutNilai: state.urut,
          catatan: (pagination ? pagination.total : 0) + ' ' + MT.t('users.registered_count')
        }) +
        '<div id="slot-pengguna">' + slotHTML() + '</div>' +
      '</div>';
  }

  function halamanDetail(u) {
    var tugas = u.jumlahTugas || 0;
    var laporan = u.jumlahLaporan || 0;
    var pengingat = u.jumlahPengingat || 0;
    var sayaSendiri = MT.store.penggunaAktif().id === u.id;

    return '<div class="page-head">' +
        '<div class="page-head-text">' +
          '<a class="link-button" href="#/pengguna" style="display:inline-flex;align-items:center;gap:6px;margin-bottom:10px">' +
          MT.icon('arrowLeft') + MT.t('detail.back_to_list', { label: MT.t('users.label_word') }) + '</a>' +
          '<div class="detail-title-row">' +
            '<h2>' + MT.esc(u.nama) + '</h2>' +
            MT.badgeRole(u.role) +
            MT.badgeStatus(u.statusAkun) +
            (sayaSendiri ? '<span class="badge badge-neutral">' + MT.t('users.your_account') + '</span>' : '') +
          '</div>' +
          '<div class="detail-meta">' +
            '<div><span class="meta-label">' + MT.t('users.profile_email') + '</span><span>' + MT.esc(u.email) + '</span></div>' +
            '<div><span class="meta-label">' + MT.t('users.registered') + '</span><span>' + MT.esc(MT.formatTanggalLengkap(u.dibuatPada)) + '</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="page-head-actions">' +
          '<button type="button" class="btn btn-ghost" data-action="pengguna.edit" data-id="' + MT.esc(u.id) + '">' +
            MT.icon('edit') + MT.t('users.edit_user') + '</button>' +
          (sayaSendiri
            ? '<button type="button" class="btn btn-ghost" disabled title="' + MT.t('users.cannot_delete_self') + '">' +
              MT.icon('trash') + MT.t('btn.hapus') + '</button>'
            : '<button type="button" class="btn btn-danger-ghost" data-action="pengguna.hapus" data-id="' + MT.esc(u.id) + '" data-detail="1">' +
              MT.icon('trash') + MT.t('btn.hapus') + '</button>') +
        '</div>' +
      '</div>' +

      '<div class="profile-grid">' +
        '<div class="panel">' +
          '<div class="panel-head"><h3>' + MT.t('users.profile_data_title') + '</h3><p>' + MT.t('users.profile_data_desc') + '</p></div>' +
          '<div class="panel-pad">' +
            '<dl class="def-list">' +
              '<div class="def-row"><dt>' + MT.t('users.profile_name') + '</dt><dd>' + MT.esc(u.nama) + '</dd></div>' +
              '<div class="def-row"><dt>' + MT.t('users.profile_email') + '</dt><dd>' + MT.esc(u.email) + '</dd></div>' +
              '<div class="def-row"><dt>' + MT.t('users.profile_password') + '</dt><dd><span class="code-inline">••••••••</span>' +
                '<div class="muted-sm" style="margin-top:6px">' + MT.t('users.password_never_shown') + '</div></dd></div>' +
              '<div class="def-row"><dt>' + MT.t('users.profile_role') + '</dt><dd>' + (u.role === 'owner' ? MT.t('role.owner') : MT.t('role.user')) +
                '<div class="muted-sm" style="margin-top:6px">' +
                (u.role === 'owner'
                  ? MT.t('users.owner_can_manage')
                  : MT.t('users.user_can_manage')) +
                '</div></dd></div>' +
              '<div class="def-row"><dt>' + MT.t('users.profile_status') + '</dt><dd>' +
                MT.t(u.statusAkun === 'Aktif' ? 'status.active' : 'status.inactive') + '</dd></div>' +
            '</dl>' +
          '</div>' +
        '</div>' +

        '<div class="stack">' +
          '<div class="panel">' +
            '<div class="panel-head"><h3>' + MT.t('users.related_data') + '</h3></div>' +
            '<div class="panel-pad">' +
              '<dl class="def-list">' +
                '<div class="def-row"><dt>' + MT.t('users.tasks_owned') + '</dt><dd>' + tugas + ' ' + MT.t('common.data') + '</dd></div>' +
                '<div class="def-row"><dt>' + MT.t('users.reports_owned') + '</dt><dd>' + laporan + ' ' + MT.t('common.data') + '</dd></div>' +
                '<div class="def-row"><dt>' + MT.t('users.reminders_owned') + '</dt><dd>' + pengingat + ' ' + MT.t('common.data') + '</dd></div>' +
              '</dl>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function halamanTidakAda() {
    return '<div class="panel">' + MT.comp.stateKosong({
      ikon: 'search',
      judul: MT.t('users.not_found_title'),
      pesan: MT.t('users.not_found_desc'),
      aksi: '<div class="state-actions"><a class="btn btn-primary" href="#/pengguna">' + MT.icon('arrowLeft') +
        MT.t('detail.back_to_list', { label: MT.t('users.label_word') }) + '</a></div>'
    }) + '</div>';
  }

  function muatHalaman() {
    var requestId = ++nomorMuatHalaman;
    var sortMap = { nama: 'name', email: 'email', role: 'role', terbaru: 'created' };
    state.loading = true;
    state.error = null;
    segarkan();
    return MT.store.muatHalaman('pengguna', {
      page: state.hal,
      pageSize: state.perHal,
      search: state.cari,
      role: state.role,
      status: state.statusAkun,
      sort: sortMap[state.urut] || 'name'
    }).then(function (hasil) {
      if (requestId !== nomorMuatHalaman) return;
      if (!hasil) return;
      state.loading = false;
      if (hasil.pagination.totalPages < state.hal) {
        state.hal = hasil.pagination.totalPages;
        return muatHalaman();
      }
      var counter = document.querySelector('[data-toolbar-count="pengguna"]');
      if (counter) counter.textContent = hasil.pagination.total + ' ' + MT.t('users.registered_count');
      segarkan();
    }).catch(function (err) {
      if (requestId !== nomorMuatHalaman) return;
      state.loading = false;
      state.error = (err && err.pesan) || MT.t('error.retry_connection');
      segarkan();
    });
  }

  function formPengguna(u) {
    return '<form id="form-pengguna" data-form-pengguna="1" data-id="' + MT.esc(u ? u.id : '') + '" novalidate>' +
      '<div data-slot-ringkasan></div>' +
      '<div class="form-section" style="border-top:0;padding-top:0;margin-top:0">' +
        '<p class="form-section-title">' + MT.t('users.identity') + '</p>' +
        '<p class="form-section-note">' + MT.t('form.required_note', { marker: '<span class="req">*</span>' }) + '</p>' +
        MT.comp.field({ nama: 'nama', label: MT.t('users.profile_name'), nilai: u ? u.nama : '', wajib: true,
          placeholder: MT.t('users.name_placeholder'), autofokus: true }) +
        MT.comp.field({ nama: 'email', label: MT.t('users.profile_email'), tipe: 'email', nilai: u ? u.email : '', wajib: true,
          placeholder: MT.t('auth.placeholder_email'),
          petunjuk: MT.t('users.email_verified_help') }) +
      '</div>' +
      '<div class="form-section">' +
        '<p class="form-section-title">' + MT.t('users.access') + '</p>' +
        '<div class="form-grid">' +
          MT.comp.field({ nama: 'role', label: MT.t('users.profile_role'), tipe: 'select', nilai: u ? u.role : '', wajib: true,
            placeholder: MT.t('users.choose_role'),
            opsi: [{ nilai: 'user', label: MT.t('users.role_user_option') },
                   { nilai: 'owner', label: MT.t('users.role_owner_option') }] }) +
        '</div>' +
        MT.comp.field({ nama: 'statusAkun', label: MT.t('users.profile_status'), tipe: 'select',
          nilai: u ? u.statusAkun : 'Aktif',
          opsi: [{ nilai: 'Aktif', label: MT.t('status.active') }, { nilai: 'Nonaktif', label: MT.t('status.inactive') }],
          petunjuk: MT.t('users.status_help') }) +
      '</div>' +
    '</form>';
  }

  function bukaForm(u) {
    var mode = u ? 'ubah' : 'tambah';
    modalPengguna = MT.modal({
      judul: MT.t(mode === 'tambah' ? 'form.add_title' : 'form.edit_title', {
        label: MT.t('users.label_entry')
      }),
      subjudul: mode === 'tambah'
        ? MT.t('users.add_description')
        : MT.t('users.edit_description'),
      body: formPengguna(u),
      footer:
        '<span class="modal-foot-left">' + MT.t('form.required_footer', { marker: '<span class="req">*</span>' }) + '</span>' +
        '<button type="button" class="btn btn-ghost" data-modal-close>' + MT.t('btn.batal') + '</button>' +
        '<button type="submit" class="btn btn-primary" form="form-pengguna" data-tombol-simpan>' +
          MT.labelTombolKerja(mode === 'tambah'
            ? MT.t('btn.save_label', { label: MT.t('users.label_entry') })
            : MT.t('btn.simpan_perubahan')) +
        '</button>'
    });
  }

  MT.rute.pengguna = {
    hanyaOwner: true,
    judul: function (id) {
      return id
        ? MT.t('detail.page_title', { label: MT.t('users.label_entry') })
        : MT.t('users.page_title');
    },
    remah: function (id) {
      return id
        ? [{ label: MT.t('breadcrumb.dashboard'), rute: 'dashboard' }, { label: MT.t('users.page_title'), rute: 'pengguna' }, { label: MT.t('breadcrumb.detail') }]
        : [{ label: MT.t('breadcrumb.dashboard'), rute: 'dashboard' }, { label: MT.t('users.page_title') }];
    },
    render: function (id) {
      if (!id) return muatHalaman().then(function () { return halamanDaftar(); });
      return MT.store.ambilDariServer('pengguna', id).then(function (hasil) {
        return halamanDetail(hasil);
      }).catch(function (err) {
        if (err && err.status === 404) return halamanTidakAda();
        throw err;
      });
    }
  };

  MT.modulHandler.pengguna = {
    cari: function (nilai) { state.cari = nilai; state.hal = 1; muatHalaman(); },
    filter: function (nama, nilai) { state[nama] = nilai; state.hal = 1; muatHalaman(); },
    urut: function (nilai) { state.urut = nilai; state.hal = 1; muatHalaman(); },
    urutKolom: function (kunci) {
      if (kunci === 'statusAkun') {
        MT.toast('info', MT.t('sort.unavailable_title'), MT.t('sort.unavailable_desc'));
        return;
      }
      state.urut = kunci === 'nama' ? 'nama' : state.urut === 'role' ? 'nama' : kunci;
      state.hal = 1;
      muatHalaman();
    },
    halaman: function (h) {
      state.hal = h;
      muatHalaman().then(function () {
        var slot = document.getElementById('slot-pengguna');
        if (slot) slot.scrollIntoView({ block: 'nearest' });
      });
    }
  };
  MT.aksi['pengguna.muatUlang'] = function () { muatHalaman(); };

  MT.aksi['pengguna.resetFilter'] = function () {
    state.cari = ''; state.role = 'Semua role'; state.statusAkun = 'Semua status'; state.urut = 'nama'; state.hal = 1;
    MT.renderRute();
    MT.toast('info', MT.t('filter.reset_title'), MT.t('filter.reset_desc'));
  };

  MT.aksi['pengguna.tambah'] = function () { bukaForm(null); };

  MT.aksi['pengguna.edit'] = function (ds) {
    var u = MT.store.ambil('pengguna', ds.id);
    if (!u) { MT.toast('error', MT.t('error.record_not_found_title'), MT.t('users.reload_list')); return; }
    bukaForm(u);
  };

  MT.aksi['pengguna.detail'] = function (ds) { location.hash = '#/pengguna/' + encodeURIComponent(ds.id); };

  MT.aksi['pengguna.hapus'] = function (ds) {
    var u = MT.store.ambil('pengguna', ds.id);
    if (!u) { MT.toast('error', MT.t('error.record_not_found_title'), MT.t('users.reload_list')); return; }
    if (MT.store.penggunaAktif().id === u.id) {
      MT.toast('error', MT.t('users.cannot_delete_title'), MT.t('users.cannot_delete_self'));
      return;
    }
    MT.hapusTerkonfirmasi({
      koleksi: 'pengguna',
      id: u.id,
      nama: u.nama,
      label: MT.t('users.label_word'),
      setelahSukses: function () {
        if (ds.detail) location.hash = '#/pengguna';
        else MT.renderRute();
      }
    });
  };

  MT.penanganForm.pengguna = function (o) {
    MT.simpanForm({
      form: o.form,
      koleksi: 'pengguna',
      id: o.id,
      tombol: o.tombol,
      mode: o.id ? 'ubah' : 'tambah',
      setelahSukses: function (hasilData) {
        if (modalPengguna) { modalPengguna.tutup(); modalPengguna = null; }
        state.hal = 1;
        MT.renderRute();
        if (hasilData && o.id && hasilData.id === MT.store.penggunaAktif().id) {
          MT.toast('info', MT.t('users.account_updated_title'), MT.t('users.account_updated_desc'));
        }
      }
    });
  };
})(window.MT);
