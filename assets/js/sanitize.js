/* ============================================================
   sanitize.js — Canonical HTML escaping and input sanitization.
   Load before ui.js / components.js / views-*.js so MT.esc
   and MT.sanitize are available everywhere.
   ============================================================ */

window.MT = window.MT || {};

(function (MT) {
  'use strict';

  if (MT.esc) {
    // Already defined (e.g., by a previous script). Preserve it.
    MT.sanitize = MT.sanitize || {};
    MT.sanitize.escapeHtml = MT.esc;
    return;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\s/g, '&#32;');
  }

  function stripTags(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/<[^>]*>/g, '');
  }

  function sanitizeUrl(url) {
    if (typeof url !== 'string') return '';
    var trimmed = url.trim();
    if (!trimmed) return '';
    var lower = trimmed.toLowerCase();
    if (lower === '#' || lower === 'javascript:;' || lower === 'javascript::' || lower === 'javascript:') {
      return '#';
    }
    if (lower.indexOf('javascript:') === 0) return '#';
    if (lower.indexOf('data:') === 0) return '#';
    return trimmed;
  }

  MT.esc = escapeHtml;
  MT.sanitize = {
    escapeHtml: escapeHtml,
    escapeAttr: escapeAttr,
    stripTags: stripTags,
    sanitizeUrl: sanitizeUrl
  };
})(window.MT);
