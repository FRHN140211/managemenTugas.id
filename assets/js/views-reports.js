/* ============================================================
   views-reports.js — Modul Manajemen Laporan.
   Rancangan utama: CRUD laporan (Nama, Deskripsi, Deadline, Status).
   Rancangan tambahan: rekap harian/bulanan, filter tanggal,
   perhitungan otomatis, dan ekspor — ditandai jelas sebagai USULAN
   yang masih menunggu persetujuan.
   ============================================================ */

window.MT = window.MT || {};

(function (MT) {
  'use strict';

  MT.stateRekap = {
    mode: 'bulan',
    bulan: MT.tanggalSelisih(0).slice(0, 7),
    dari: MT.tanggalSelisih(-30),
    sampai: MT.tanggalSelisih(0),
    summary: null,
    items: [],
    loading: false,
    error: null
  };
  var nomorPermintaanRekap = 0;

  function dataPeriode() {
    return MT.stateRekap.items;
  }

  function opsiPeriode() {
    var s = MT.stateRekap;
    return s.mode === 'rentang'
      ? { mode: 'range', from: s.dari, to: s.sampai }
      : { mode: 'month', month: s.bulan };
  }

  function muatRekap() {
    var s = MT.stateRekap;
    var requestId = ++nomorPermintaanRekap;
    s.loading = true;
    s.error = null;
    var slot = document.getElementById('slot-rekap');
    if (slot) slot.innerHTML = rekapHTML();
    return MT.store.ringkasanLaporan(opsiPeriode()).then(function (hasil) {
      if (requestId !== nomorPermintaanRekap) return;
      s.summary = hasil.summary;
      s.items = hasil.items;
      s.loading = false;
      if (slot) slot.innerHTML = rekapHTML();
    }).catch(function (err) {
      if (requestId !== nomorPermintaanRekap) return;
      s.loading = false;
      s.error = (err && err.pesan) || MT.t('error.retry_connection');
      if (slot) slot.innerHTML = rekapHTML();
    });
  }

  function rekapHTML() {
    var s = MT.stateRekap;
    var data = dataPeriode();
    var h = s.summary || { total: 0, belum: 0, proses: 0, selesai: 0 };
    var total = Number(h.total);
    var persen = function (n) { return h.total ? Math.round((n / h.total) * 100) : 0; };

    if (s.loading) return '<div class="panel-pad"><p class="muted-sm" aria-live="polite">' + MT.t('reports.loading') + '</p></div>';
    if (s.error) return '<div class="panel-pad"><div class="alert alert-danger" role="alert"><span class="alert-icon">' +
      MT.icon('alert') + '</span><div><strong>' + MT.t('reports.load_failed') + '</strong><p>' + MT.esc(s.error) +
      '</p><button type="button" class="btn btn-ghost btn-sm" data-action="laporan.rekapMuatUlang">' + MT.t('btn.try_again') + '</button></div></div></div>';

    return '<div class="panel-pad">' +
      '<div class="toolbar-group" style="flex-wrap:wrap;gap:12px;align-items:flex-end">' +
        '<div class="field" style="margin:0;min-width:180px">' +
          '<label for="rekap-mode">' + MT.t('reports.period_basis') + '</label>' +
          '<div class="select-wrap"><select id="rekap-mode" data-toolbar="rekap" data-modul="laporan" data-nama="mode">' +
            '<option value="bulan"' + (s.mode === 'bulan' ? ' selected' : '') + '>' + MT.t('reports.by_month') + '</option>' +
            '<option value="rentang"' + (s.mode === 'rentang' ? ' selected' : '') + '>' + MT.t('reports.by_range') + '</option>' +
          '</select></div>' +
        '</div>' +
        (s.mode === 'bulan'
          ? '<div class="field" style="margin:0;min-width:180px"><label for="rekap-bulan">' + MT.t('reports.month') + '</label>' +
            '<input id="rekap-bulan" type="month" value="' + MT.esc(s.bulan) + '" data-toolbar="rekap" data-modul="laporan" data-nama="bulan"></div>'
          : '<div class="field" style="margin:0;min-width:160px"><label for="rekap-dari">' + MT.t('reports.date_from') + '</label>' +
            '<input id="rekap-dari" type="date" value="' + MT.esc(s.dari) + '" data-toolbar="rekap" data-modul="laporan" data-nama="dari"></div>' +
            '<div class="field" style="margin:0;min-width:160px"><label for="rekap-sampai">' + MT.t('reports.date_to') + '</label>' +
            '<input id="rekap-sampai" type="date" value="' + MT.esc(s.sampai) + '" data-toolbar="rekap" data-modul="laporan" data-nama="sampai"></div>') +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="laporan.rekapReset">' + MT.icon('refresh') + MT.t('reports.reset_action') + '</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="laporan.ekspor">' + MT.icon('download') + MT.t('reports.export_csv_concept') + '</button>' +
      '</div>' +

      '<div class="grid-2" style="margin-top:20px;align-items:start">' +
        '<div>' +
          '<p class="meta-label" style="margin-bottom:10px">' + MT.t('reports.status_breakdown') + '</p>' +
          '<div class="chart-bars">' +
            '<div class="chart-row"><span class="chart-row-label">' + MT.t('status.not_started') + '</span>' +
              '<span class="chart-track"><span class="chart-fill chart-fill-belum" style="width:' + persen(Number(h.belum)) + '%"></span></span>' +
              '<span class="chart-row-value">' + h.belum + '</span></div>' +
            '<div class="chart-row"><span class="chart-row-label">' + MT.t('status.in_progress') + '</span>' +
              '<span class="chart-track"><span class="chart-fill chart-fill-proses" style="width:' + persen(Number(h.proses)) + '%"></span></span>' +
              '<span class="chart-row-value">' + h.proses + '</span></div>' +
            '<div class="chart-row"><span class="chart-row-label">' + MT.t('status.completed') + '</span>' +
              '<span class="chart-track"><span class="chart-fill chart-fill-selesai" style="width:' + persen(Number(h.selesai)) + '%"></span></span>' +
              '<span class="chart-row-value">' + h.selesai + '</span></div>' +
          '</div>' +
        '</div>' +
        '<div>' +
          '<p class="meta-label" style="margin-bottom:10px">' + MT.t('reports.period_summary') + '</p>' +
          '<dl class="def-list">' +
            '<div class="def-row"><dt>' + MT.t('reports.summary_period') + '</dt><dd>' +
              (s.mode === 'bulan' ? MT.esc(MT.labelBulan(s.bulan)) : MT.esc(MT.formatTanggal(s.dari)) + ' \u2013 ' + MT.esc(MT.formatTanggal(s.sampai))) +
            '</dd></div>' +
            '<div class="def-row"><dt>' + MT.t('reports.report_count') + '</dt><dd>' + total + ' ' + MT.t('reports.reports') + '</dd></div>' +
            '<div class="def-row"><dt>' + MT.t('reports.completion_rate') + '</dt><dd>' + persen(Number(h.selesai)) + '% ' + MT.t('reports.reports_status_completed') + '</dd></div>' +
            '<div class="def-row"><dt>' + MT.t('reports.data_source') + '</dt><dd>' + MT.t('reports.data_source_desc') + '</dd></div>'
          '</dl>' +
        '</div>' +
      '</div>' +

      (total
        ? '<div class="table-scroll" style="margin-top:18px"><div class="table" role="table" aria-label="' + MT.t('reports.period_table_aria') + '" style="--cols:2.2fr 1.1fr 1fr 1.2fr">' +
            '<div class="table-head" role="row">' +
              '<div class="th-cell" role="columnheader"><span class="th">' + MT.t('reports.table_name') + '</span></div>' +
              '<div class="th-cell" role="columnheader"><span class="th">' + MT.t('reports.table_deadline') + '</span></div>' +
              '<div class="th-cell" role="columnheader"><span class="th">' + MT.t('reports.table_status') + '</span></div>' +
              '<div class="th-cell" role="columnheader"><span class="th">' + MT.t('reports.table_owner') + '</span></div>' +
            '</div>' +
            '<div class="table-body" role="rowgroup">' +
              data.map(function (item) {
                return '<div class="tr" role="row">' +
                  '<div class="td td-primary" role="cell"><a class="td-title" href="#/laporan/' + encodeURIComponent(item.id) + '">' + MT.esc(item.nama) + '</a>' +
                    '<span class="td-sub">' + MT.esc(MT.potong(item.deskripsi, 62)) + '</span></div>' +
                  '<div class="td" role="cell" data-label="' + MT.t('reports.table_deadline') + '"><span class="deadline-date">' + MT.esc(MT.formatTanggal(item.deadline)) + '</span></div>' +
                  '<div class="td" role="cell" data-label="' + MT.t('reports.table_status') + '">' + MT.badgeStatus(item.status) + '</div>' +
                  '<div class="td" role="cell" data-label="' + MT.t('reports.table_owner') + '"><span class="td-meta">' + MT.esc(item.pemilikNama || MT.store.namaPengguna(item.pemilikId)) + '</span></div>' +
                '</div>';
              }).join('') +
            '</div>' +
          '</div></div>' +
          (total > data.length ? '<p class="muted-sm" style="padding:12px 20px 0">' + MT.t('reports.showing_items', { showing: data.length, total: total }) + '</p>' : '')
        : MT.comp.stateKosong({
            ikon: 'report',
            judul: MT.t('reports.empty_title'),
            pesan: MT.t('reports.empty_desc')
          })) +
    '</div>';
  }

  function panelRekap() {
    return '<div class="section">' +
      '<div class="section-head">' +
        '<div>' +
          '<h3 style="display:flex;align-items:center;gap:10px">' + MT.t('reports.auto_summary') + ' ' +
            '<span class="tag-konsep">' + MT.t('reports.concept') + '</span></h3>' +
          '<p>' + MT.t('reports.auto_summary_desc') + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="panel" id="slot-rekap">' + rekapHTML() + '</div>' +
    '</div>';
  }

  function detailEkstra() {
    return '<div class="panel-head"><h3>' + MT.t('reports.detail_extra_title') + '</h3></div>' +
      '<div class="panel-pad"><div class="note-list">' +
        '<div class="note-item"><div class="note-item-head"><span class="tag-requirement">' + MT.t('reports.requirement_tag') + '</span>' +
          '<strong>' + MT.t('reports.manual_crud_title') + '</strong></div><p>' + MT.t('reports.manual_crud_desc') + '</p></div>' +
        '<div class="note-item"><div class="note-item-head"><span class="tag-usulan">' + MT.t('reports.proposal_tag') + '</span>' +
          '<strong>' + MT.t('reports.auto_export_title') + '</strong></div><p>' + MT.t('reports.auto_export_desc') + '</p></div>' +
        '<div class="note-item"><div class="note-item-head"><span class="tag-terbuka">' + MT.t('reports.open_decision_tag') + '</span>' +
          '<strong>' + MT.t('reports.metrics_title') + '</strong></div><p>' + MT.t('reports.metrics_desc') + '</p></div>' +
      '</div></div>';
  }

  MT.buatModul({
    koleksi: 'laporan',
    rute: 'laporan',
    ikon: 'report',
    labelEntri: 'reports.label_entry',
    labelKata: 'reports.label_word',
    judulHalaman: 'reports.page_title',
    deskripsi: 'reports.page_desc',
    placeholderCari: 'reports.placeholder_search',
    kosongJudul: 'reports.empty_module_title',
    kosongPesan: 'reports.empty_module_desc',
    fieldWajib: 'reports.required_fields',
    keputusanTerbuka: 'reports.open_decisions_short',
    panelEkstra: panelRekap,
    listMounted: muatRekap,
    detailEkstra: detailEkstra
  });

  /* Handler khusus panel rekap (usulan) */
  MT.modulHandler.laporan.rekap = function (nama, nilai) {
    MT.stateRekap[nama] = nilai;
    muatRekap();
  };
  MT.aksi['laporan.rekapMuatUlang'] = function () { muatRekap(); };

  MT.aksi['laporan.rekapReset'] = function () {
    MT.stateRekap.mode = 'bulan';
    MT.stateRekap.bulan = MT.tanggalSelisih(0).slice(0, 7);
    MT.stateRekap.dari = MT.tanggalSelisih(-30);
    MT.stateRekap.sampai = MT.tanggalSelisih(0);
    muatRekap();
    MT.toast('info', MT.t('reports.reset_title'), MT.t('reports.reset_desc'));
  };

  MT.aksi['laporan.ekspor'] = function () {
    var summary = MT.stateRekap.summary;
    if (!summary || !Number(summary.total)) {
      MT.toast('error', MT.t('reports.no_export_data_title'), MT.t('reports.no_export_data_desc'));
      return;
    }
    var period = MT.stateRekap.mode === 'bulan'
      ? (function () {
          var yearMonth = MT.stateRekap.bulan.split('-');
          var year = Number(yearMonth[0]);
          var month = Number(yearMonth[1]);
          var lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
          return { from: MT.stateRekap.bulan + '-01', to: MT.stateRekap.bulan + '-' + String(lastDay).padStart(2, '0') };
        })()
      : { from: MT.stateRekap.dari, to: MT.stateRekap.sampai };
    var csvHeaders = [MT.t('reports.table_name'), MT.t('reports.table_desc'), MT.t('reports.table_deadline'), MT.t('reports.table_status'), MT.t('reports.table_owner')];
    MT.store.semuaHalaman('laporan', {
      pageSize: 100,
      sort: 'deadline-asc',
      from: period.from,
      to: period.to
    }).then(function (data) {
      var baris = [csvHeaders];
      data.forEach(function (i) {
        baris.push([i.nama, i.deskripsi, i.deadline, i.status, i.pemilikNama || MT.store.namaPengguna(i.pemilikId)]);
      });
      var csv = baris.map(function (r) {
        return r.map(function (sel) {
          var teks = String(sel).replace(/^[\t\r\n ]*[=+\-@]/, "'$&");
          return '"' + teks.replace(/"/g, '""') + '"';
        }).join(',');
      }).join('\r\n');
      var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      var tautan = document.createElement('a');
      tautan.href = URL.createObjectURL(blob);
      tautan.download = 'rekap-laporan-' + (MT.stateRekap.mode === 'bulan' ? MT.stateRekap.bulan : MT.stateRekap.dari + '_' + MT.stateRekap.sampai) + '.csv';
      document.body.appendChild(tautan);
      tautan.click();
      tautan.remove();
      URL.revokeObjectURL(tautan.href);
      MT.toast('success', MT.t('reports.csv_created_title'), MT.t('reports.csv_created_desc', { count: data.length }));
    }).catch(function (err) {
      MT.toast('error', MT.t('reports.export_failed_title'), (err && err.pesan) || MT.t('reports.export_failed_desc'));
    });
  };
})(window.MT);
