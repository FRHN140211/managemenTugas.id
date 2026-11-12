/* ============================================================
   meta.js — Dynamic SEO meta tags, Open Graph, and JSON-LD
   for the ManagenTugas.id SPA.
   ============================================================ */

(function () {
  'use strict';

  /* ---------- Base configuration ---------- */
  var SITE_NAME = 'ManagenTugas.id';
  var BASE_URL = 'https://www.manajementugas.id'; /* Ganti dengan domain produksi */
  var DEFAULT_OG_IMAGE = BASE_URL + '/assets/icons/favicon.svg';

  /* ---------- Route metadata ---------- */
  var ROUTE_META = {
    dashboard: {
      title: 'Dashboard — ManagenTugas.id',
      description: 'Ringkasan tugas, laporan, dan pengingat aktif Anda di ManagenTugas.id.',
      ogTitle: 'Dashboard — ManagenTugas.id',
      ogDescription: 'Ringkasan tugas, laporan, dan pengingat aktif Anda di satu ruang kerja.'
    },
    tugas: {
      title: 'Manajemen Tugas — ManagenTugas.id',
      description: 'Kelola daftar tugas, atur deadline, dan pantau progres pekerjaan Anda.',
      ogTitle: 'Manajemen Tugas — ManagenTugas.id',
      ogDescription: 'Kelola daftar tugas, atur deadline, dan pantau progres pekerjaan Anda.'
    },
    laporan: {
      title: 'Manajemen Laporan — ManagenTugas.id',
      description: 'Buat, kelola, dan ekspor laporan tugas dalam satu tempat.',
      ogTitle: 'Manajemen Laporan — ManagenTugas.id',
      ogDescription: 'Buat, kelola, dan ekspor laporan tugas dalam satu tempat.'
    },
    pengingat: {
      title: 'Pengingat — ManagenTugas.id',
      description: 'Jadwalkan dan kelola pengingat agar tidak melewatkan deadline penting.',
      ogTitle: 'Pengingat — ManagenTugas.id',
      ogDescription: 'Jadwalkan dan kelola pengingat agar tidak melewatkan deadline penting.'
    },
    pengguna: {
      title: 'Manajemen Pengguna — ManagenTugas.id',
      description: 'Tambah, edit, dan kelola akun pengguna serta peran di workspace.',
      ogTitle: 'Manajemen Pengguna — ManagenTugas.id',
      ogDescription: 'Tambah, edit, dan kelola akun pengguna serta peran di workspace.'
    },
    aktivitas: {
      title: 'Aktivitas — ManagenTugas.id',
      description: 'Lihat log aktivitas dan riwayat perubahan di workspace Anda.',
      ogTitle: 'Aktivitas — ManagenTugas.id',
      ogDescription: 'Lihat log aktivitas dan riwayat perubahan di workspace Anda.'
    },
    catatan: {
      title: 'Catatan & Handoff — ManagenTugas.id',
      description: 'Tulis catatan, handoff, dan dokumentasi penting untuk tim.',
      ogTitle: 'Catatan & Handoff — ManagenTugas.id',
      ogDescription: 'Tulis catatan, handoff, dan dokumentasi penting untuk tim.'
    },
    profil: {
      title: 'Pengaturan Akun — ManagenTugas.id',
      description: 'Kelola profil, pengaturan akun, dan preferensi Anda.',
      ogTitle: 'Pengaturan Akun — ManagenTugas.id',
      ogDescription: 'Kelola profil, pengaturan akun, dan preferensi Anda.'
    }
  };

  /* ---------- Helpers ---------- */
  function setMeta(attr, name, content) {
    if (!content) return;
    var el = document.querySelector('meta[' + attr + '="' + name + '"]');
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  function setLink(rel, href) {
    if (!href) return;
    var el = document.querySelector('link[rel="' + rel + '"]');
    if (!el) {
      el = document.createElement('link');
      el.setAttribute('rel', rel);
      document.head.appendChild(el);
    }
    el.setAttribute('href', href);
  }

  function setTitle(title) {
    if (title) document.title = title;
  }

  function setJsonLd(data) {
    var existing = document.querySelector('script[type="application/ld+json"]');
    if (existing) existing.remove();
    var script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
  }

  /* ---------- Core update ---------- */
  function getRouteName() {
    var hash = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    return hash[0] || 'dashboard';
  }

  function update() {
    var nama = getRouteName();
    var meta = ROUTE_META[nama] || ROUTE_META.dashboard;
    var url = BASE_URL + '/index.html' + (location.hash ? location.hash : '#/dashboard');

    setTitle(meta.title);
    setMeta('name', 'description', meta.description);
    setMeta('property', 'og:title', meta.ogTitle || meta.title);
    setMeta('property', 'og:description', meta.ogDescription || meta.description);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:image', DEFAULT_OG_IMAGE);
    setMeta('property', 'og:site_name', SITE_NAME);
    setLink('canonical', url);

    /* JSON-LD WebApplication */
    setJsonLd({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: SITE_NAME,
      url: BASE_URL + '/index.html',
      description: 'Aplikasi ManagenTugas.id untuk mengelola tugas, laporan, dan pengingat.',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      browserRequirements: 'Requires JavaScript enabled'
    });
  }

  /* ---------- Event listeners ---------- */
  window.addEventListener('hashchange', update);
  window.addEventListener('DOMContentLoaded', update);

  /* Expose for manual refresh if needed */
  window.MT = window.MT || {};
  MT.updateMeta = update;
})();
