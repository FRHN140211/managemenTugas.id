/* ============================================================
   views-activity.js — Ringkasan analitik aktivitas pengguna.
   ============================================================ */

window.MT = window.MT || {};

(function (MT) {
  'use strict';

  var state = {
    range: '12m',
    year: new Date().getFullYear(),
    userId: '',
    data: null,
    error: null,
    loading: false,
    selectedDay: '',
    request: 0,
    loadingMore: false
  };
  var refreshTimer = null;
  var DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  var DAYS_SHORT = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var EVENT_LABELS = {
    tugas_dibuat: 'Membuat tugas',
    tugas_diubah: 'Mengubah tugas',
    tugas_selesai: 'Menyelesaikan tugas',
    tugas_dihapus: 'Menghapus tugas',
    laporan_dibuat: 'Membuat laporan',
    laporan_diubah: 'Mengubah laporan',
    laporan_dikirim: 'Menyelesaikan laporan',
    laporan_dihapus: 'Menghapus laporan',
    pengingat_dibuat: 'Membuat pengingat',
    pengingat_diubah: 'Mengubah pengingat',
    pengingat_selesai: 'Menyelesaikan pengingat',
    pengingat_dihapus: 'Menghapus pengingat',
    login: 'Masuk ke aplikasi'
  };
  var EVENT_ICONS = {
    tugas_dibuat: 'plus',
    tugas_diubah: 'edit',
    tugas_selesai: 'check',
    tugas_dihapus: 'trash',
    laporan_dibuat: 'report',
    laporan_diubah: 'edit',
    laporan_dikirim: 'check',
    laporan_dihapus: 'trash',
    pengingat_dibuat: 'reminder',
    pengingat_diubah: 'edit',
    pengingat_selesai: 'check',
    pengingat_dihapus: 'trash',
    login: 'user'
  };

  function esc(value) { return MT.esc(value == null ? '' : String(value)); }
  function number(value) { return new Intl.NumberFormat('id-ID').format(Number(value) || 0); }
  function percent(value) { return (Number(value) || 0) + '%'; }

  function dateValue(value) {
    var parts = String(value).split('-').map(Number);
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  }

  function dateString(date) {
    return date.toISOString().slice(0, 10);
  }

  function shiftDate(value, days) {
    var date = dateValue(value);
    date.setUTCDate(date.getUTCDate() + days);
    return dateString(date);
  }

  function formatDay(value, includeWeekday) {
    var date = dateValue(value);
    var weekday = DAYS[(date.getUTCDay() + 6) % 7];
    return (includeWeekday ? weekday + ', ' : '') +
      date.getUTCDate() + ' ' + MONTHS[date.getUTCMonth()] + ' ' + date.getUTCFullYear();
  }

  function formatRelative(value) {
    var timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) return 'Waktu tidak diketahui';
    var seconds = Math.round((timestamp - Date.now()) / 1000);
    var absolute = Math.abs(seconds);
    var unit = absolute < 60 ? 'second' : absolute < 3600 ? 'minute' :
      absolute < 86400 ? 'hour' : absolute < 2592000 ? 'day' : 'month';
    var divisor = { second: 1, minute: 60, hour: 3600, day: 86400, month: 2592000 }[unit];
    var valueInUnit = Math.round(seconds / divisor);
    if (typeof Intl.RelativeTimeFormat === 'function') {
      return new Intl.RelativeTimeFormat('id-ID', { numeric: 'auto' }).format(valueInUnit, unit);
    }
    return valueInUnit < 0 ? Math.abs(valueInUnit) + ' ' + unit + ' lalu' : 'dalam ' + valueInUnit + ' ' + unit;
  }

  function labelTrendDate(value, granularity) {
    if (granularity === 'month') {
      var month = dateValue(value);
      return MONTHS[month.getUTCMonth()] + ' ' + String(month.getUTCFullYear()).slice(-2);
    }
    var date = dateValue(value);
    return date.getUTCDate() + ' ' + MONTHS[date.getUTCMonth()];
  }

  function optionsRentang() {
    return [
      ['7d', '7 hari terakhir'],
      ['30d', '30 hari terakhir'],
      ['90d', '90 hari terakhir'],
      ['12m', '12 bulan terakhir'],
      ['year', 'Tahun kalender']
    ].map(function (item) {
      return '<option value="' + item[0] + '"' + (state.range === item[0] ? ' selected' : '') + '>' + item[1] + '</option>';
    }).join('');
  }

  function filterHTML(data) {
    var owner = MT.store.adalahOwner();
    var currentYear = new Date().getFullYear();
    var tahun = '';
    for (var y = currentYear; y >= Math.max(2000, currentYear - 10); y--) {
      tahun += '<option value="' + y + '"' + (state.year === y ? ' selected' : '') + '>' + y + '</option>';
    }
    var userOptions = '<option value="">Seluruh tim</option>';
    (data && data.users || []).forEach(function (user) {
      userOptions += '<option value="' + esc(user.id) + '"' +
        (state.userId === user.id ? ' selected' : '') + '>' + esc(user.name) + '</option>';
    });
    return '<div class="activity-toolbar" id="activity-filters">' +
      '<div class="activity-filter"><span>Rentang waktu</span><select data-activity-filter="range" aria-label="Pilih rentang waktu">' +
        optionsRentang() + '</select></div>' +
      (state.range === 'year'
        ? '<div class="activity-filter"><span>Tahun</span><select data-activity-filter="year" aria-label="Pilih tahun">' + tahun + '</select></div>'
        : '') +
      (owner
        ? '<div class="activity-filter activity-filter-user"><span>Pengguna</span><select data-activity-filter="user" aria-label="Pilih pengguna">' +
            userOptions + '</select></div>'
        : '') +
      '<span class="activity-timezone">Zona waktu ' + esc(data && data.timezone || 'Asia/Jakarta') + '</span>' +
    '</div>';
  }

  function skeletonCards() {
    return '<div class="activity-kpis">' +
      '<div class="activity-skeleton-card"></div>'.repeat(6) +
    '</div><div class="activity-grid-two">' +
      '<div class="activity-skeleton-panel"></div><div class="activity-skeleton-panel"></div>' +
    '</div><div class="activity-skeleton-panel activity-skeleton-heatmap"></div>';
  }

  function trendText(current, previous) {
    var now = Number(current) || 0;
    var before = Number(previous) || 0;
    if (!before) return now ? 'Mulai tercatat pada periode ini' : 'Belum ada aktivitas pada periode sebelumnya';
    var change = Math.round(((now - before) / before) * 100);
    var direction = change > 0 ? 'naik' : change < 0 ? 'turun' : 'tetap';
    return direction + ' ' + Math.abs(change) + '% dibanding periode sebelumnya';
  }

  function kpiCard(title, value, note, icon, tone) {
    return '<article class="activity-kpi' + (tone ? ' ' + tone : '') + '">' +
      '<div class="activity-kpi-top"><span>' + esc(title) + '</span><span class="activity-kpi-icon" aria-hidden="true">' +
        MT.icon(icon) + '</span></div>' +
      '<strong class="activity-kpi-value">' + value + '</strong>' +
      '<span class="activity-kpi-note">' + esc(note) + '</span>' +
    '</article>';
  }

  function activityDays(data) {
    var counts = new Map();
    data.heatmap.daily.forEach(function (item) { counts.set(item.date, Number(item.count)); });
    return counts;
  }

  function hitungStreak(data, counts) {
    var date = data.today;
    if (!counts.get(date)) {
      var yesterday = shiftDate(date, -1);
      if (!counts.get(yesterday)) return { current: 0, longest: 0 };
      date = yesterday;
    }
    var current = 0;
    while (counts.get(date)) {
      current++;
      date = shiftDate(date, -1);
    }
    var longest = 0;
    var run = 0;
    var cursor = data.heatmap.start;
    while (cursor <= data.today) {
      if (counts.get(cursor)) {
        run++;
        longest = Math.max(longest, run);
      } else {
        run = 0;
      }
      cursor = shiftDate(cursor, 1);
    }
    return { current: current, longest: longest };
  }

  function heatmapLevel(counts) {
    var positive = counts.filter(function (count) { return count > 0; }).sort(function (a, b) { return a - b; });
    if (!positive.length) return function () { return 0; };
    function quantile(p) { return positive[Math.max(0, Math.ceil(p * positive.length) - 1)]; }
    var q1 = quantile(0.25);
    var q2 = quantile(0.5);
    var q3 = quantile(0.75);
    return function (count) {
      if (!count) return 0;
      if (count > q3) return 4;
      if (count > q2) return 3;
      if (count > q1) return 2;
      return 1;
    };
  }

  function heatmapHTML(data, counts) {
    var map = activityDays(data);
    var allCounts = data.heatmap.daily.map(function (item) { return Number(item.count); });
    var levelFor = heatmapLevel(allCounts);
    var first = dateValue(data.heatmap.start);
    var offset = (first.getUTCDay() + 6) % 7;
    var gridStart = shiftDate(data.heatmap.start, -offset);
    var last = dateValue(data.heatmap.end);
    var days = Math.round((last - dateValue(gridStart)) / 86400000) + 1;
    var weeks = Math.ceil(days / 7);
    var labels = '';
    var cells = '';
    var seenMonths = {};

    for (var column = 0; column < weeks; column++) {
      var monday = shiftDate(gridStart, column * 7);
      var mondayDate = dateValue(monday);
      for (var row = 0; row < 7; row++) {
        var date = shiftDate(monday, row);
        var dateObj = dateValue(date);
        if (dateObj.getUTCDate() === 1 || (column === 0 && !seenMonths[dateObj.getUTCMonth()])) {
          var monthKey = dateObj.getUTCFullYear() + '-' + dateObj.getUTCMonth();
          if (!seenMonths[monthKey]) {
            labels += '<span class="activity-month-label" style="grid-column:' + (column + 1) + ';grid-row:1">' +
              MONTHS[dateObj.getUTCMonth()] + '</span>';
            seenMonths[monthKey] = true;
          }
        }
        if (date < data.heatmap.start || date > data.heatmap.end) {
          cells += '<span class="activity-heat-cell activity-heat-blank" style="grid-column:' +
            (column + 1) + ';grid-row:' + (row + 2) + '" aria-hidden="true"></span>';
          continue;
        }
        var amount = map.get(date) || 0;
        var weekday = DAYS[(dateObj.getUTCDay() + 6) % 7];
        var selected = state.selectedDay === date;
        var title = amount + ' aktivitas pada ' + formatDay(date, true);
        cells += '<button type="button" class="activity-heat-cell activity-heat-' + levelFor(amount) +
          (selected ? ' is-selected' : '') + '" style="grid-column:' + (column + 1) + ';grid-row:' + (row + 2) +
          '" title="' + esc(title) + '" aria-label="' + esc(title) + '" aria-pressed="' + selected +
          '" data-action="aktivitas.pilihHari" data-hari="' + date + '"></button>';
      }
    }

    var weekdayLabels = [0, 2, 4].map(function (day) {
      return '<span style="grid-row:' + (day + 2) + '">' + DAYS_SHORT[day] + '</span>';
    }).join('');
    var trend = data.heatmap.total
      ? number(data.heatmap.total) + ' aktivitas dalam 12 bulan terakhir'
      : 'Belum ada aktivitas dalam 12 bulan terakhir';

    return '<section class="panel activity-panel activity-heatmap-panel" aria-labelledby="activity-heatmap-title">' +
      '<div class="panel-head"><div><h3 id="activity-heatmap-title">Peta kontribusi</h3>' +
        '<p class="muted-sm">' + esc(trend) + '</p></div>' +
        '<span class="activity-panel-mark" aria-hidden="true">' + MT.icon('calendar') + '</span></div>' +
      '<div class="activity-heatmap-scroll" id="activity-heatmap-scroll" tabindex="0" aria-label="Peta aktivitas harian, gulir mendatar untuk menjelajah">' +
        '<div class="activity-heatmap-row"><div class="activity-weekdays" aria-hidden="true">' + weekdayLabels + '</div>' +
          '<div class="activity-heatmap-grid" style="grid-template-columns:repeat(' + weeks + ', 12px);width:' + (weeks * 12) + 'px">' +
            labels + cells +
          '</div></div>' +
      '</div>' +
      '<div class="activity-heatmap-footer"><div class="activity-legend" aria-label="Skala aktivitas, sedikit hingga banyak">' +
        '<span>Sedikit</span><i class="activity-heat-0"></i><i class="activity-heat-1"></i><i class="activity-heat-2"></i>' +
        '<i class="activity-heat-3"></i><i class="activity-heat-4"></i><span>Banyak</span></div>' +
        '<span class="activity-muted">Setiap kolom mewakili satu minggu</span></div>' +
      (state.selectedDay
        ? '<div class="activity-day-detail" id="activity-day-detail">' + dayDetailHTML(data, state.selectedDay) + '</div>'
        : '') +
    '</section>';
  }

  function dayDetailHTML(data, date) {
    var events = data.dayItems || [];
    return '<div class="activity-day-detail-head"><div><strong>' + esc(formatDay(date, true)) +
      '</strong><span>' + number(events.length) + ' aktivitas' + (events.length === 50 ? ' atau lebih' : '') +
      '</span></div><button type="button" class="icon-button" data-action="aktivitas.tutupHari" aria-label="Tutup rincian tanggal">' +
      MT.icon('close') + '</button></div>' +
      (events.length
        ? '<ul class="activity-day-list">' + events.map(function (item) {
            return '<li><span>' + esc(EVENT_LABELS[item.type] || 'Aktivitas') + '</span>' +
              '<strong>' + esc(item.title || '—') + '</strong>' +
              '<time datetime="' + esc(item.createdAt) + '">' + esc(new Intl.DateTimeFormat('id-ID', {
                hour: '2-digit', minute: '2-digit', timeZone: data.timezone
              }).format(new Date(item.createdAt))) + '</time></li>';
          }).join('') + '</ul>'
        : '<p class="muted-sm">Belum ada aktivitas pada tanggal ini.</p>');
  }

  function kpisHTML(data, counts) {
    var kpi = data.kpi;
    var streak = hitungStreak(data, counts);
    var activeDay = data.heatmap.daily.reduce(function (best, item) {
      return Number(item.count) > Number(best.count) ? item : best;
    }, { date: '', count: 0 });
    var activeLabel = activeDay.count ? formatDay(activeDay.date, false) : '—';
    return '<div class="activity-kpis" aria-label="Ringkasan aktivitas">' +
      kpiCard('Total aktivitas', number(kpi.total), trendText(kpi.total, kpi.previousTotal), 'trend') +
      kpiCard('Tugas selesai', number(kpi.completed), trendText(kpi.completed, kpi.previousCompleted), 'check', 'is-positive') +
      kpiCard('Tingkat penyelesaian', percent(data.tasks.total ? Math.round((data.tasks.completed / data.tasks.total) * 100) : 0),
        number(data.tasks.completed) + ' dari ' + number(data.tasks.total) + ' tugas pada rentang ini', 'trend', 'is-positive') +
      kpiCard('Tepat waktu', percent(kpi.onTimeRate), 'Dihitung dari tugas selesai yang memiliki tenggat', 'calendar') +
      kpiCard('Streak saat ini', number(streak.current) + ' hari', 'Streak terpanjang: ' + number(streak.longest) + ' hari', 'trend', 'is-positive') +
      kpiCard('Hari paling aktif', esc(activeLabel), number(activeDay.count) + ' aktivitas tercatat', 'clock') +
    '</div>';
  }

  function donutHTML(data) {
    var task = data.tasks;
    var items = [
      { label: 'Belum dikerjakan', count: task.notStarted, color: 'var(--ink-muted)' },
      { label: 'Sedang dikerjakan', count: task.inProgress, color: 'var(--primary)' },
      { label: 'Selesai', count: task.completed, color: 'var(--teal)' },
      { label: 'Terlambat', count: task.overdue, color: 'var(--coral)' }
    ];
    var denominator = task.total || 1;
    var cursor = 0;
    var stops = items.map(function (item) {
      var start = cursor;
      cursor += (Number(item.count) / denominator) * 100;
      return item.color + ' ' + start.toFixed(2) + '% ' + cursor.toFixed(2) + '%';
    });
    var gradient = task.total ? 'conic-gradient(' + stops.join(',') + ')' : 'conic-gradient(var(--surface-sunken) 0 100%)';
    var legend = items.map(function (item, index) {
      var rate = task.total ? Math.round((Number(item.count) / task.total) * 100) : 0;
      return '<li><span class="activity-legend-dot activity-dot-' + index + '" aria-hidden="true"></span>' +
        '<span>' + item.label + '</span><strong>' + number(item.count) + '</strong><small>' + rate + '%</small></li>';
    }).join('');
    return '<div class="activity-status-chart"><div class="activity-donut" role="img" aria-label="Komposisi ' +
      esc(task.total + ' tugas: ' + items.map(function (item) { return item.label + ' ' + item.count; }).join(', ')) +
      '" style="background:' + gradient + '"><div><strong>' + number(task.total) + '</strong><span>tugas</span></div></div>' +
      '<ul class="activity-donut-legend">' + legend + '</ul></div>';
  }

  function ringHTML(data) {
    var total = data.tasks.total;
    var done = data.tasks.completed;
    var rate = total ? Math.round((done / total) * 100) : 0;
    return '<div class="activity-progress"><div class="activity-progress-ring" role="img" aria-label="Tingkat penyelesaian ' +
      rate + ' persen, ' + number(done) + ' dari ' + number(total) + ' tugas" style="--progress:' + rate +
      '%"><div><strong>' + rate + '%</strong><span>selesai</span></div></div>' +
      '<div><strong>' + number(done) + ' dari ' + number(total) + ' tugas</strong>' +
      '<p class="muted-sm">' + (total ? number(data.tasks.overdue) + ' tugas melewati tenggat' : 'Belum ada tugas pada rentang ini') +
      '</p></div></div>';
  }

  function makeBuckets(data) {
    var start = dateValue(data.range.start);
    var end = dateValue(data.range.end);
    var current = new Map();
    var previous = new Map();
    data.trend.current.forEach(function (item) { current.set(item.date, Number(item.count)); });
    data.trend.previous.forEach(function (item) { previous.set(item.date, Number(item.count)); });
    var length = data.trend.granularity === 'month'
      ? (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth() + (end.getUTCDate() > 1 ? 1 : 0)
      : Math.round((end - start) / 86400000);
    length = Math.max(1, Math.min(length, 366));
    var buckets = [];
    for (var index = 0; index < length; index++) {
      var bucketDate;
      if (data.trend.granularity === 'month') {
        bucketDate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1));
      } else {
        bucketDate = new Date(start);
        bucketDate.setUTCDate(bucketDate.getUTCDate() + index);
      }
      var date = dateString(bucketDate);
      var priorDate;
      if (data.trend.granularity === 'month') {
        var previousStart = dateValue(data.range.previousStart);
        priorDate = dateString(new Date(Date.UTC(previousStart.getUTCFullYear(), previousStart.getUTCMonth() + index, 1)));
      } else {
        priorDate = shiftDate(data.range.previousStart, index);
      }
      buckets.push({
        date: date,
        label: labelTrendDate(date, data.trend.granularity),
        current: current.get(date) || 0,
        previous: previous.get(priorDate) || 0
      });
    }
    return buckets;
  }

  function trendHTML(data) {
    var buckets = makeBuckets(data);
    var max = Math.max.apply(null, buckets.map(function (item) { return Math.max(item.current, item.previous); }).concat([1]));
    var width = 620;
    var height = 220;
    var left = 34;
    var right = 12;
    var top = 14;
    var bottom = 34;
    var chartWidth = width - left - right;
    var chartHeight = height - top - bottom;
    function points(key) {
      return buckets.map(function (item, index) {
        var x = left + (buckets.length === 1 ? chartWidth / 2 : (index / (buckets.length - 1)) * chartWidth);
        var y = top + chartHeight - (item[key] / max) * chartHeight;
        return { x: x, y: y };
      });
    }
    function path(key) {
      return points(key).map(function (point, index) {
        return (index ? 'L' : 'M') + point.x.toFixed(1) + ',' + point.y.toFixed(1);
      }).join(' ');
    }
    var grid = '';
    for (var i = 0; i <= 3; i++) {
      var y = top + chartHeight * i / 3;
      grid += '<line x1="' + left + '" y1="' + y.toFixed(1) + '" x2="' + (width - right) +
        '" y2="' + y.toFixed(1) + '" class="activity-chart-grid"></line>';
    }
    var labels = buckets.map(function (item, index) {
      var every = Math.max(1, Math.ceil(buckets.length / 6));
      if (index % every && index !== buckets.length - 1) return '';
      var x = left + (buckets.length === 1 ? chartWidth / 2 : (index / (buckets.length - 1)) * chartWidth);
      return '<text x="' + x.toFixed(1) + '" y="' + (height - 8) + '" text-anchor="middle" class="activity-chart-label">' +
        esc(item.label) + '</text>';
    }).join('');
    var description = buckets.map(function (item) { return item.label + ': ' + item.current; }).join('; ');
    return '<svg class="activity-trend-svg" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Tren aktivitas: ' +
      esc(description) + '">' + grid +
      '<path d="' + path('previous') + '" class="activity-trend-previous"></path>' +
      '<path d="' + path('current') + '" class="activity-trend-current"></path>' + labels + '</svg>';
  }

  function productivityHTML(data) {
    var week = new Array(7).fill(0);
    var hour = new Array(24).fill(0);
    data.weekdays.forEach(function (item) { week[item.day - 1] = Number(item.count); });
    data.hours.forEach(function (item) { hour[item.hour] = Number(item.count); });
    var maxDay = Math.max.apply(null, week.concat([1]));
    var maxHour = Math.max.apply(null, hour.concat([1]));
    var days = week.map(function (count, index) {
      return '<div class="activity-day-bar"><span>' + DAYS_SHORT[index] + '</span><i><b style="width:' +
        Math.round(count / maxDay * 100) + '%"></b></i><strong>' + number(count) + '</strong></div>';
    }).join('');
    var hours = hour.map(function (count, index) {
      var intensity = count ? Math.max(1, Math.ceil(count / maxHour * 4)) : 0;
      return '<span class="activity-hour-cell activity-heat-' + intensity + '" title="' + index +
        ':00 — ' + count + ' aktivitas" role="img" aria-label="' + index + ':00, ' + count + ' aktivitas"></span>';
    }).join('');
    return '<div class="activity-productivity">' +
      '<div class="activity-productivity-block"><h4>Hari dalam seminggu</h4><div class="activity-day-bars">' + days + '</div></div>' +
      '<div class="activity-productivity-block"><h4>Jam dalam sehari</h4><div class="activity-hour-labels"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>' +
        '<div class="activity-hour-strip" role="group" aria-label="Distribusi aktivitas per jam">' + hours + '</div></div>' +
    '</div>';
  }

  function breakdownHTML(data) {
    var labels = {
      tugas_dibuat: 'Tugas dibuat', tugas_diubah: 'Tugas diubah', tugas_selesai: 'Tugas selesai',
      tugas_dihapus: 'Tugas dihapus', laporan_dibuat: 'Laporan dibuat', laporan_diubah: 'Laporan diubah',
      laporan_dikirim: 'Laporan selesai', laporan_dihapus: 'Laporan dihapus',
      pengingat_dibuat: 'Pengingat dibuat', pengingat_diubah: 'Pengingat diubah',
      pengingat_selesai: 'Pengingat selesai', pengingat_dihapus: 'Pengingat dihapus', login: 'Masuk'
    };
    var max = Math.max.apply(null, data.eventTypes.map(function (item) { return Number(item.count); }).concat([1]));
    if (!data.eventTypes.length) return '<p class="muted-sm">Belum ada aktivitas untuk dirangkum.</p>';
    return '<div class="activity-type-bars">' + data.eventTypes.map(function (item) {
      return '<div class="activity-type-row"><span>' + esc(labels[item.type] || 'Aktivitas lainnya') + '</span>' +
        '<i><b style="width:' + Math.round(Number(item.count) / max * 100) + '%"></b></i>' +
        '<strong>' + number(item.count) + '</strong></div>';
    }).join('') + '</div>';
  }

  function timelineHTML(data) {
    var list = data.recent || [];
    if (!list.length) {
      return '<div class="activity-timeline-empty"><span aria-hidden="true">' + MT.icon('list') + '</span>' +
        '<p>Belum ada aktivitas pada rentang ini.</p><a class="btn btn-ghost btn-sm" href="#/tugas">Buat tugas pertama</a></div>';
    }
    return '<ol class="activity-timeline">' + list.map(function (item) {
      var action = EVENT_LABELS[item.type] || 'Melakukan aktivitas';
      var subject = item.title ? '“' + item.title + '”' : '';
      var who = MT.store.adalahOwner() && !state.userId && item.name ? '<span> oleh ' + esc(item.name) + '</span>' : '';
      return '<li class="activity-timeline-item"><span class="activity-timeline-icon" aria-hidden="true">' +
        MT.icon(EVENT_ICONS[item.type] || 'activity') + '</span><div class="activity-timeline-copy">' +
        '<strong>' + esc(action) + (subject ? ' ' + esc(subject) : '') + who + '</strong>' +
        '<span>' + esc(formatRelative(item.createdAt)) + '</span></div></li>';
    }).join('') + '</ol>' +
    (data.recentHasMore
      ? '<div class="activity-timeline-more"><button type="button" class="btn btn-ghost btn-sm" data-action="aktivitas.muatLagi"' +
        (state.loadingMore ? ' disabled' : '') + '>' + (state.loadingMore ? 'Memuat…' : 'Muat lebih banyak') + '</button></div>'
      : '');
  }

  function rankingHTML(data) {
    if (!MT.store.adalahOwner() || state.userId) return '';
    if (!data.ranking.length) return '<p class="muted-sm">Belum ada kontribusi tim pada rentang ini.</p>';
    var max = Math.max.apply(null, data.ranking.map(function (item) { return Number(item.total); }).concat([1]));
    return '<ol class="activity-ranking">' + data.ranking.map(function (item, index) {
      var initials = MT.inisial(item.name);
      return '<li><span class="activity-rank-number">' + (index + 1) + '</span><span class="activity-rank-avatar" aria-hidden="true">' +
        esc(initials) + '</span><span class="activity-rank-name">' + esc(item.name) + '</span>' +
        '<span class="activity-rank-track"><i style="width:' + Math.round(Number(item.total) / max * 100) + '%"></i></span>' +
        '<strong>' + number(item.total) + '</strong></li>';
    }).join('') + '</ol>';
  }

  function dashboardHTML(data) {
    var counts = activityDays(data);
    var empty = !data.kpi.total && !data.tasks.total;
    return (state.error
      ? '<div class="alert alert-danger activity-error" role="alert"><span class="alert-icon">' + MT.icon('alert') +
        '</span><div><strong>Data belum dapat diperbarui</strong><p>' + esc(state.error) +
        '</p><button class="btn btn-ghost btn-sm" type="button" data-action="aktivitas.cobaLagi">Coba lagi</button></div></div>'
      : '') +
      (state.loading ? '<p class="activity-refresh-note" aria-live="polite">Memperbarui ringkasan…</p>' : '') +
      (empty
        ? '<div class="activity-empty-banner"><span aria-hidden="true">' + MT.icon('flag') +
          '</span><div><strong>Belum ada aktivitas pada rentang ini</strong>' +
          '<p>Buat tugas untuk mulai melihat pola produktivitas Anda.</p></div>' +
          '<a href="#/tugas" class="btn btn-primary btn-sm">Buat tugas</a></div>'
        : '') +
      heatmapHTML(data, counts) +
      kpisHTML(data, counts) +
      '<div class="activity-grid-two">' +
        '<section class="panel activity-panel"><div class="panel-head"><div><h3>Status tugas</h3>' +
          '<p class="muted-sm">Posisi tugas yang dibuat pada rentang terpilih</p></div></div><div class="panel-pad">' +
          donutHTML(data) + '<div class="activity-progress-divider"></div>' + ringHTML(data) + '</div></section>' +
        '<section class="panel activity-panel"><div class="panel-head"><div><h3>Tren aktivitas</h3>' +
          '<p class="muted-sm">Dibandingkan dengan periode sebelumnya</p></div><span class="activity-panel-mark" aria-hidden="true">' +
          MT.icon('trend') + '</span></div><div class="activity-trend-legend"><span><i></i>Periode ini</span>' +
          '<span><i></i>Periode sebelumnya</span></div><div class="activity-trend-wrap">' + trendHTML(data) +
          '</div></section>' +
      '</div>' +
      '<section class="panel activity-panel"><div class="panel-head"><div><h3>Pola produktivitas</h3>' +
        '<p class="muted-sm">Waktu aktivitas berdasarkan zona ' + esc(data.timezone) + '</p></div></div>' +
        '<div class="panel-pad">' + productivityHTML(data) + '</div></section>' +
      '<div class="activity-grid-two">' +
        '<section class="panel activity-panel"><div class="panel-head"><div><h3>Jenis aktivitas</h3>' +
          '<p class="muted-sm">Komposisi aksi yang tercatat</p></div></div><div class="panel-pad">' +
          breakdownHTML(data) + '</div></section>' +
        (MT.store.adalahOwner() && !state.userId
          ? '<section class="panel activity-panel"><div class="panel-head"><div><h3>Kontribusi anggota</h3>' +
              '<p class="muted-sm">Anggota dengan aktivitas terbanyak pada rentang ini</p></div></div>' +
              '<div class="panel-pad">' + rankingHTML(data) + '</div></section>'
          : '<section class="panel activity-panel"><div class="panel-head"><div><h3>Progres penyelesaian</h3>' +
              '<p class="muted-sm">Rasio tugas selesai dari tugas yang dibuat pada rentang ini</p></div></div>' +
              '<div class="panel-pad">' + ringHTML(data) + '</div></section>') +
      '</div>' +
      '<section class="panel activity-panel activity-timeline-panel"><div class="panel-head"><div><h3>Aktivitas terbaru</h3>' +
        '<p class="muted-sm">Riwayat singkat dalam rentang terpilih</p></div></div>' +
        '<div class="activity-timeline-wrap">' + timelineHTML(data) + '</div></section>';
  }

  function gambar() {
    var root = document.getElementById('activity-dashboard-content');
    if (!root) return;
    root.setAttribute('aria-busy', state.loading ? 'true' : 'false');
    if (!state.data) {
      root.innerHTML = state.error
        ? '<div class="alert alert-danger" role="alert"><span class="alert-icon">' + MT.icon('alert') +
          '</span><div><strong>Ringkasan belum tersedia</strong><p>' + esc(state.error) +
          '</p><button class="btn btn-ghost btn-sm" type="button" data-action="aktivitas.cobaLagi">Coba lagi</button></div></div>'
        : skeletonCards();
      return;
    }
    root.innerHTML = filterHTML(state.data) + dashboardHTML(state.data);
    var scroll = document.getElementById('activity-heatmap-scroll');
    if (scroll) scroll.scrollLeft = scroll.scrollWidth;
  }

  function ambil(opsi) {
    opsi = opsi || {};
    var request = ++state.request;
    state.loading = true;
    if (opsi.append) state.loadingMore = true;
    state.error = null;
    gambar();
    var params = {
      rentang: state.range,
      tahun: state.range === 'year' ? state.year : null,
      userId: state.userId || null,
      hari: state.selectedDay || null,
      offset: opsi.append && state.data ? state.data.recentOffset : 0
    };
    return MT.store.muatRingkasanAktivitas(params).then(function (hasil) {
      if (request !== state.request || !document.getElementById('activity-dashboard-content')) return;
      if (opsi.append && state.data) {
        hasil.recent = state.data.recent.concat(hasil.recent);
      }
      state.data = hasil;
      state.error = null;
    }).catch(function (error) {
      if (request !== state.request) return;
      state.error = (error && error.pesan) || 'Periksa koneksi, lalu coba lagi.';
    }).finally(function () {
      if (request !== state.request) return;
      state.loading = false;
      state.loadingMore = false;
      gambar();
    });
  }

  function hentikanPenyegaran() {
    if (refreshTimer) window.clearInterval(refreshTimer);
    refreshTimer = null;
  }

  function pasangPenyegaran() {
    hentikanPenyegaran();
    refreshTimer = window.setInterval(function () {
      if (location.hash.replace(/\/$/, '') !== '#/aktivitas') {
        hentikanPenyegaran();
        return;
      }
      if (document.visibilityState === 'visible' && !state.loading) ambil();
    }, 60000);
  }

  MT.rute.aktivitas = {
    judul: function () { return MT.t('nav.aktivitas'); },
    remah: function () {
      return [
        { label: MT.t('breadcrumb.dashboard'), rute: 'dashboard' },
        { label: MT.t('nav.aktivitas') }
      ];
    },
    render: function () {
      state.loading = true;
      state.error = null;
      return '<div class="page-head activity-page-head"><div class="page-head-text">' +
        '<span class="activity-eyebrow">Analitik ruang kerja</span><h2>' + esc(MT.t('nav.aktivitas')) + '</h2>' +
        '<p>Kenali pola kontribusi dan produktivitas dari pekerjaan yang tercatat.</p></div></div>' +
        '<div id="activity-dashboard-content" aria-live="polite">' +
        (state.data ? filterHTML(state.data) + dashboardHTML(state.data) : skeletonCards()) + '</div>';
    },
    setelah: function () {
      gambar();
      ambil();
      pasangPenyegaran();
    }
  };

  MT.aksi['aktivitas.cobaLagi'] = function () { ambil(); };
  MT.aksi['aktivitas.pilihHari'] = function (data, event, element) {
    state.selectedDay = data.hari || '';
    ambil().then(function () {
      var selected = document.querySelector('[data-action="aktivitas.pilihHari"][data-hari="' + state.selectedDay + '"]');
      if (selected) selected.focus();
    });
  };
  MT.aksi['aktivitas.tutupHari'] = function () {
    state.selectedDay = '';
    ambil();
  };
  MT.aksi['aktivitas.muatLagi'] = function () { if (!state.loading) ambil({ append: true }); };

  document.addEventListener('change', function (event) {
    var target = event.target && event.target.closest
      ? event.target.closest('[data-activity-filter]')
      : null;
    if (!target || !document.getElementById('activity-dashboard-content')) return;
    var filter = target.getAttribute('data-activity-filter');
    if (filter === 'range') {
      state.range = target.value;
      if (state.range === 'year' && !state.year) state.year = new Date().getFullYear();
    } else if (filter === 'year') {
      state.year = Number(target.value);
    } else if (filter === 'user') {
      state.userId = target.value;
    }
    state.selectedDay = '';
    ambil();
  });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' &&
        location.hash.replace(/\/$/, '') === '#/aktivitas' && !state.loading) {
      ambil();
    }
  });

  MT.modulHandler.aktivitas = {};
})(window.MT);
