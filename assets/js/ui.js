/* ============================================================
   ui.js — Ikon SVG, format Bahasa Indonesia, toast, modal, dialog konfirmasi.
   ============================================================ */

window.MT = window.MT || {};

(function (MT) {
  'use strict';

  /* ---------------- Ikon (SVG garis, tanpa emoji) ---------------- */

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
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.8v2.2M12 19v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.8 12h2.2M19 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"/>',
    moon: '<path d="M20 14.3A7.8 7.8 0 0 1 9.7 4a8 8 0 1 0 10.3 10.3Z"/>',
    monitor: '<rect x="3.5" y="5" width="17" height="12" rx="1.8"/><path d="M9 19h6M12 17v2"/>',
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

  MT.icon = function (nama, extraKelas) {
    var isi = IKON[nama] || IKON.info;
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' +
      (extraKelas ? ' class="' + extraKelas + '"' : '') + '>' + isi + '</svg>';
  };

  /* ---------------- Utilitas teks & tanggal ---------------- */

  MT.esc = function (teks) {
    if (teks === null || teks === undefined) return '';
    return String(teks)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  var NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  MT.tanggalSelisih = function (hari) {
    var tanggal = new Date();
    tanggal.setHours(12, 0, 0, 0);
    tanggal.setDate(tanggal.getDate() + hari);
    return tanggal.toISOString().slice(0, 10);
  };

  function ubahKeTanggal(iso) {
    if (!iso) return null;
    var bagian = String(iso).slice(0, 10).split('-');
    if (bagian.length !== 3) return null;
    return new Date(Number(bagian[0]), Number(bagian[1]) - 1, Number(bagian[2]));
  }

  MT.formatTanggal = function (iso) {
    var d = ubahKeTanggal(iso);
    if (!d) return '—';
    if (MT.formatDate) return MT.formatDate(iso);
    return d.getDate() + ' ' + BULAN_SINGKAT[d.getMonth()] + ' ' + d.getFullYear();
  };

  MT.formatTanggalLengkap = function (iso) {
    var d = ubahKeTanggal(iso);
    if (!d) return '—';
    if (MT.formatDateFull) return MT.formatDateFull(iso);
    return NAMA_HARI[d.getDay()] + ', ' + d.getDate() + ' ' + NAMA_BULAN[d.getMonth()] + ' ' + d.getFullYear();
  };

  MT.labelBulan = function (tahunBulan) {
    if (MT.formatMonthLabel) return MT.formatMonthLabel(tahunBulan);
    var bagian = String(tahunBulan).split('-');
    var bulan = Number(bagian[1]) - 1;
    return (NAMA_BULAN[bulan] || '—') + ' ' + bagian[0];
  };

  MT.labelPendekTanggal = function (iso) {
    var d = ubahKeTanggal(iso);
    if (!d) return '—';
    if (MT.i18n && MT.i18n.getLocale) {
      try {
        return new Intl.DateTimeFormat(MT.i18n.getLocale() === 'en' ? 'en-US' : 'id-ID', {
          day: 'numeric', month: 'short'
        }).format(d);
      } catch (e) { /* use the local fallback below */ }
    }
    return d.getDate() + ' ' + BULAN_SINGKAT[d.getMonth()];
  };

  MT.selisihHari = function (iso) {
    var d = ubahKeTanggal(iso);
    if (!d) return null;
    var hariIni = new Date();
    hariIni.setHours(0, 0, 0, 0);
    return Math.round((d - hariIni) / 86400000);
  };

  /* Informasi deadline: teks + nada warna (bukan hanya warna, selalu ada teks) */
  MT.infoDeadline = function (iso, status) {
    var selisih = MT.selisihHari(iso);
    if (selisih === null) return { teks: MT.t('deadline.not_set'), nada: 'normal' };
    if (status === 'Selesai') return { teks: MT.t('deadline.completed'), nada: 'done' };
    if (selisih < 0) return { teks: MT.t('deadline.overdue', { days: Math.abs(selisih) }), nada: 'over' };
    if (selisih === 0) return { teks: MT.t('deadline.today'), nada: 'soon' };
    if (selisih === 1) return { teks: MT.t('deadline.tomorrow'), nada: 'soon' };
    if (selisih <= 3) return { teks: MT.t('deadline.in_days', { days: selisih }), nada: 'soon' };
    return { teks: MT.t('deadline.in_days', { days: selisih }), nada: 'normal' };
  };

  MT.inisial = function (nama) {
    if (!nama) return '—';
    var bagian = String(nama).trim().split(/\s+/);
    if (bagian.length === 1) return bagian[0].slice(0, 2).toUpperCase();
    return (bagian[0][0] + bagian[bagian.length - 1][0]).toUpperCase();
  };

  MT.avatar = function (nama, kelas) {
    return '<span class="avatar ' + (kelas || '') + '" aria-hidden="true">' + MT.esc(MT.inisial(nama)) + '</span>';
  };

  MT.kelasStatus = function (status) {
    if (status === 'Sedang Dikerjakan') return 'status-proses';
    if (status === 'Selesai') return 'status-selesai';
    if (status === 'Belum Dimulai') return 'status-belum';
    if (status === 'Aktif') return 'status-aktif';
    if (status === 'Nonaktif') return 'status-nonaktif';
    return 'status-belum';
  };

  MT.badgeStatus = function (status) {
    var statusKeys = {
      'Belum Dimulai': 'status.not_started',
      'Sedang Dikerjakan': 'status.in_progress',
      'Selesai': 'status.completed',
      'Aktif': 'status.active',
      'Nonaktif': 'status.inactive'
    };
    var label = status || '—';
    if (statusKeys[status] && MT.i18n && MT.i18n.getLocale() === 'en') {
      label = MT.t(statusKeys[status]);
    }
    return '<span class="status ' + MT.kelasStatus(status) + '">' + MT.esc(label) + '</span>';
  };

  MT.badgeRole = function (role) {
    if (role === 'owner') return '<span class="badge badge-primary">Owner</span>';
    return '<span class="badge badge-neutral">User</span>';
  };

  /* ---------------- Jeda & kegagalan simulasi ---------------- */

  MT.jeda = function (ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  };

  /* ---------------- Language switcher ---------------- */

  MT.bahasaSwitcher = function () {
    var locales = [
      { kode: 'id', label: MT.t('lang.id') },
      { kode: 'en', label: MT.t('lang.en') }
    ];
    var saatIni = MT.i18n.getLocale();
    var html = '<div class="lang-switcher" data-fg-select>' +
      '<button type="button" class="fg-select-trigger lang-trigger" id="lang-switch" ' +
        'aria-haspopup="listbox" aria-expanded="false" aria-label="' + MT.t('lang.switch') + '">' +
        '<span class="fg-select-value">' + (function () {
          var found = locales.find(function (l) { return l.kode === saatIni; });
          return found ? found.label : locales[0].label;
        })() + '</span>' +
        '<span class="fg-select-chevron" aria-hidden="true">' + MT.icon('chevronDown') + '</span>' +
      '</button>' +
      '<div class="fg-panel" role="listbox" hidden aria-label="' + MT.t('lang.switch') + '">' +
        locales.map(function (loc) {
          var aktif = loc.kode === saatIni;
          return '<button type="button" class="fg-item' + (aktif ? ' is-active' : '') + '" role="option" ' +
            'aria-selected="' + (aktif ? 'true' : 'false') + '" data-action="i18n.switch" data-locale="' + loc.kode + '">' +
            '<span class="fg-item-body"><strong>' + MT.esc(loc.label) + '</strong></span>' +
            (aktif ? '<span class="fg-check" aria-hidden="true">' + MT.icon('check') + '</span>' : '') +
          '</button>';
        }).join('') +
      '</div>' +
    '</div>';
    return html;
  };

  MT.theme = {
    get: function () {
      try {
        var stored = localStorage.getItem('MT.theme');
        return ['light', 'dark', 'system'].indexOf(stored) >= 0 ? stored : 'light';
      } catch (e) {
        return 'light';
      }
    },
    effective: function () {
      if (MT.theme.get() !== 'system') return MT.theme.get();
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    },
    set: function (theme) {
      var next = ['light', 'dark', 'system'].indexOf(theme) >= 0 ? theme : 'light';
      try {
        localStorage.setItem('MT.theme', next);
      } catch (e) { /* noop */ }
      document.documentElement.setAttribute('data-theme', MT.theme.effective());
      return next;
    },
    toggle: function () {
      return MT.theme.set(MT.theme.effective() === 'dark' ? 'light' : 'dark');
    }
  };

  MT.applyTheme = function () {
    var theme = MT.theme.effective();
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
    var toggles = document.querySelectorAll('[data-theme-toggle]');
    toggles.forEach(function (button) {
      if (!button) return;
      var isDark = theme === 'dark';
      button.setAttribute('aria-label', MT.t(isDark ? 'theme.switch_to_light' : 'theme.switch_to_dark'));
      button.setAttribute('title', MT.t(isDark ? 'theme.switch_to_light' : 'theme.switch_to_dark'));
      button.setAttribute('aria-pressed', isDark ? 'true' : 'false');
      var icon = button.querySelector('.theme-switch-icon');
      if (icon) {
        icon.innerHTML = MT.icon(isDark ? 'sun' : 'moon');
      }
      button.classList.toggle('is-dark', isDark);
    });
    return theme;
  };

  MT.themeSwitcher = function () {
    var isDark = MT.theme.effective() === 'dark';
    var label = MT.t(isDark ? 'theme.switch_to_light' : 'theme.switch_to_dark');
    return '<button type="button" class="theme-switcher" data-theme-toggle aria-label="' + MT.esc(label) + '" title="' + MT.esc(label) + '" aria-pressed="' + (isDark ? 'true' : 'false') + '">' +
      '<span class="theme-switch-icon" aria-hidden="true">' + MT.icon(isDark ? 'sun' : 'moon') + '</span>' +
    '</button>';
  };

  var selectCounter = 0;

  function enhanceSelect(select) {
    if (select.dataset.customSelect || select.multiple || select.size > 1) return;

    var parent = select.parentElement;
    var wrapper = document.createElement('div');
    var trigger = document.createElement('button');
    var label = document.createElement('span');
    var arrow = document.createElement('span');
    var listbox = document.createElement('div');
    var listboxId = 'custom-select-list-' + (++selectCounter);
    wrapper.className = 'custom-select';
    trigger.type = 'button';
    trigger.className = 'custom-select-trigger';
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-controls', listboxId);
    label.className = 'custom-select-label';
    arrow.className = 'custom-select-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.innerHTML = MT.icon('chevronDown');
    trigger.appendChild(label);
    trigger.appendChild(arrow);
    listbox.id = listboxId;
    listbox.className = 'custom-select-listbox';
    listbox.setAttribute('role', 'listbox');
    listbox.hidden = true;

    parent.insertBefore(wrapper, select);
    wrapper.appendChild(select);
    wrapper.appendChild(trigger);
    wrapper.appendChild(listbox);
    select.dataset.customSelect = 'true';
    select.classList.add('custom-select-native');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');
    if (parent.classList.contains('select-wrap') || parent.classList.contains('activity-filter')) {
      parent.classList.add('has-custom-select');
    }

    function selectedIndex() {
      return select.selectedIndex < 0 ? 0 : select.selectedIndex;
    }

    function synchronize() {
      var index = selectedIndex();
      var selected = select.options[index];
      label.textContent = selected ? selected.textContent : '';
      trigger.disabled = select.disabled;
      trigger.setAttribute('aria-expanded', listbox.hidden ? 'false' : 'true');
      trigger.setAttribute('aria-label', select.getAttribute('aria-label') ||
        (select.labels && select.labels.length ? select.labels[0].textContent.trim() : 'Pilih opsi'));
      ['aria-invalid', 'aria-required', 'aria-describedby', 'aria-labelledby'].forEach(function (name) {
        if (select.hasAttribute(name)) trigger.setAttribute(name, select.getAttribute(name));
        else trigger.removeAttribute(name);
      });

      while (listbox.firstChild) listbox.removeChild(listbox.firstChild);
      Array.prototype.forEach.call(select.options, function (option, optionIndex) {
        var item = document.createElement('div');
        item.className = 'custom-select-option';
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', optionIndex === index ? 'true' : 'false');
        item.setAttribute('aria-disabled', option.disabled ? 'true' : 'false');
        item.tabIndex = -1;
        item.textContent = option.textContent;
        item.addEventListener('click', function () {
          if (option.disabled) return;
          select.selectedIndex = optionIndex;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          close();
          trigger.focus();
        });
        listbox.appendChild(item);
      });
    }

    function close() {
      listbox.hidden = true;
      wrapper.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
    }

    function open() {
      document.querySelectorAll('.custom-select.is-open').forEach(function (other) {
        if (other !== wrapper) {
          other.classList.remove('is-open');
          var otherList = other.querySelector('.custom-select-listbox');
          var otherTrigger = other.querySelector('.custom-select-trigger');
          if (otherList) otherList.hidden = true;
          if (otherTrigger) otherTrigger.setAttribute('aria-expanded', 'false');
        }
      });
      listbox.hidden = false;
      wrapper.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      var current = listbox.querySelector('[role="option"][aria-selected="true"]:not([aria-disabled="true"])') ||
        listbox.querySelector('[role="option"]:not([aria-disabled="true"])');
      if (current) {
        current.focus();
        current.scrollIntoView({ block: 'nearest' });
      }
    }

    trigger.addEventListener('click', function () {
      if (listbox.hidden) open();
      else close();
    });
    trigger.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        open();
      }
    });
    listbox.addEventListener('keydown', function (event) {
      var items = Array.prototype.slice.call(listbox.querySelectorAll('[role="option"]:not([aria-disabled="true"])'));
      var currentIndex = items.indexOf(document.activeElement);
      var nextIndex = currentIndex;
      if (event.key === 'ArrowDown') nextIndex = Math.min(items.length - 1, currentIndex + 1);
      else if (event.key === 'ArrowUp') nextIndex = Math.max(0, currentIndex - 1);
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = items.length - 1;
      else if (event.key === 'Escape') {
        event.preventDefault();
        close();
        trigger.focus();
        return;
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (document.activeElement) document.activeElement.click();
        return;
      } else {
        return;
      }
      event.preventDefault();
      if (items[nextIndex]) items[nextIndex].focus();
    });
    select.addEventListener('change', synchronize);
    synchronize();
  }

  function enhanceSelects(root) {
    if (root.nodeType === 1 && root.matches('select')) enhanceSelect(root);
    if (root.querySelectorAll) root.querySelectorAll('select').forEach(enhanceSelect);
  }

  document.addEventListener('click', function (event) {
    if (event.target.closest('.custom-select')) return;
    document.querySelectorAll('.custom-select.is-open').forEach(function (wrapper) {
      wrapper.classList.remove('is-open');
      var listbox = wrapper.querySelector('.custom-select-listbox');
      var trigger = wrapper.querySelector('.custom-select-trigger');
      if (listbox) listbox.hidden = true;
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    });
  });
  enhanceSelects(document);
  if (window.MutationObserver && document.body) {
    var selectObserver = new window.MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) enhanceSelects(node);
        });
      });
    });
    selectObserver.observe(document.body, { childList: true, subtree: true });
  }

  var systemThemeQuery = window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;
  function applySystemTheme() {
    if (MT.theme.get() === 'system') MT.applyTheme();
  }
  if (systemThemeQuery) {
    if (systemThemeQuery.addEventListener) {
      systemThemeQuery.addEventListener('change', applySystemTheme);
    } else if (systemThemeQuery.addListener) {
      systemThemeQuery.addListener(applySystemTheme);
    }
  }

  /* ---------------- Toast ---------------- */

  var IKON_TOAST = { success: 'check', error: 'alert', info: 'info' };

  MT.toast = function (tipe, judul, pesan) {
    var root = document.getElementById('toast-root');
    if (!root) return;
    var el = document.createElement('div');
    el.className = 'toast toast-' + tipe;
    el.setAttribute('role', tipe === 'error' ? 'alert' : 'status');
    el.innerHTML =
      '<span class="toast-icon">' + MT.icon(IKON_TOAST[tipe] || 'info') + '</span>' +
      '<div class="toast-body"><strong>' + MT.esc(judul) + '</strong>' +
      (pesan ? '<p>' + MT.esc(pesan) + '</p>' : '') + '</div>' +
      '<button type="button" class="icon-button icon-button-sm" aria-label="Tutup notifikasi">' + MT.icon('close') + '</button>';

    function tutup() {
      el.style.opacity = '0';
      el.style.transform = 'translateY(6px)';
      el.style.transition = 'opacity .18s ease, transform .18s ease';
      setTimeout(function () { el.remove(); }, 200);
    }
    el.querySelector('button').addEventListener('click', tutup);
    root.appendChild(el);
    setTimeout(tutup, 4800);
  };

  /* ---------------- Modal ---------------- */

  MT.modal = function (opsi) {
    var root = document.getElementById('modal-root');
    var pemicuSebelumnya = document.activeElement;

    var overlay = document.createElement('div');
    overlay.className = 'overlay';
    var dialogRole = (opsi.alert || opsi.nada === 'danger' || opsi.nada === 'warning') ? 'alertdialog' : 'dialog';
    overlay.innerHTML =
      '<div class="modal ' + (opsi.ukuran === 'sm' ? 'modal-sm' : '') + '" role="' + dialogRole + '" aria-modal="true" ' +
      'aria-labelledby="modal-judul" aria-describedby="' + (opsi.subjudul ? 'modal-subjudul' : 'modal-judul') + '">' +
        '<div class="modal-head">' +
          '<div class="modal-head-text">' +
            '<h2 id="modal-judul">' + MT.esc(opsi.judul) + '</h2>' +
            (opsi.subjudul ? '<p id="modal-subjudul">' + MT.esc(opsi.subjudul) + '</p>' : '') +
          '</div>' +
          '<button type="button" class="icon-button" data-modal-close aria-label="Tutup dialog">' + MT.icon('close') + '</button>' +
        '</div>' +
        '<div class="modal-body ' + (opsi.bodyTanpaPadding ? 'modal-body-flush' : '') + '">' + (opsi.body || '') + '</div>' +
        (opsi.footer ? '<div class="modal-foot">' + opsi.footer + '</div>' : '') +
      '</div>';

    root.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    var modalEl = overlay.querySelector('.modal');

    function tutup() {
      overlay.remove();
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      if (pemicuSebelumnya && pemicuSebelumnya.focus) pemicuSebelumnya.focus();
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

    return {
      el: overlay,
      modal: modalEl,
      tutup: tutup,
      body: overlay.querySelector('.modal-body'),
      footer: overlay.querySelector('.modal-foot')
    };
  };

  /* ---------------- Dialog konfirmasi ---------------- */

  MT.konfirmasi = function (opsi) {
    return new Promise(function (resolve) {
      var nada = opsi.nada || 'danger';
      var ctrl = MT.modal({
        ukuran: 'sm',
        judul: opsi.judul,
        body:
          '<div class="alert alert-' + (nada === 'danger' ? 'danger' : 'warning') + '">' +
            '<span class="alert-icon">' + MT.icon(nada === 'danger' ? 'alert' : 'info') + '</span>' +
            '<div><strong>' + MT.esc(opsi.pesanSingkat || 'Perlu konfirmasi') + '</strong>' +
            '<p>' + MT.esc(opsi.pesan) + '</p></div>' +
          '</div>' +
          (opsi.catatan ? '<p class="muted-sm" style="margin-top:12px">' + MT.esc(opsi.catatan) + '</p>' : ''),
        footer:
          '<button type="button" class="btn btn-ghost" data-konfirmasi="batal">Batal</button>' +
          '<button type="button" class="btn ' + (nada === 'danger' ? 'btn-danger' : 'btn-primary') + '" data-konfirmasi="ya">' +
            '<span class="btn-spinner"></span><span class="btn-label">' + MT.esc(opsi.labelYa || 'Hapus') + '</span>' +
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

  /* ---------------- Tombol loading (anti klik ganda) ---------------- */

  MT.setTombolLoading = function (tombol, loading, labelLoading) {
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

  MT.labelTombolKerja = function (teks) {
    return '<span class="btn-spinner"></span><span class="btn-label">' + MT.esc(teks) + '</span>';
  };
})(window.MT);
