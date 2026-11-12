/* ============================================================
   views-tasks.js — Modul Manajemen Tugas.
   Field wajib: Nama Task, Deskripsi Task, Deadline Task, Status Task.
   Status contoh (provisional): Belum Dimulai, Sedang Dikerjakan, Selesai.
   ============================================================ */

window.MT = window.MT || {};

(function (MT) {
  'use strict';

  function detailEkstra() {
    return '<div class="panel-head"><h3>' + MT.t('tasks.open_decisions_title') + '</h3></div>' +
      '<div class="panel-pad">' +
        '<div class="note-list">' +
          '<div class="note-item"><div class="note-item-head"><span class="tag-terbuka">' + MT.t('common.open') + '</span>' +
            '<strong>' + MT.t('tasks.deadline_overdue_title') + '</strong></div>' +
            '<p>' + MT.t('tasks.deadline_overdue_desc') + '</p></div>' +
          '<div class="note-item"><div class="note-item-head"><span class="tag-terbuka">' + MT.t('common.open') + '</span>' +
            '<strong>' + MT.t('tasks.official_status_list_title') + '</strong></div>' +
            '<p>' + MT.t('tasks.official_status_list_desc') + '</p></div>' +
          '<div class="note-item"><div class="note-item-head"><span class="tag-terbuka">' + MT.t('common.open') + '</span>' +
            '<strong>' + MT.t('tasks.data_visibility_title') + '</strong></div>' +
            '<p>' + MT.t('tasks.data_visibility_desc') + '</p></div>' +
        '</div>' +
      '</div>';
  }

  MT.buatModul({
    koleksi: 'tugas',
    rute: 'tugas',
    ikon: 'tasks',
    /* KUNCI terjemahan, bukan hasil MT.t(): file ini dieksekusi saat dimuat,
       sebelum i18n.init() selesai. MT.buatModul() menerjemahkan saat render. */
    labelEntri: 'tasks.label_entry',
    labelKata: 'tasks.label_word',
    judulHalaman: 'tasks.page_title',
    deskripsi: 'tasks.page_desc',
    placeholderCari: 'tasks.placeholder_search',
    kosongJudul: 'tasks.empty_title',
    kosongPesan: 'tasks.empty_desc',
    fieldWajib: 'tasks.required_fields',
    keputusanTerbuka: 'tasks.open_decisions_short',
    detailEkstra: detailEkstra
  });
})(window.MT);
