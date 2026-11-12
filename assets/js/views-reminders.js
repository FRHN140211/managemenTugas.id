/* ============================================================
   views-reminders.js — Modul Reminder.
   Reminder dikelola sebagai DATA (CRUD). Prototipe ini tidak
   menjalankan pemicu otomatis, pengulangan, atau pengiriman
   notifikasi karena keputusan tersebut belum ditetapkan.
   ============================================================ */

window.MT = window.MT || {};

(function (MT) {
  'use strict';

  function detailEkstra() {
    return '<div class="panel-head"><h3>' + MT.t('reminders.open_decisions_title') + '</h3></div>' +
      '<div class="panel-pad"><div class="note-list">' +
        '<div class="note-item"><div class="note-item-head"><span class="tag-terbuka">' + MT.t('common.open') + '</span>' +
          '<strong>' + MT.t('reminders.trigger_repeat_title') + '</strong></div><p>' + MT.t('reminders.trigger_repeat_desc') + '</p></div>' +
        '<div class="note-item"><div class="note-item-head"><span class="tag-terbuka">' + MT.t('common.open') + '</span>' +
          '<strong>' + MT.t('reminders.timezone_title') + '</strong></div><p>' + MT.t('reminders.timezone_desc') + '</p></div>' +
        '<div class="note-item"><div class="note-item-head"><span class="tag-terbuka">' + MT.t('common.open') + '</span>' +
          '<strong>' + MT.t('reminders.task_link_title') + '</strong></div><p>' + MT.t('reminders.task_link_desc') + '</p></div>' +
        '<div class="note-item"><div class="note-item-head"><span class="tag-terbuka">' + MT.t('common.open') + '</span>' +
          '<strong>' + MT.t('reminders.status_meaning_title') + '</strong></div><p>' + MT.t('reminders.status_meaning_desc') + '</p></div>' +
        '<div class="note-item"><div class="note-item-head"><span class="tag-terbuka">' + MT.t('common.open') + '</span>' +
          '<strong>' + MT.t('reminders.delivery_title') + '</strong></div><p>' + MT.t('reminders.delivery_desc') + '</p></div>' +
      '</div></div>';
  }

  MT.buatModul({
    koleksi: 'pengingat',
    rute: 'pengingat',
    ikon: 'reminder',
    labelEntri: 'reminders.label_entry',
    labelKata: 'reminders.label_word',
    judulHalaman: 'reminders.page_title',
    deskripsi: 'reminders.page_desc',
    placeholderCari: 'reminders.placeholder_search',
    kosongJudul: 'reminders.empty_module_title',
    kosongPesan: 'reminders.empty_module_desc',
    fieldWajib: 'reminders.required_fields',
    keputusanTerbuka: 'reminders.open_decisions_short',
    detailEkstra: detailEkstra
  });
})(window.MT);
