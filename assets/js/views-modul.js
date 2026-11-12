/* ============================================================
   views-modul.js — Mesin modul generik untuk Manajemen Tugas,
   Manajemen Laporan, dan Pengingat. Menyediakan daftar (cari,
   filter, urut, paginasi), detail, serta CRUD dengan validasi
   dan seluruh state (loading, kosong, error, sukses, gagal).
   ============================================================ */

window.MT = window.MT || {};

(function (MT) {
  'use strict';

  MT.modulState = {};
  var modalAktif = {};

  /* Label disimpan sebagai KUNCI, bukan hasil MT.t(): array ini dibuat saat file
     dimuat, sebelum i18n.init() selesai, sehingga MT.t() di sini akan membekukan
     key mentah ("sort.nearest_deadline") selamanya. Diterjemahkan saat render. */
  var OPSI_URUT = [
    { nilai: 'deadline-naik', label: 'sort.nearest_deadline' },
    { nilai: 'deadline-turun', label: 'sort.farthest_deadline' },
    { nilai: 'diperbarui', label: 'sort.last_updated' },
    { nilai: 'nama', label: 'sort.name_az' },
    { nilai: 'status', label: 'sort.status' }
  ];

  function teksModul(mod, nama) {
    var nilai = mod[nama];
    if (typeof nilai !== 'string') return nilai || '';
    return /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/.test(nilai) ? MT.t(nilai) : nilai;
  }

  function kolomModul(mod) {
    return mod.kolom.map(function (kolom) {
      return { kunci: kolom.kunci, label: teksModul(kolom, 'label') };
    });
  }

  function opsiStatus(mod) {
    var labels = {
      'Belum Dimulai': 'status.not_started',
      'Sedang Dikerjakan': 'status.in_progress',
      'Selesai': 'status.completed',
      'Aktif': 'status.active',
      'Nonaktif': 'status.inactive'
    };
    return [{ nilai: 'Semua status', label: MT.t('filter.all_status') }].concat(mod.status.map(function (status) {
      return { nilai: status, label: labels[status] ? MT.t(labels[status]) : status };
    }));
  }

  function tabelHTML(mod, hasil) {
    var st = MT.modulState[mod.koleksi];
    var bolehUbahSemua = MT.store.adalahOwner();
    var pagination = MT.store.state.pagination[mod.koleksi] ||
      { page: 1, pageSize: st.perHal, total: hasil.length, totalPages: 1 };
    var total = pagination.total;
    var totalHal = pagination.totalPages;
    var mulai = total ? (pagination.page - 1) * pagination.pageSize : 0;
    var baris = hasil;

    if (st.error) {
      return '<div class="alert alert-danger" role="alert">' +
        '<span class="alert-icon">' + MT.icon('alert') + '</span><div><strong>' + MT.t('list.load_failed_title') + '</strong>' +
        '<p>' + MT.esc(st.error) + '</p><button type="button" class="btn btn-ghost btn-sm" data-action="' +
        mod.koleksi + '.muatUlang">' + MT.t('btn.try_again') + '</button></div></div>';
    }
    if (st.loading) return '<div class="panel-pad"><p class="muted-sm" aria-live="polite">' + MT.t('list.loading') + '</p></div>';

    if (total === 0) {
      var adaFilter = !!st.cari || (st.filter.status && st.filter.status !== 'Semua status');
      return adaFilter
        ? MT.comp.stateKosongFilter({ modul: mod.koleksi, kata: teksModul(mod, 'labelKata') })
        : MT.comp.stateKosong({
            ikon: mod.ikon,
            judul: teksModul(mod, 'kosongJudul'),
            pesan: teksModul(mod, 'kosongPesan'),
            aksi: '<div class="state-actions">' +
              '<button type="button" class="btn btn-primary" data-action="' + mod.koleksi + '.tambah">' +
              MT.icon('plus') + MT.t('btn.add_first', { label: MT.esc(teksModul(mod, 'labelEntri')) }) + '</button>' +
              '</div>'
          });
    }

    return MT.comp.tabel({
      modul: mod.koleksi,
      labelTabel: MT.t('list.table_title', { label: MT.esc(teksModul(mod, 'labelEntri')) }),
      kolom: kolomModul(mod),
      lebar: mod.lebar,
      baris: baris.map(function (item) {
        return MT.comp.barisData({
          item: item,
          rute: mod.rute,
          koleksi: mod.koleksi,
          bolehUbah: bolehUbahSemua || MT.store.bisaUbah(mod.koleksi, item)
        });
      }),
      sortKunci: null,
      sortArah: 'naik'
    }) +
    '<div class="table-foot">' +
      MT.comp.paginasi({
        modul: mod.koleksi, hal: pagination.page, totalHal: totalHal, total: total, perHal: pagination.pageSize,
        dari: mulai + 1, sampai: Math.min(mulai + pagination.pageSize, total)
      }) +
    '</div>';
  }

  function slotHTML(mod) {
    return tabelHTML(mod, MT.store.daftar(mod.koleksi));
  }

  function segarkan(mod) {
    var slot = document.getElementById('slot-' + mod.koleksi);
    if (slot) slot.innerHTML = slotHTML(mod);
  }

  function segarkanJumlahToolbar(mod) {
    var counter = document.querySelector('[data-toolbar-count="' + mod.koleksi + '"]');
    var pagination = MT.store.state.pagination[mod.koleksi];
    if (counter && pagination) counter.textContent = pagination.total + ' ' + MT.t('list.data_count');
  }

  function toolbarHTML(mod) {
    var st = MT.modulState[mod.koleksi];
    var pagination = MT.store.state.pagination[mod.koleksi];
    var total = pagination ? pagination.total : 0;
    return MT.comp.toolbar({
      modul: mod.koleksi,
      placeholderCari: teksModul(mod, 'placeholderCari'),
      labelCari: teksModul(mod, 'labelKata'),
      cariNilai: st.cari,
      filter: [{
        nama: 'status',
        label: MT.t('filter.status'),
        opsi: opsiStatus(mod),
        nilai: st.filter.status
      }],
      urut: OPSI_URUT.map(function (o) { return { nilai: o.nilai, label: MT.t(o.label) }; }),
      urutNilai: st.urut,
      catatan: total + ' ' + MT.t('list.data_count')
    });
  }

  /* ---------------- Halaman daftar ---------------- */

  function halamanDaftar(mod) {
    return '<div class="page-head">' +
      '<div class="page-head-text">' +
        '<h2>' + MT.esc(teksModul(mod, 'judulHalaman')) + '</h2>' +
        '<p>' + MT.esc(teksModul(mod, 'deskripsi')) + '</p>' +
      '</div>' +
      '<div class="page-head-actions">' +
        '<button type="button" class="btn btn-primary" data-action="' + mod.koleksi + '.tambah">' +
          MT.icon('plus') + MT.t('btn.add_label', { label: MT.esc(teksModul(mod, 'labelEntri')) }) + '</button>' +
      '</div>' +
    '</div>' +
    '<div class="panel">' + toolbarHTML(mod) +
      '<div id="slot-' + mod.koleksi + '">' + slotHTML(mod) + '</div>' +
    '</div>' +
    (mod.panelEkstra ? mod.panelEkstra() : '');
  }

  /* ---------------- Halaman detail ---------------- */

  function aktivitasTerkait(nama) {
    var daftar = MT.store.state.aktivitas.filter(function (a) { return a.objek === nama; }).slice(0, 6);
    if (!daftar.length) {
      return '<p class="muted-sm">' + MT.t('detail.no_activity') + '</p>';
    }
    return '<div class="timeline">' + daftar.map(function (a) {
      return '<div class="timeline-item">' +
        '<span class="timeline-mark timeline-mark-cobalt">' + MT.icon('check') + '</span>' +
        '<div class="timeline-body"><strong>' + MT.esc(a.aksi) + '</strong>' +
        '<span>' + MT.esc(a.aktor) + ' · ' + MT.esc(MT.formatTanggal(a.waktu)) + '</span></div>' +
        '</div>';
    }).join('') + '</div>';
  }

  function halamanDetail(mod, item) {
    var boleh = MT.store.adalahOwner() || MT.store.bisaUbah(mod.koleksi, item);
    var info = MT.infoDeadline(item.deadline, item.status);
    var kelasNada = info.nada === 'over' ? 'badge-coral' : info.nada === 'soon' ? 'badge-primary' : 'badge-neutral';

    return '<div class="page-head">' +
        '<div class="page-head-text">' +
          '<a class="link-button" href="#/' + mod.rute + '" style="display:inline-flex;align-items:center;gap:6px;margin-bottom:10px">' +
            MT.icon('arrowLeft') + MT.t('detail.back_to_list', { label: MT.esc(teksModul(mod, 'labelKata')) }) + '</a>' +
          '<div class="detail-title-row">' +
            '<h2>' + MT.esc(item.nama) + '</h2>' +
            MT.badgeStatus(item.status) +
            '<span class="badge ' + kelasNada + '">' + MT.esc(info.teks) + '</span>' +
          '</div>' +
          '<div class="detail-meta">' +
            '<div><span class="meta-label">' + MT.t('table.deadline') + '</span><span>' + MT.esc(MT.formatTanggalLengkap(item.deadline)) + '</span></div>' +
            '<div><span class="meta-label">' + MT.t('table.owner') + '</span><span>' + MT.esc(item.pemilikNama || MT.store.namaPengguna(item.pemilikId)) + '</span></div>' +
            '<div><span class="meta-label">' + MT.t('detail.last_updated') + '</span><span>' + MT.esc(MT.formatTanggal(item.diperbaruiPada)) + '</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="page-head-actions">' +
          (boleh
            ? '<button type="button" class="btn btn-ghost" data-action="' + mod.koleksi + '.edit" data-id="' + MT.esc(item.id) + '">' +
                MT.icon('edit') + MT.t('btn.edit') + '</button>' +
              '<button type="button" class="btn btn-danger-ghost" data-action="' + mod.koleksi + '.hapus" data-id="' + MT.esc(item.id) + '" data-detail="1">' +
                MT.icon('trash') + MT.t('btn.hapus') + '</button>'
            : '<span class="badge badge-neutral">' + MT.t('detail.read_only') + '</span>') +
        '</div>' +
      '</div>' +

      '<div class="grid-side">' +
        '<div class="stack">' +
          '<div class="panel">' +
            '<div class="panel-head"><h3>' + MT.t('detail.description') + '</h3></div>' +
            '<div class="panel-pad"><p class="prose">' + MT.esc(item.deskripsi) + '</p></div>' +
          '</div>' +
          (mod.detailEkstra ? '<div class="panel">' + mod.detailEkstra(item) + '</div>' : '') +
        '</div>' +

        '<div class="stack">' +
          '<div class="panel">' +
            '<div class="panel-head"><h3>' + MT.t('detail.data_details') + '</h3></div>' +
            '<div class="panel-pad">' +
              '<dl class="def-list">' +
                '<div class="def-row"><dt>' + MT.t('detail.data_id') + '</dt><dd><code class="code-inline">' + MT.esc(item.id) + '</code></dd></div>' +
                '<div class="def-row"><dt>' + MT.esc(teksModul(mod, 'labelNamaField')) + '</dt><dd>' + MT.esc(item.nama) + '</dd></div>' +
                '<div class="def-row"><dt>' + MT.t('table.deadline') + '</dt><dd>' + MT.esc(MT.formatTanggalLengkap(item.deadline)) + '</dd></div>' +
                '<div class="def-row"><dt>' + MT.esc(teksModul(mod, 'labelStatusField')) + '</dt><dd>' + MT.badgeStatus(item.status) + '</dd></div>' +
                '<div class="def-row"><dt>' + MT.t('detail.created_on') + '</dt><dd>' + MT.esc(MT.formatTanggal(item.dibuatPada)) + '</dd></div>' +
                '<div class="def-row"><dt>' + MT.t('detail.owner_data') + '</dt><dd>' + MT.esc(item.pemilikNama || MT.store.namaPengguna(item.pemilikId)) +
                  '<br><span class="muted-sm">' + MT.esc(item.pemilikEmail || MT.store.emailPengguna(item.pemilikId)) + '</span></dd></div>' +
              '</dl>' +
            '</div>' +
          '</div>' +
          '<div class="panel">' +
            '<div class="panel-head"><h3>' + MT.t('detail.related_activity') + '</h3></div>' +
            '<div class="panel-pad">' + aktivitasTerkait(item.nama) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function halamanTidakAda(mod) {
    return '<div class="panel">' + MT.comp.stateKosong({
      ikon: 'search',
      judul: MT.t('detail.not_found_title', { label: MT.esc(teksModul(mod, 'labelEntri')) }),
      pesan: MT.t('detail.not_found_desc'),
      aksi: '<div class="state-actions"><a class="btn btn-primary" href="#/' + mod.rute + '">' +
        MT.icon('arrowLeft') + MT.t('detail.back_to_list', { label: MT.esc(teksModul(mod, 'labelKata')) }) + '</a></div>'
    }) + '</div>';
  }

  /* ---------------- Form modal ---------------- */

  function bukaForm(mod, item) {
    var mode = item ? 'ubah' : 'tambah';
    var ctrl = MT.modal({
      judul: MT.t(mode === 'tambah' ? 'form.add_title' : 'form.edit_title', {
        label: MT.esc(teksModul(mod, 'labelEntri'))
      }),
      subjudul: mode === 'tambah'
        ? MT.t('form.add_description')
        : MT.t('form.edit_description'),
      body: MT.comp.formModul({ koleksi: mod.koleksi, entri: item, mode: mode }),
      footer:
        '<span class="modal-foot-left">' + MT.t('form.required_footer', { marker: '<span class="req">*</span>' }) + '</span>' +
        '<button type="button" class="btn btn-ghost" data-modal-close>' + MT.t('btn.batal') + '</button>' +
        '<button type="submit" class="btn btn-primary" form="form-' + mod.koleksi + '" data-tombol-simpan>' +
          MT.labelTombolKerja(mode === 'tambah'
            ? MT.t('btn.save_label', { label: teksModul(mod, 'labelEntri') })
            : MT.t('btn.simpan_perubahan')) +
        '</button>'
    });
    modalAktif[mod.koleksi] = ctrl;
  }

  /* ---------------- Registrasi modul ---------------- */

  MT.buatModul = function (konf) {
    /* Konfigurasi dari views-*.js berisi KUNCI terjemahan (dievaluasi saat file
       dimuat, sebelum i18n siap), sehingga setiap teks diterjemahkan DI SINI saat
       render — bukan saat config disusun. */
    var mod = Object.assign({
      status: MT.comp.KONFIG_MODUL[konf.koleksi].status,
      kolom: [
        { kunci: 'nama', label: 'table.name' },
        { kunci: 'pemilik', label: 'table.owner' },
        { kunci: 'deadline', label: 'table.deadline' },
        { kunci: 'status', label: 'table.status' }
      ],
      lebar: '2.3fr 1.5fr 1fr .95fr 116px',
      labelNamaField: MT.comp.KONFIG_MODUL[konf.koleksi].labelNama,
      labelStatusField: MT.comp.KONFIG_MODUL[konf.koleksi].labelStatus,
      placeholderCari: 'search.placeholder_default'
    }, konf);
    /* Konversi kunci -> teks tepat di sini (dijalankan saat render). */
    MT.modulState[mod.koleksi] = {
      cari: '',
      filter: { status: 'Semua status' },
      urut: 'deadline-naik',
      hal: 1,
      perHal: 8,
      loading: false,
      error: null
    };
    var nomorMuatHalaman = 0;

    function opsiPermintaan() {
      var st = MT.modulState[mod.koleksi];
      var sortMap = {
        'deadline-naik': 'deadline-asc',
        'deadline-turun': 'deadline-desc',
        diperbarui: 'updated',
        nama: 'name',
        status: 'status'
      };
      return {
        page: st.hal,
        pageSize: st.perHal,
        search: st.cari,
        status: st.filter.status,
        sort: sortMap[st.urut] || 'deadline-asc'
      };
    }

    function muatHalaman() {
      var st = MT.modulState[mod.koleksi];
      var requestId = ++nomorMuatHalaman;
      st.loading = true;
      st.error = null;
      segarkan(mod);
      return MT.store.muatHalaman(mod.koleksi, opsiPermintaan()).then(function (hasil) {
        if (requestId !== nomorMuatHalaman) return;
        if (!hasil) return;
        st.loading = false;
        if (hasil.pagination.totalPages < st.hal) {
          st.hal = hasil.pagination.totalPages;
          return muatHalaman();
        }
        segarkanJumlahToolbar(mod);
        segarkan(mod);
      }).catch(function (err) {
        if (requestId !== nomorMuatHalaman) return;
        st.loading = false;
        st.error = (err && err.pesan) || MT.t('error.retry_connection');
        segarkan(mod);
      });
    }

    MT.rute[mod.rute] = {
      judul: function (id) {
        return id
          ? MT.t('detail.page_title', { label: teksModul(mod, 'labelEntri') })
          : teksModul(mod, 'judulHalaman');
      },
      remah: function (id) {
        return id
          ? [{ label: MT.t('breadcrumb.dashboard'), rute: 'dashboard' }, { label: teksModul(mod, 'judulHalaman'), rute: mod.rute }, { label: MT.t('breadcrumb.detail') }]
          : [{ label: MT.t('breadcrumb.dashboard'), rute: 'dashboard' }, { label: teksModul(mod, 'judulHalaman') }];
      },
      render: function (id) {
        if (!id) return muatHalaman().then(function () { return halamanDaftar(mod); });
        var item = MT.store.ambil(mod.koleksi, id);
        return (item ? Promise.resolve(item) : MT.store.ambilDariServer(mod.koleksi, id)).then(function (hasil) {
          return halamanDetail(mod, hasil);
        }).catch(function (err) {
          if (err && err.status === 404) return halamanTidakAda(mod);
          throw err;
        });
      },
      setelah: function (id) {
        if (!id && mod.listMounted) mod.listMounted();
      }
    };

    MT.modulHandler[mod.koleksi] = {
      cari: function (nilai) {
        var st = MT.modulState[mod.koleksi];
        st.cari = nilai; st.hal = 1; muatHalaman();
      },
      filter: function (nama, nilai) {
        var st = MT.modulState[mod.koleksi];
        st.filter[nama] = nilai; st.hal = 1; muatHalaman();
      },
      urut: function (nilai) {
        var st = MT.modulState[mod.koleksi];
        st.urut = nilai; st.hal = 1; muatHalaman();
      },
      urutKolom: function (kunci) {
        var st = MT.modulState[mod.koleksi];
        var peta = { nama: 'nama', status: 'status', deadline: 'deadline-naik' };
        var target = peta[kunci];
        if (!target) { MT.toast('info', MT.t('sort.unavailable_title'), MT.t('sort.unavailable_desc')); return; }
        if (st.urut === 'deadline-naik' && kunci === 'deadline') target = 'deadline-turun';
        st.urut = target; st.hal = 1; muatHalaman();
      },
      halaman: function (h) {
        MT.modulState[mod.koleksi].hal = h;
        muatHalaman().then(function () {
          var panel = document.getElementById('slot-' + mod.koleksi);
          if (panel) panel.scrollIntoView({ block: 'nearest' });
        });
      }
    };

    MT.aksi[mod.koleksi + '.muatUlang'] = function () { muatHalaman(); };

    MT.aksi[mod.koleksi + '.resetFilter'] = function () {
      var st = MT.modulState[mod.koleksi];
      st.cari = ''; st.filter.status = 'Semua status'; st.urut = 'deadline-naik'; st.hal = 1;
      MT.renderRute();
      MT.toast('info', MT.t('filter.reset_title'), MT.t('filter.reset_desc'));
    };

    MT.aksi[mod.koleksi + '.tambah'] = function () { bukaForm(mod, null); };
    MT.aksi[mod.koleksi + '.edit'] = function (ds) {
      var item = MT.store.ambil(mod.koleksi, ds.id);
      if (!item) { MT.toast('error', MT.t('error.record_not_found_title'), MT.t('error.record_not_found_desc')); return; }
      if (!MT.store.adalahOwner() && !MT.store.bisaUbah(mod.koleksi, item)) {
        MT.toast('error', MT.t('error.permission_title'), MT.t('error.edit_own_only'));
        return;
      }
      bukaForm(mod, item);
    };

    MT.aksi[mod.koleksi + '.detail'] = function (ds) {
      location.hash = '#/' + mod.rute + '/' + encodeURIComponent(ds.id);
    };

    MT.aksi[mod.koleksi + '.hapus'] = function (ds) {
      var item = MT.store.ambil(mod.koleksi, ds.id);
      if (!item) { MT.toast('error', MT.t('error.record_not_found_title'), MT.t('error.record_not_found_desc')); return; }
      if (!MT.store.adalahOwner() && !MT.store.bisaUbah(mod.koleksi, item)) {
        MT.toast('error', MT.t('error.permission_title'), MT.t('error.delete_own_only'));
        return;
      }
      MT.hapusTerkonfirmasi({
        koleksi: mod.koleksi,
        id: item.id,
        nama: item.nama,
        label: teksModul(mod, 'labelKata'),
        setelahSukses: function () {
          if (ds.detail) location.hash = '#/' + mod.rute;
          else MT.renderRute();
        }
      });
    };

    MT.penanganForm[mod.koleksi] = function (o) {
      MT.simpanForm({
        form: o.form,
        koleksi: mod.koleksi,
        id: o.id,
        tombol: o.tombol,
        mode: o.id ? 'ubah' : 'tambah',
        setelahSukses: function () {
          var ctrl = modalAktif[mod.koleksi];
          if (ctrl) { ctrl.tutup(); modalAktif[mod.koleksi] = null; }
          MT.renderRute();
        }
      });
    };
  };
})(window.MT);
