/* ============================================================
   empty-states.js — Konsisten state kosong untuk setiap modul.
   ============================================================ */

window.MT = window.MT || {};

(function (MT) {
  'use strict';

  MT.emptyStates = {
    tasks: function (opsi) {
      return MT.comp.stateKosong(Object.assign({
        ikon: 'tasks',
        judul: 'Belum ada tugas tercatat',
        pesan: 'Mulai dengan mencatat tugas pertama. Isi nama, deskripsi, deadline, dan status agar progres dapat dilacak.',
        aksi: '<div class="state-actions"><button type="button" class="btn btn-primary" data-action="tugas.tambah">' +
          MT.icon('plus') + 'Tambah tugas pertama</button></div>'
      }, opsi || {}));
    },

    reports: function (opsi) {
      return MT.comp.stateKosong(Object.assign({
        ikon: 'report',
        judul: 'Belum ada laporan tercatat',
        pesan: 'Tambahkan laporan pertama dengan mengisi nama, deskripsi, deadline, dan status penyusunannya.',
        aksi: '<div class="state-actions"><button type="button" class="btn btn-primary" data-action="laporan.tambah">' +
          MT.icon('plus') + 'Tambah laporan pertama</button></div>'
      }, opsi || {}));
    },

    reminders: function (opsi) {
      return MT.comp.stateKosong(Object.assign({
        ikon: 'reminder',
        judul: 'Belum ada reminder terdaftar',
        pesan: 'Tambahkan reminder pertama dengan mengisi nama, deskripsi, deadline, dan statusnya.',
        aksi: '<div class="state-actions"><button type="button" class="btn btn-primary" data-action="pengingat.tambah">' +
          MT.icon('plus') + 'Tambah reminder pertama</button></div>'
      }, opsi || {}));
    },

    activity: function (opsi) {
      return MT.comp.stateKosong(Object.assign({
        ikon: 'book',
        judul: 'Belum ada aktivitas',
        pesan: 'Setiap perubahan data akan tercatat di sini.',
        aksi: ''
      }, opsi || {}));
    }
  };

})(window.MT);
