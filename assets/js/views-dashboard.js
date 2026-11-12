/* ============================================================
   views-dashboard.js — Dashboard modular premium.
   Komposisi: header sapaan · panel ringkasan · 3 metrik ·
   grafik tren · kolom kanan (aktivitas + deadline) ·
   akses cepat + agenda. Data berasal dari API terautentikasi.
   ============================================================ */

window.MT = window.MT || {};

(function (MT) {
  'use strict';

  function sapaan() {
    var jam = new Date().getHours();
    if (jam < 11) return MT.t('dashboard.greet_morning');
    if (jam < 15) return MT.t('dashboard.greet_afternoon');
    if (jam < 18) return MT.t('dashboard.greet_evening');
    return MT.t('dashboard.greet_night');
  }

  /* ---------- Panel utama ringkasan ---------- */
  function panelUtama() {
    var t = MT.store.ringkasan().tugas;
    var aktif = t.belum + t.proses;
    var total = t.total || 1;
    var persen = Math.round((t.selesai / total) * 100);

    return '<section class="dash-hero">' +
      '<div class="dash-hero-body">' +
        '<span class="dash-hero-label">' + MT.t('dashboard.hero_label') + '</span>' +
        '<h2 class="dash-hero-title">' + MT.t('dashboard.hero_title') + '</h2>' +
        '<p class="dash-hero-desc">' + MT.t('dashboard.hero_desc') + '</p>' +
        '<div class="dash-hero-stats">' +
          '<div class="dash-hero-stat">' +
            '<strong class="tnum">' + aktif + '</strong>' +
            '<span>' + MT.t('dashboard.stat_active') + '</span>' +
          '</div>' +
          '<div class="dash-hero-stat">' +
            '<strong class="tnum">' + t.selesai + '</strong>' +
            '<span>' + MT.t('dashboard.stat_done') + '</span>' +
          '</div>' +
          '<div class="dash-hero-stat">' +
            '<strong class="tnum">' + persen + '%</strong>' +
            '<span>' + MT.t('dashboard.stat_progress') + '</span>' +
          '</div>' +
        '</div>' +
        '<a class="btn btn-hero" href="#/tugas">' + MT.icon('tasks') + MT.t('dashboard.manage_all_tasks') + '</a>' +
      '</div>' +
      '<div class="dash-hero-accent" aria-hidden="true"></div>' +
    '</section>';
  }

  /* ---------- Tiga kartu metrik ---------- */
  function kartuMetrik() {
    var t = MT.store.ringkasan().tugas;
    var aktif = t.belum + t.proses;

    return '<div class="dash-metrics">' +
      '<a class="dash-metric" href="#/tugas">' +
        '<span class="dash-metric-label">' + MT.t('dashboard.metric_total') + '</span>' +
        '<strong class="dash-metric-value tnum">' + t.total + '</strong>' +
        '<span class="dash-metric-note">' + MT.t('dashboard.metric_all_status') + '</span>' +
      '</a>' +
      '<a class="dash-metric" href="#/tugas">' +
        '<span class="dash-metric-label">' + MT.t('dashboard.metric_in_progress') + '</span>' +
        '<strong class="dash-metric-value tnum">' + t.proses + '</strong>' +
        '<span class="dash-metric-note">' + t.belum + ' ' + MT.t('dashboard.metric_not_started') + '</span>' +
      '</a>' +
      '<a class="dash-metric dash-metric-ok" href="#/tugas">' +
        '<span class="dash-metric-label">' + MT.t('dashboard.metric_completed') + '</span>' +
        '<strong class="dash-metric-value tnum">' + t.selesai + '</strong>' +
        '<span class="dash-metric-note">' + MT.t('dashboard.metric_from_total', { total: t.total }) + '</span>' +
      '</a>' +
    '</div>';
  }

  /* ---------- Grafik tren penyelesaian dari aktivitas database ---------- */
  function grafikTren() {
    var points = (MT.store.state.completionTrend || []).map(function (item) {
      var bagian = item.date.split('-');
      var tanggal = new Date(Number(bagian[0]), Number(bagian[1]) - 1, Number(bagian[2]));
      return {
        label: MT.formatWeekdayShort(tanggal),
        nilai: item.count
      };
    });
    if (!points.length) {
      return '<section class="panel dash-chart">' +
        '<div class="panel-head"><h3>' + MT.t('dashboard.chart_title') + '</h3>' +
        '<p class="muted-sm">' + MT.t('dashboard.chart_empty') + '</p></div>' +
        '<div class="panel-pad"><p class="muted-sm">' + MT.t('dashboard.chart_will_fill') + '</p></div>' +
      '</section>';
    }
    var max = Math.max.apply(null, points.map(function (p) { return p.nilai; }).concat([1])) + 1;
    var w = 560;
    var h = 160;
    var padL = 28;
    var padR = 12;
    var padT = 16;
    var padB = 28;
    var chartW = w - padL - padR;
    var chartH = h - padT - padB;
    var stepX = chartW / (points.length - 1);

    var pathLine = [];
    var pathArea = [];
    points.forEach(function (p, i) {
      var x = padL + i * stepX;
      var y = padT + chartH - (p.nilai / max) * chartH;
      pathLine.push((i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1));
      if (i === 0) pathArea.push('M' + x.toFixed(1) + ',' + (padT + chartH));
      pathArea.push('L' + x.toFixed(1) + ',' + y.toFixed(1));
      if (i === points.length - 1) pathArea.push('L' + x.toFixed(1) + ',' + (padT + chartH) + 'Z');
    });

    var labels = points.map(function (p, i) {
      var x = padL + i * stepX;
      return '<text x="' + x.toFixed(1) + '" y="' + (h - 8) + '" text-anchor="middle" class="chart-label">' + p.label + '</text>';
    }).join('');

    var grid = '';
    for (var g = 0; g <= 4; g++) {
      var gy = padT + (chartH / 4) * g;
      grid += '<line x1="' + padL + '" y1="' + gy.toFixed(1) + '" x2="' + (w - padR) + '" y2="' + gy.toFixed(1) + '" class="chart-grid"/>';
    }

    return '<section class="panel dash-chart">' +
      '<div class="panel-head">' +
      '<div><h3>' + MT.t('dashboard.chart_title') + '</h3>' +
      '<p class="muted-sm">' + MT.t('dashboard.chart_subtitle') + '</p></div>' +
      '<span class="badge badge-neutral">' + MT.t('dashboard.data_source') + '</span>' +
      '</div>' +
      '<div class="dash-chart-body">' +
        '<svg viewBox="0 0 ' + w + ' ' + h + '" class="dash-chart-svg" role="img" aria-label="' + MT.t('dashboard.chart_aria') + '">' +
          grid +
          '<path d="' + pathArea.join(' ') + '" class="chart-area"/>' +
          '<path d="' + pathLine.join(' ') + '" class="chart-line" fill="none"/>' +
          labels +
        '</svg>' +
      '</div>' +
    '</section>';
  }

  /* ---------- Tugas prioritas (kiri bawah grafik) ---------- */
  function tugasPrioritas() {
    var daftar = MT.store.state.priorityTasks || [];

    if (!daftar.length) {
      return '<section class="panel">' +
        '<div class="panel-head"><h3>' + MT.t('dashboard.priority_title') + '</h3></div>' +
        MT.comp.stateKosong({
          ikon: 'tasks',
          judul: MT.t('dashboard.priority_empty_title'),
          pesan: MT.t('dashboard.priority_empty_desc'),
          aksi: '<div class="state-actions"><button type="button" class="btn btn-primary" data-action="tugas.tambah">' +
            MT.icon('plus') + MT.t('dashboard.add_task') + '</button></div>'
        }) +
      '</section>';
    }

    return '<section class="panel">' +
      '<div class="panel-head">' +
        '<h3>' + MT.t('dashboard.priority_title') + '</h3>' +
        '<a class="link-button" href="#/tugas">' + MT.t('dashboard.view_all') + '</a>' +
      '</div>' +
      '<div class="list-plain">' +
        daftar.map(function (t) {
          var info = MT.infoDeadline(t.deadline, t.status);
          var kelas = info.nada === 'over' ? 'due-over' : info.nada === 'soon' ? 'due-soon' : '';
          return '<div class="list-plain-item">' +
            '<div class="list-plain-main">' +
              '<strong><a href="#/tugas/' + encodeURIComponent(t.id) + '">' + MT.esc(t.nama) + '</a></strong>' +
              '<span>' + MT.esc(MT.store.namaPengguna(t.pemilikId)) + ' · ' + MT.esc(t.status) + '</span>' +
            '</div>' +
            '<div class="deadline" style="text-align:right">' +
              '<span class="deadline-date">' + MT.esc(MT.formatTanggal(t.deadline)) + '</span>' +
              '<span class="deadline-note ' + kelas + '">' + MT.esc(info.teks) + '</span>' +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>' +
    '</section>';
  }

  /* ---------- Kolom kanan: aktivitas ---------- */
  function panelAktivitas() {
    var daftar = MT.store.state.aktivitas.slice(0, 5);
    if (!daftar.length) {
      return '<section class="panel">' +
        '<div class="panel-head"><h3>' + MT.t('dashboard.activity_title') + '</h3></div>' +
        MT.comp.stateKosong({
          ikon: 'list',
          judul: MT.t('dashboard.activity_empty_title'),
          pesan: MT.t('dashboard.activity_empty_desc')
        }) +
      '</section>';
    }

    return '<section class="panel">' +
      '<div class="panel-head"><h3>' + MT.t('dashboard.activity_title') + '</h3></div>' +
      '<div class="panel-pad"><div class="timeline">' +
        daftar.map(function (a) {
          var ikon = a.aksi.indexOf('Menghapus') === 0 ? 'trash'
            : a.aksi.indexOf('Menambah') === 0 ? 'plus'
            : a.aksi.indexOf('Masuk') === 0 || a.aksi.indexOf('Keluar') === 0 ? 'logout'
            : 'edit';
          var nada = a.aksi.indexOf('Menghapus') === 0 ? 'timeline-mark-coral'
            : a.aksi.indexOf('Menambah') === 0 ? 'timeline-mark-teal' : 'timeline-mark-cobalt';
          return '<div class="timeline-item">' +
            '<span class="timeline-mark ' + nada + '">' + MT.icon(ikon) + '</span>' +
            '<div class="timeline-body">' +
              '<strong>' + MT.esc(a.aksi) + ' — ' + MT.esc(a.objek) + '</strong>' +
              '<span>' + MT.esc(a.aktor) + ' · ' + MT.esc(MT.formatTanggal(a.waktu)) + '</span>' +
            '</div>' +
          '</div>';
        }).join('') +
      '</div></div>' +
    '</section>';
  }

  /* ---------- Kolom kanan: deadline mendatang ---------- */
  function panelDeadline() {
    var items = MT.store.ringkasan().deadlineSegera || [];
    /* Fallback: ambil dari tugas + pengingat */
    if (!MT.store.state.dashboardSummary) {
      var tugas = MT.store.daftar('tugas').filter(function (t) {
        return t.status !== 'Selesai' && MT.selisihHari(t.deadline) !== null;
      }).map(function (t) {
        return {
          id: t.id,
          nama: t.nama,
          deadline: t.deadline,
          status: t.status,
          jenis: 'tugas',
          href: '#/tugas/' + t.id
        };
      });
      var rem = MT.store.daftar('pengingat').filter(function (p) {
        return p.status === 'Aktif' && MT.selisihHari(p.deadline) !== null;
      }).map(function (p) {
        return {
          id: p.id,
          nama: p.nama || MT.t('dashboard.item_reminder'),
          deadline: p.deadline,
          status: p.status,
          jenis: 'pengingat',
          href: '#/pengingat/' + p.id
        };
      });
      items = tugas.concat(rem).sort(function (a, b) {
        return MT.selisihHari(a.deadline) - MT.selisihHari(b.deadline);
      }).slice(0, 5);
    } else {
      items = items.slice(0, 5);
    }

    if (!items.length) {
      return '<section class="panel">' +
        '<div class="panel-head"><h3>' + MT.t('dashboard.deadline_title') + '</h3></div>' +
        MT.comp.stateKosong({
          ikon: 'reminder',
          judul: MT.t('dashboard.deadline_empty_title'),
          pesan: MT.t('dashboard.deadline_empty_desc')
        }) +
      '</section>';
    }

    return '<section class="panel">' +
      '<div class="panel-head">' +
        '<h3>' + MT.t('dashboard.deadline_title') + '</h3>' +
        '<a class="link-button" href="#/pengingat">' + MT.t('dashboard.view_all') + '</a>' +
      '</div>' +
      '<div class="list-plain">' +
        items.map(function (it) {
          var info = MT.infoDeadline(it.deadline, it.status);
          var kelas = info.nada === 'over' ? 'due-over' : info.nada === 'soon' ? 'due-soon' : '';
          var href = it.href || (it.jenis === 'pengingat' ? '#/pengingat/' + it.id : '#/tugas/' + it.id);
          return '<div class="list-plain-item">' +
            '<div class="list-plain-main">' +
              '<strong><a href="' + href + '">' + MT.esc(it.nama) + '</a></strong>' +
              '<span>' + (it.jenis === 'pengingat' ? MT.t('dashboard.item_reminder') : MT.t('dashboard.item_task')) + ' · ' + MT.esc(it.status || '') + '</span>' +
            '</div>' +
            '<div class="deadline" style="text-align:right">' +
              '<span class="deadline-date">' + MT.esc(MT.formatTanggal(it.deadline)) + '</span>' +
              '<span class="deadline-note ' + kelas + '">' + MT.esc(info.teks) + '</span>' +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>' +
    '</section>';
  }

  /* ---------- Akses cepat ---------- */
  function aksesCepat() {
    var owner = MT.store.adalahOwner();
    return '<section class="panel dash-quick">' +
      '<div class="panel-head"><h3>' + MT.t('dashboard.quick_title') + '</h3></div>' +
      '<div class="dash-quick-grid">' +
        '<button type="button" class="dash-quick-btn" data-action="tugas.tambah">' +
          '<span class="dash-quick-icon">' + MT.icon('tasks') + '</span>' +
          '<span><strong>' + MT.t('dashboard.quick_add_task') + '</strong><em>' + MT.t('dashboard.quick_task_desc') + '</em></span>' +
        '</button>' +
        '<button type="button" class="dash-quick-btn" data-action="laporan.tambah">' +
          '<span class="dash-quick-icon">' + MT.icon('report') + '</span>' +
          '<span><strong>' + MT.t('dashboard.quick_create_report') + '</strong><em>' + MT.t('dashboard.quick_report_desc') + '</em></span>' +
        '</button>' +
        '<button type="button" class="dash-quick-btn" data-action="pengingat.tambah">' +
          '<span class="dash-quick-icon">' + MT.icon('reminder') + '</span>' +
          '<span><strong>' + MT.t('dashboard.quick_add_reminder') + '</strong><em>' + MT.t('dashboard.quick_reminder_desc') + '</em></span>' +
        '</button>' +
        (owner
          ? '<button type="button" class="dash-quick-btn" data-action="pengguna.tambah">' +
              '<span class="dash-quick-icon">' + MT.icon('users') + '</span>' +
              '<span><strong>' + MT.t('dashboard.quick_add_user') + '</strong><em>' + MT.t('dashboard.quick_owner_only') + '</em></span>' +
            '</button>'
          : '') +
      '</div>' +
    '</section>';
  }

  /* ---------- Agenda ringkas ---------- */
  function panelAgenda() {
    var tugas = (MT.store.state.priorityTasks || []).slice(0, 4);

    if (!tugas.length) {
      return '<section class="panel">' +
        '<div class="panel-head"><h3>' + MT.t('dashboard.agenda_title') + '</h3></div>' +
        '<p class="muted-sm">' + MT.t('dashboard.agenda_empty') + '</p>' +
        '</section>';
    }

    return '<section class="panel">' +
      '<div class="panel-head">' +
        '<h3>' + MT.t('dashboard.agenda_title') + '</h3>' +
        '<a class="link-button" href="#/tugas">' + MT.t('dashboard.all_tasks') + '</a>' +
      '</div>' +
      '<div class="dash-agenda">' +
        tugas.map(function (t) {
          var info = MT.infoDeadline(t.deadline, t.status);
          var kelas = info.nada === 'over' ? 'is-over' : info.nada === 'soon' ? 'is-soon' : '';
          return '<a class="dash-agenda-item ' + kelas + '" href="#/tugas/' + encodeURIComponent(t.id) + '">' +
            '<span class="dash-agenda-date">' +
              '<strong>' + MT.esc(MT.formatTanggal(t.deadline).split(' ')[0] || MT.formatTanggal(t.deadline)) + '</strong>' +
            '</span>' +
            '<span class="dash-agenda-body">' +
              '<strong>' + MT.esc(t.nama) + '</strong>' +
              '<em>' + MT.esc(info.teks) + '</em>' +
            '</span>' +
          '</a>';
        }).join('') +
      '</div>' +
    '</section>';
  }

  /* ---------- Render utama ---------- */
  function render() {
    var u = MT.store.penggunaAktif();
    var namaDepan = (u.nama || MT.t('common.unknown_user')).split(' ')[0];

    return '<div class="dash">' +
      /* Header */
      '<header class="dash-header">' +
        '<div class="dash-header-text">' +
          '<p class="dash-greeting">' + MT.esc(sapaan()) + ', <strong>' + MT.esc(namaDepan) + '</strong></p>' +
          '<p class="dash-sub">' + MT.t('dashboard.welcome_back') + '</p>' +
        '</div>' +
        '<div class="dash-header-actions">' +
          '<button type="button" class="btn btn-primary" data-action="tugas.tambah">' +
            MT.icon('plus') + MT.t('dashboard.new_task') + '</button>' +
        '</div>' +
      '</header>' +

      /* Hero + metrics */
      panelUtama() +
      kartuMetrik() +

      /* Grid utama: kiri (grafik + prioritas) | kanan (aktivitas + deadline) */
      '<div class="dash-grid">' +
        '<div class="dash-main">' +
          grafikTren() +
          tugasPrioritas() +
        '</div>' +
        '<aside class="dash-side">' +
          panelAktivitas() +
          panelDeadline() +
        '</aside>' +
      '</div>' +

      /* Bawah: akses cepat + agenda */
      '<div class="dash-bottom">' +
        aksesCepat() +
        panelAgenda() +
      '</div>' +
    '</div>';
  }

  MT.rute.dashboard = {
    judul: function () { return MT.t('nav.dashboard'); },
    remah: function () { return [{ label: MT.t('breadcrumb.dashboard') }]; },
    render: render
  };
})(window.MT);
