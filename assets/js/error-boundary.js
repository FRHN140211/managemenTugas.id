/* ============================================================
   error-boundary.js — Penangan galat global untuk view rendering.
   Menangkap error tak terduga, menampilkan fallback UI, dan
   menyediakan toast dengan aksi retry.
   ============================================================ */

window.MT = window.MT || {};

(function (MT) {
  'use strict';

  MT.errorBoundary = {
    capture: function capture(error) {
      var pesan = (error && error.pesan) || 'Terjadi kesalahan tak terduga.';
      console.error('Error boundary:', error);

      var elContent = document.getElementById('konten');
      if (elContent) {
        elContent.removeAttribute('aria-busy');
        elContent.innerHTML = MT.comp.stateGalat({
          judul: 'Halaman gagal dimuat',
          pesan: pesan,
          aksiCobaLagi: 'app.muatUlang',
          kode: (error && error.code) || 'ERR-UNKNOWN'
        });
      }

      if (typeof MT.toastErrorWithRetry === 'function') {
        MT.toastErrorWithRetry('Halaman gagal dimuat', pesan, function () {
          MT.renderRute();
        });
      } else {
        MT.toast('error', 'Halaman gagal dimuat', pesan);
      }
    }
  };

  window.addEventListener('error', function (event) {
    if (event.target && event.target.tagName === 'SCRIPT') {
      MT.toast('error', 'Skrip gagal dimuat', 'Periksa konsol untuk detail.');
    }
  });

  window.addEventListener('unhandledrejection', function (event) {
    var error = event.reason;
    if (error && error.status === 401) {
      if (MT.sesiBerakhir) MT.sesiBerakhir();
      else {
        MT.store.bersihkanSesi();
        MT.tampilkanAuth();
      }
      MT.toast('info', 'Sesi berakhir', 'Silakan masuk kembali untuk melanjutkan.');
      event.preventDefault();
      return;
    }
    MT.errorBoundary.capture(error);
    event.preventDefault();
  });

  MT.renderRuteSafe = function () {
    try {
      return MT.renderRute();
    } catch (err) {
      MT.errorBoundary.capture(err);
    }
  };

})(window.MT);
