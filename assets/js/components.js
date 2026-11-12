/* ============================================================
   components.js — Komponen reusable:
   field form, toolbar (cari/filter/urut), tabel, paginasi,
   state kosong/error/loading, form modul generik.
   ============================================================ */

window.MT = window.MT || {};

(function (MT) {
  'use strict';

  var comp = {};

  function teks(key, params) {
    return typeof key === 'string' && /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/.test(key) ? MT.t(key, params) : key;
  }

  /* ---------------- Field form ---------------- */

  comp.field = function (o) {
    var id = 'f-' + o.nama;
    var deskripsiId = id + '-error' + (o.petunjuk ? ' ' + id + '-help' : '');
    var kontrol;

    if (o.tipe === 'textarea') {
      kontrol = '<textarea id="' + id + '" name="' + o.nama + '" rows="4" placeholder="' +
        MT.esc(o.placeholder || '') + '" aria-describedby="' + deskripsiId + '">' +
        MT.esc(o.nilai || '') + '</textarea>';
    } else if (o.tipe === 'select') {
      kontrol = '<div class="select-wrap"><select id="' + id + '" name="' + o.nama + '" aria-describedby="' + deskripsiId + '">' +
        (o.placeholder ? '<option value="">' + MT.esc(o.placeholder) + '</option>' : '') +
        (o.opsi || []).map(function (op) {
          var nilai = typeof op === 'string' ? op : op.nilai;
          var label = typeof op === 'string' ? op : op.label;
          return '<option value="' + MT.esc(nilai) + '"' + (String(o.nilai) === String(nilai) ? ' selected' : '') + '>' +
            MT.esc(label) + '</option>';
        }).join('') + '</select></div>';
    } else {
      kontrol = '<input id="' + id + '" name="' + o.nama + '" type="' + (o.tipe || 'text') + '" value="' +
        MT.esc(o.nilai || '') + '" placeholder="' + MT.esc(o.placeholder || '') + '" ' +
        'aria-describedby="' + deskripsiId + '"' + (o.autofokus ? ' data-autofocus' : '') + '>';
    }

    return '<div class="field ' + (o.kelas || '') + '">' +
      '<label for="' + id + '">' + MT.esc(o.label) + (o.wajib ? '<span class="req" aria-hidden="true">*</span>' : '') +
      (o.wajib ? '<span class="sr-only">' + MT.esc(MT.t('form.required_sr')) + '</span>' : '') + '</label>' +
      kontrol +
      (o.petunjuk ? '<p class="field-help" id="' + id + '-help">' + MT.esc(o.petunjuk) + '</p>' : '') +
      '<p class="field-error" id="' + id + '-error" role="alert" hidden></p>' +
      '</div>';
  };

  comp.galatField = function (pesan) {
    return '<span class="field-error" role="alert">' + MT.icon('alert') + MT.esc(pesan) + '</span>';
  };

  comp.ringkasanGalat = function (jumlah) {
    return '<div class="alert alert-danger" role="alert" data-ringkasan-galat>' +
      '<span class="alert-icon">' + MT.icon('alert') + '</span>' +
      '<div><strong>' + MT.t('form.errors_title', { count: jumlah }) + '</strong>' +
      '<p>' + MT.t('form.errors_desc') + '</p></div>' +
      '</div>';
  };

  /* ---------------- Toolbar: cari, filter, urut ---------------- */

  comp.toolbar = function (o) {
    var html = '<div class="table-toolbar">';

    if (o.cari !== false) {
      html += '<div class="toolbar-search">' +
        '<span class="input-icon">' + MT.icon('search') + '</span>' +
        '<label class="sr-only" for="cari-' + o.modul + '">' + MT.esc(MT.t('search.label', { label: o.labelCari || MT.t('common.data') })) + '</label>' +
        '<input id="cari-' + o.modul + '" type="search" value="' + MT.esc(o.cariNilai || '') + '" ' +
        'placeholder="' + MT.esc(o.placeholderCari || MT.t('search.placeholder')) + '" ' +
        'data-toolbar="cari" data-modul="' + o.modul + '" autocomplete="off">' +
        '</div>';
    }

    (o.filter || []).forEach(function (f) {
      var id = 'filter-' + o.modul + '-' + f.nama;
      function nilaiOpsi(opsi) {
        return typeof opsi === 'string' ? opsi : opsi.nilai;
      }
      function labelOpsi(opsi) {
        return typeof opsi === 'string' ? opsi : opsi.label;
      }
      var opsiAktif = (f.opsi || []).find(function (opsi) {
        return String(nilaiOpsi(opsi)) === String(f.nilai);
      });
      var labelAktif = opsiAktif ? labelOpsi(opsiAktif) : (f.opsi && labelOpsi(f.opsi[0])) || MT.t('filter.all');
      html += '<div class="toolbar-group">' +
        '<label id="lab-' + id + '">' + MT.esc(f.label) + '</label>' +
        '<div class="fg-select" data-fg-select>' +
          '<button type="button" class="fg-select-trigger" id="' + id + '" ' +
            'aria-haspopup="listbox" aria-expanded="false" aria-labelledby="lab-' + id + ' ' + id + '" ' +
            'data-toolbar-trigger="filter" data-modul="' + o.modul + '" data-nama="' + f.nama + '">' +
            '<span class="fg-select-value">' + MT.esc(labelAktif) + '</span>' +
            '<span class="fg-select-chevron" aria-hidden="true">' + MT.icon('chevronDown') + '</span>' +
          '</button>' +
          '<div class="fg-panel" role="listbox" hidden aria-labelledby="lab-' + id + '">' +
            f.opsi.map(function (op) {
              var nilai = nilaiOpsi(op);
              var aktif = String(f.nilai) === String(nilai);
              return '<button type="button" class="fg-item' + (aktif ? ' is-active' : '') + '" role="option" ' +
                'aria-selected="' + (aktif ? 'true' : 'false') + '" ' +
                'data-toolbar="filter" data-modul="' + o.modul + '" data-nama="' + f.nama + '" data-value="' + MT.esc(nilai) + '">' +
                '<span class="fg-item-body"><strong>' + MT.esc(labelOpsi(op)) + '</strong></span>' +
                '<span class="fg-check" aria-hidden="true">' + MT.icon('check') + '</span>' +
              '</button>';
            }).join('') +
          '</div>' +
        '</div></div>';
    });

    if (o.urut) {
      var urutId = 'urut-' + o.modul;
      var urutLabel = '';
      o.urut.forEach(function (op) {
        if (o.urutNilai === op.nilai) urutLabel = op.label;
      });
      if (!urutLabel && o.urut[0]) urutLabel = o.urut[0].label;
      html += '<div class="toolbar-group">' +
        '<label id="lab-' + urutId + '">' + MT.t('toolbar.sort') + '</label>' +
        '<div class="fg-select" data-fg-select>' +
          '<button type="button" class="fg-select-trigger" id="' + urutId + '" ' +
            'aria-haspopup="listbox" aria-expanded="false" aria-labelledby="lab-' + urutId + ' ' + urutId + '" ' +
            'data-toolbar-trigger="urut" data-modul="' + o.modul + '">' +
            '<span class="fg-select-value">' + MT.esc(urutLabel) + '</span>' +
            '<span class="fg-select-chevron" aria-hidden="true">' + MT.icon('chevronDown') + '</span>' +
          '</button>' +
          '<div class="fg-panel" role="listbox" hidden aria-labelledby="lab-' + urutId + '">' +
            o.urut.map(function (op) {
              var aktif = o.urutNilai === op.nilai;
              return '<button type="button" class="fg-item' + (aktif ? ' is-active' : '') + '" role="option" ' +
                'aria-selected="' + (aktif ? 'true' : 'false') + '" ' +
                'data-toolbar="urut" data-modul="' + o.modul + '" data-value="' + MT.esc(op.nilai) + '">' +
                '<span class="fg-item-body"><strong>' + MT.esc(op.label) + '</strong></span>' +
                '<span class="fg-check" aria-hidden="true">' + MT.icon('check') + '</span>' +
              '</button>';
            }).join('') +
          '</div>' +
        '</div></div>';
    }

    html += '<span class="toolbar-spacer"></span>';
    if (o.kanan) html += o.kanan;
    if (o.catatan) html += '<span class="toolbar-count" data-toolbar-count="' + MT.esc(o.modul) + '">' + MT.esc(o.catatan) + '</span>';
    html += '</div>';
    return html;
  };

  /* ---------------- Tabel grid ---------------- */

  comp.tabel = function (o) {
    var kepala = o.kolom.map(function (k) {
      if (k.tanpaUrut || !o.modul) {
        return '<div class="th-cell" role="columnheader"><span class="th">' + MT.esc(k.label) + '</span></div>';
      }
      var aktif = o.sortKunci === k.kunci;
      var arah = aktif ? (o.sortArah === 'naik' ? 'ascending' : 'descending') : 'none';
      return '<div class="th-cell" role="columnheader" aria-sort="' + arah + '">' +
        '<button type="button" class="th' + (aktif ? ' th-sort-active' : '') + '" data-toolbar="urut-kolom" ' +
        'data-modul="' + o.modul + '" data-kunci="' + k.kunci + '" title="' + MT.esc(MT.t('table.sort_by', { label: k.label })) + '">' +
        MT.esc(k.label) + MT.icon(aktif && o.sortArah === 'naik' ? 'chevronUp' : 'sort') +
        '</button></div>';
    }).join('') + '<div class="th-cell th-actions" role="columnheader"><span class="th">' + MT.t('table.actions') + '</span></div>';

    var baris = o.baris.map(function (b) { return b; }).join('');

    return '<div class="table-scroll"><div class="table" role="table" aria-label="' + MT.esc(o.labelTabel || MT.t('table.default_title')) + '" ' +
      'style="--cols:' + o.lebar + '">' +
      '<div class="table-head" role="row">' + kepala + '</div>' +
      '<div class="table-body" role="rowgroup">' + baris + '</div>' +
      '</div></div>';
  };

  comp.paginasi = function (o) {
    if (o.totalHal <= 1 && o.total <= o.perHal) {
      return '<span>' + MT.t('pagination.showing', { from: o.total ? 1 : 0, to: o.total, total: o.total }) + '</span>';
    }
    var tombol = '';
    var tambah = function (isi, atribut, aktif, nonaktif) {
      return '<button type="button" class="page-btn"' + atribut + (aktif ? ' aria-current="page"' : '') +
        (nonaktif ? ' disabled' : '') + '>' + isi + '</button>';
    };
    tombol += tambah(MT.icon('chevronLeft'), ' data-toolbar="halaman" data-modul="' + o.modul + '" data-hal="' + (o.hal - 1) + '" aria-label="' + MT.t('pagination.previous') + '"', false, o.hal <= 1);

    var halaman = [];
    for (var i = 1; i <= o.totalHal; i++) {
      if (i === 1 || i === o.totalHal || Math.abs(i - o.hal) <= 1) halaman.push(i);
      else if (halaman[halaman.length - 1] !== '…') halaman.push('…');
    }
    halaman.forEach(function (h) {
      if (h === '…') { tombol += '<span class="page-ellipsis">…</span>'; return; }
      tombol += tambah(String(h),
        ' data-toolbar="halaman" data-modul="' + o.modul + '" data-hal="' + h + '" aria-label="' + MT.t('pagination.page', { page: h }) + '"',
        h === o.hal, false);
    });

    tombol += tambah(MT.icon('chevronRight'), ' data-toolbar="halaman" data-modul="' + o.modul + '" data-hal="' + (o.hal + 1) + '" aria-label="' + MT.t('pagination.next') + '"', false, o.hal >= o.totalHal);

    return '<span>' + MT.t('pagination.showing', { from: o.dari, to: o.sampai, total: o.total }) + '</span>' +
      '<div class="pagination">' + tombol + '</div>';
  };

  /* ---------------- State: kosong, error, loading ---------------- */

  comp.stateKosong = function (o) {
    return '<div class="state-block">' +
      '<span class="state-icon">' + MT.icon(o.ikon || 'inbox') + '</span>' +
      '<h3>' + MT.esc(o.judul) + '</h3>' +
      '<p>' + MT.esc(o.pesan) + '</p>' +
      (o.aksi || '') +
      '</div>';
  };

  comp.stateKosongFilter = function (o) {
    return '<div class="state-block">' +
      '<span class="state-icon">' + MT.icon('search') + '</span>' +
      '<h3>' + MT.t('empty.no_match_title') + '</h3>' +
      '<p>' + MT.t('empty.no_match_desc', { label: MT.esc(o.kata) }) + '</p>' +
      '<div class="state-actions">' +
      '<button type="button" class="btn btn-ghost" data-action="' + o.modul + '.resetFilter">' +
      MT.icon('refresh') + MT.t('empty.reset_filters') + '</button>' +
      '</div></div>';
  };

  comp.stateGalat = function (o) {
    return '<div class="state-block">' +
      '<span class="state-icon state-icon-danger">' + MT.icon('alert') + '</span>' +
      '<h3>' + MT.esc(o.judul || MT.t('error.data_load_title')) + '</h3>' +
      '<p>' + MT.esc(o.pesan || MT.t('error.data_load_desc')) + '</p>' +
      '<div class="state-actions">' +
      '<button type="button" class="btn btn-primary" data-action="' + o.aksiCobaLagi + '">' + MT.icon('refresh') + MT.t('btn.try_again') + '</button>' +
      (o.aksiTambahan || '') +
      '</div>' +
      '<p class="state-hint">' + MT.t('error.example_code', { code: MT.esc(o.kode || 'SIM-503') }) + '</p>' +
      '</div>';
  };

  comp.skeletonTabel = function (o) {
    var baris = [];
    var jumlah = (o && o.baris) || 5;
    for (var i = 0; i < jumlah; i++) {
      baris.push('<div class="sk sk-row" style="margin:0 20px"></div>');
    }
    return '<div class="table-body" aria-hidden="true" style="padding:14px 0">' + baris.join('') + '</div>' +
      '<p class="sr-only" role="status">' + MT.t('list.loading_named', { label: MT.esc((o && o.label) || MT.t('common.data')) }) + '</p>';
  };

  comp.skeletonHalaman = function () {
    return '<div class="sk-stack" aria-hidden="true">' +
      '<div class="sk sk-title"></div><div class="sk sk-sub"></div>' +
      '<div class="sk-metrics"><div><div class="sk sk-block"></div></div><div><div class="sk sk-block"></div></div>' +
      '<div><div class="sk sk-block"></div></div><div><div class="sk sk-block"></div></div></div>' +
      '<div class="sk sk-block" style="height:220px"></div>' +
      '</div><p class="sr-only" role="status">' + MT.t('page.loading') + '</p>';
  };

  /* ---------------- Form modul (tugas / laporan / pengingat) ---------------- */

  var KONFIG_MODUL = {
    tugas: {
      kata: 'tasks.label_word',
      labelNama: 'tasks.form_name',
      contohNama: 'tasks.form_name_placeholder',
      labelDeskripsi: 'tasks.form_description',
      contohDeskripsi: 'tasks.form_description_placeholder',
      labelStatus: 'tasks.form_status',
      status: ['Belum Dimulai', 'Sedang Dikerjakan', 'Selesai']
    },
    laporan: {
      kata: 'reports.label_word',
      labelNama: 'reports.form_name',
      contohNama: 'reports.form_name_placeholder',
      labelDeskripsi: 'reports.form_description',
      contohDeskripsi: 'reports.form_description_placeholder',
      labelStatus: 'reports.form_status',
      status: ['Belum Dimulai', 'Sedang Dikerjakan', 'Selesai']
    },
    pengingat: {
      kata: 'reminders.label_word',
      labelNama: 'reminders.form_name',
      contohNama: 'reminders.form_name_placeholder',
      labelDeskripsi: 'reminders.form_description',
      contohDeskripsi: 'reminders.form_description_placeholder',
      labelStatus: 'reminders.form_status',
      status: ['Aktif', 'Nonaktif', 'Selesai']
    }
  };

  comp.KONFIG_MODUL = KONFIG_MODUL;

  comp.formModul = function (o) {
    var k = KONFIG_MODUL[o.koleksi];
    var d = o.entri || {};
    var ubah = o.mode === 'ubah';
    var labelsStatus = {
      'Belum Dimulai': 'status.not_started',
      'Sedang Dikerjakan': 'status.in_progress',
      'Selesai': 'status.completed',
      'Aktif': 'status.active',
      'Nonaktif': 'status.inactive'
    };

    return '<form id="form-' + o.koleksi + '" data-form-modul="' + o.koleksi + '" data-id="' + MT.esc(d.id || '') + '" novalidate>' +
      '<div data-slot-ringkasan></div>' +
      '<div class="form-section" style="border-top:0;padding-top:0;margin-top:0">' +
        '<p class="form-section-title">' + MT.t('form.main_information') + '</p>' +
        '<p class="form-section-note">' + MT.t('form.required_note', { marker: '<span class="req">*</span>' }) + '</p>' +
        comp.field({
          nama: 'nama', label: teks(k.labelNama), nilai: d.nama || '', wajib: true,
          placeholder: teks(k.contohNama), autofokus: true
        }) +
        comp.field({
          nama: 'deskripsi', label: teks(k.labelDeskripsi), tipe: 'textarea', nilai: d.deskripsi || '',
          wajib: true, placeholder: teks(k.contohDeskripsi),
          petunjuk: MT.t('form.description_help')
        }) +
      '</div>' +
      '<div class="form-section">' +
        '<div class="form-grid">' +
          comp.field({
            nama: 'deadline', label: MT.t('form.deadline_label', { label: teks(k.kata) }), tipe: 'date', nilai: d.deadline || '',
            wajib: true, petunjuk: MT.t('form.date_help')
          }) +
          comp.field({
            nama: 'status', label: teks(k.labelStatus), tipe: 'select', nilai: d.status || '', wajib: true,
            placeholder: MT.t('form.choose_status'), opsi: k.status.map(function (status) {
              return { nilai: status, label: labelsStatus[status] ? MT.t(labelsStatus[status]) : status };
            }),
            petunjuk: MT.t('form.status_help')
          }) +
        '</div>' +
      '</div>' +
      (ubah && d.pemilikId
        ? '<div class="form-section"><p class="form-section-note">' + MT.t('form.owner_last_updated', {
          owner: MT.esc(d.pemilikNama || MT.store.namaPengguna(d.pemilikId)),
          date: MT.esc(MT.formatTanggal(d.diperbaruiPada))
        }) + '</p></div>'
        : '') +
      '</form>';
  };

  comp.kapital = function (teks) {
    return String(teks || '').charAt(0).toUpperCase() + String(teks || '').slice(1);
  };

  /* ---------------- Potongan tampilan bersama ---------------- */

  comp.cellDeadline = function (item) {
    var info = MT.infoDeadline(item.deadline, item.status);
    var kelas = info.nada === 'over' ? 'due-over' : info.nada === 'soon' ? 'due-soon' : info.nada === 'done' ? 'due-done' : '';
    return '<div class="deadline">' +
      '<span class="deadline-date">' + MT.esc(MT.formatTanggal(item.deadline)) + '</span>' +
      '<span class="deadline-note ' + kelas + '">' + MT.esc(info.teks) + '</span>' +
      '</div>';
  };

  comp.cellPemilik = function (id, namaData, emailData) {
    var nama = namaData || MT.store.namaPengguna(id);
    var email = emailData || MT.store.emailPengguna(id);
    return '<div class="cell-owner">' + MT.avatar(nama) +
      '<span class="cell-owner-text"><strong>' + MT.esc(nama) + '</strong>' +
      '<span>' + MT.esc(email) + '</span></span></div>';
  };

  comp.tombolAksi = function (o) {
    return '<button type="button" class="icon-button icon-button-sm" data-action="' + o.koleksi + '.detail" ' +
      'data-id="' + MT.esc(o.id) + '" aria-label="' + MT.esc(MT.t('btn.view_detail', { name: o.nama })) + '" title="' + MT.esc(MT.t('btn.view_detail_title')) + '">' + MT.icon('eye') + '</button>' +
      (o.bolehUbah
        ? '<button type="button" class="icon-button icon-button-sm" data-action="' + o.koleksi + '.edit" ' +
          'data-id="' + MT.esc(o.id) + '" aria-label="' + MT.esc(MT.t('btn.edit_named', { name: o.nama })) + '" title="' + MT.esc(MT.t('btn.edit')) + '">' + MT.icon('edit') + '</button>' +
          '<button type="button" class="icon-button icon-button-sm icon-button-danger" data-action="' + o.koleksi + '.hapus" ' +
          'data-id="' + MT.esc(o.id) + '" aria-label="' + MT.esc(MT.t('btn.delete_named', { name: o.nama })) + '" title="' + MT.esc(MT.t('btn.hapus')) + '">' + MT.icon('trash') + '</button>'
        : '');
  };

  comp.sel = function (tipe, isi, label) {
    return '<div class="td ' + (tipe || '') + '" role="cell" data-label="' + MT.esc(label || '') + '">' + isi + '</div>';
  };

  /* ---------------- Baris tabel generik ---------------- */

  comp.barisData = function (o) {
    return '<div class="tr" role="row" data-id="' + MT.esc(o.item.id) + '">' +
      comp.sel('td-primary',
        '<a class="td-title" href="#/' + o.rute + '/' + encodeURIComponent(o.item.id) + '">' + MT.esc(o.item.nama) + '</a>' +
        '<span class="td-sub">' + MT.esc(MT.potong(o.item.deskripsi, 74)) + '</span>',
        MT.t('table.name')) +
      (o.tanpaPemilik ? '' : comp.sel('', comp.cellPemilik(o.item.pemilikId, o.item.pemilikNama, o.item.pemilikEmail), MT.t('table.owner'))) +
      comp.sel('', comp.cellDeadline(o.item), MT.t('table.deadline')) +
      comp.sel('', MT.badgeStatus(o.item.status), MT.t('table.status')) +
      '<div class="td td-actions" role="cell">' +
        comp.tombolAksi({ koleksi: o.koleksi, id: o.item.id, nama: o.item.nama, bolehUbah: o.bolehUbah }) +
      '</div></div>';
  };

  MT.potong = function (teks, batas) {
    var t = String(teks || '');
    return t.length > batas ? t.slice(0, batas - 1).trim() + '…' : t;
  };

  MT.comp = comp;
})(window.MT);
