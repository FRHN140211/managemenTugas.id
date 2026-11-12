/* ============================================================
   i18n.js — Internationalization module.
   Loads locale JSON, provides MT.t(), locale detection,
   localStorage persistence, and locale-change re-render hook.
   ============================================================ */

window.MT = window.MT || {};

(function (MT) {
  'use strict';

  var currentLocale = 'id';
  var translations = {};
  var changeListeners = [];

  function getLocaleLookupOrder() {
    var ordered = [];
    var seen = {};
    [currentLocale, currentLocale === 'id' ? 'en' : 'id', 'id', 'en'].forEach(function (locale) {
      if (!locale || seen[locale]) return;
      seen[locale] = true;
      ordered.push(locale);
    });
    return ordered;
  }

  function detectLocale() {
    try {
      var stored = localStorage.getItem('MT.locale');
      return ['id', 'en'].indexOf(stored) >= 0 ? stored : 'id';
    } catch (e) {
      return 'id';
    }
  }

  function setStoredLocale(locale) {
    try {
      localStorage.setItem('MT.locale', locale);
    } catch (e) { /* noop */ }
  }

  function applyLocaleData(data, locale) {
    if (!locale) locale = currentLocale;
    translations = translations || {};
    translations[locale] = data || {};
  }

  function resolveKey(data, key) {
    if (!data || !key) return undefined;
    if (Object.prototype.hasOwnProperty.call(data, key)) return data[key];
    var parts = String(key).split('.');
    if (parts.length <= 1) return data[key];
    var cursor = data;
    for (var i = 0; i < parts.length; i += 1) {
      if (cursor && Object.prototype.hasOwnProperty.call(cursor, parts[i])) {
        cursor = cursor[parts[i]];
      } else {
        return undefined;
      }
    }
    return cursor;
  }

  function applyParams(str, params) {
    var value = String(str);
    if (!params) return value;
    Object.keys(params).forEach(function (k) {
      value = value.replace(new RegExp('\\{' + k + '\\}', 'g'), String(params[k]));
    });
    return value;
  }

  function formatMissingKey(key, locale) {
    var label = String(key).split('.').slice(-1)[0] || 'label';
    var localeLabel = locale === 'en' ? 'English' : 'Indonesia';
    return localeLabel + ' fallback: ' + label.replace(/[_-]+/g, ' ');
  }

  function localeTag() {
    return currentLocale === 'en' ? 'en-US' : 'id-ID';
  }

  function loadLocaleFile(locale) {
    return fetch('assets/locales/' + locale + '.json')
      .then(function (r) {
        if (!r.ok) throw new Error('Locale file not found: ' + locale);
        return r.json();
      })
      .then(function (data) {
        applyLocaleData(data, locale);
        currentLocale = locale;
        setStoredLocale(locale);
        changeListeners.forEach(function (fn) {
          try { fn(locale); } catch (e) { /* noop */ }
        });
      });
  }

  /**
   * Translate a key with optional named params.
   * Falls back to a safe locale-aware string when the key is missing.
   */
  function t(key, params) {
    if (!key) return '';
    var localeOrder = getLocaleLookupOrder();
    for (var i = 0; i < localeOrder.length; i += 1) {
      var locale = localeOrder[i];
      var data = translations && translations[locale];
      var resolved = resolveKey(data, key);
      if (resolved !== undefined && resolved !== null) {
        return applyParams(String(resolved), params);
      }
    }
    return formatMissingKey(key, currentLocale);
  }

  MT.i18n = {
    init: function () {
      currentLocale = detectLocale();
      setStoredLocale(currentLocale);
      return loadLocaleFile(currentLocale);
    },
    t: t,
    setLocale: function (locale) {
      if (['id', 'en'].indexOf(locale) < 0 || locale === currentLocale) return Promise.resolve();
      return loadLocaleFile(locale);
    },
    getLocale: function () { return currentLocale; },
    onChange: function (fn) { changeListeners.push(fn); }
  };
  MT.t = MT.i18n.t;

  /**
   * Locale-aware number formatter (fallback, no dependency).
   */
  MT.formatNumber = function (num) {
    try {
      return new Intl.NumberFormat(localeTag()).format(num);
    } catch (e) {
      return String(num);
    }
  };

  /**
   * Locale-aware date formatter.
   */
  MT.formatDate = function (iso, options) {
    if (!iso) return '—';
    var d = isoToDate(iso);
    if (!d) return '—';
    try {
      return new Intl.DateTimeFormat(localeTag(), options || {
        year: 'numeric', month: 'short', day: 'numeric'
      }).format(d);
    } catch (e) {
      return d.getDate() + ' ' + BULAN_SINGKAT[d.getMonth()] + ' ' + d.getFullYear();
    }
  };

  /**
   * Locale-aware full date formatter (with weekday).
   */
  MT.formatDateFull = function (iso) {
    if (!iso) return '—';
    var d = isoToDate(iso);
    if (!d) return '—';
    try {
      return new Intl.DateTimeFormat(localeTag(), {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      }).format(d);
    } catch (e) {
      return NAMA_HARI[d.getDay()] + ', ' + d.getDate() + ' ' + NAMA_BULAN[d.getMonth()] + ' ' + d.getFullYear();
    }
  };

  /**
   * Locale-aware weekday short name for chart labels.
   */
  MT.formatWeekdayShort = function (dateObj) {
    try {
      return new Intl.DateTimeFormat(localeTag(), { weekday: 'short' }).format(dateObj);
    } catch (e) {
      return dateObj.toLocaleDateString(localeTag(), { weekday: 'short' });
    }
  };

  /**
   * Locale-aware month label (e.g. "October 2026" or "Oktober 2026").
   */
  MT.formatMonthLabel = function (tahunBulan) {
    var bagian = String(tahunBulan).split('-');
    if (bagian.length < 2) return '—';
    var year = Number(bagian[0]);
    var month = Number(bagian[1]) - 1;
    var d = new Date(year, month, 1);
    try {
      return new Intl.DateTimeFormat(localeTag(), { month: 'long', year: 'numeric' }).format(d);
    } catch (e) {
      var nama = NAMA_BULAN[month] || '—';
      return nama + ' ' + year;
    }
  };

  function isoToDate(iso) {
    if (!iso) return null;
    var bagian = String(iso).slice(0, 10).split('-');
    if (bagian.length !== 3) return null;
    return new Date(Number(bagian[0]), Number(bagian[1]) - 1, Number(bagian[2]));
  }

  var NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

})(window.MT);
