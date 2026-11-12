/* ============================================================
   modules/api-client.js — HTTP client with auth headers and request dedup.
   Emits: request:start, request:success, request:error
   ============================================================ */

(function (MT) {
  'use strict';

  if (!MT.EventEmitter) {
    console.warn('MT.EventEmitter belum dimuat. Muat emitter.js sebelum api-client.js.');
    return;
  }

  function ApiClient(deps) {
    MT.EventEmitter.call(this);
    this.session = deps && deps.session;
    this.pendingRequests = new Map();
  }
  ApiClient.prototype = Object.create(MT.EventEmitter.prototype);
  ApiClient.prototype.constructor = ApiClient;

  function requestKey(path, opsi) {
    var method = (opsi && opsi.method) || 'GET';
    var body = opsi && opsi.body ? JSON.stringify(opsi.body) : '';
    return method + ' ' + path + (body ? ' ' + body : '');
  }

  function getToken() {
    if (MT._modules && MT._modules.session && MT._modules.session.getToken) {
      return MT._modules.session.getToken();
    }
    if (MT.neonAuthClient) {
      return MT.neonAuthClient.token().then(function (hasil) {
        if (hasil.error) {
          var err = new Error(hasil.error.message || 'Token tidak dapat diperiksa.');
          err.status = hasil.error.status;
          err.code = hasil.error.code;
          err.pesan = err.message;
          throw err;
        }
        return hasil.data && hasil.data.token || null;
      });
    }
    return Promise.resolve(null);
  }

  ApiClient.prototype.request = function (path, opsi) {
    var key = requestKey(path, opsi);
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }

    var self = this;
    var promise = (function () {
      var konfigurasi = Object.assign({ credentials: 'same-origin' }, opsi || {});
      konfigurasi.headers = Object.assign({}, konfigurasi.headers || {});
      if (konfigurasi.body && typeof konfigurasi.body !== 'string') {
        konfigurasi.headers['Content-Type'] = 'application/json';
        konfigurasi.body = JSON.stringify(konfigurasi.body);
      }

      return getToken().then(function (token) {
        if (token) konfigurasi.headers.Authorization = 'Bearer ' + token;
        return fetch(path, konfigurasi).then(function (respons) {
          return respons.json().catch(function () { return {}; }).then(function (hasil) {
            if (!respons.ok || hasil.ok === false) {
              var rincian = hasil.error || {};
              var err = new Error(rincian.message || 'Permintaan belum dapat diproses.');
              err.status = respons.status;
              err.code = rincian.code;
              err.pesan = rincian.message || 'Permintaan belum dapat diproses.';
              err.fields = rincian.fields || null;
              err.field = err.fields ? Object.keys(err.fields)[0] : null;
              if (err.field) err.pesanField = err.fields[err.field];
              throw err;
            }
            return hasil.data;
          });
        });
      }).catch(function (err) {
        if (err && err.status) throw err;
        var gagal = new Error('Layanan tidak dapat dihubungi. Periksa koneksi lalu coba lagi.');
        gagal.pesan = gagal.message;
        throw gagal;
      });
    })();

    this.pendingRequests.set(key, promise);
    this.emit('request:start', { path: path, method: (opsi && opsi.method) || 'GET' });

    promise.then(
      function (result) {
        self.pendingRequests.delete(key);
        self.emit('request:success', { path: path, result: result });
      },
      function (err) {
        self.pendingRequests.delete(key);
        self.emit('request:error', { path: path, error: err });
      }
    );

    return promise;
  };

  ApiClient.prototype.get = function (path) { return this.request(path); };
  ApiClient.prototype.post = function (path, body) { return this.request(path, { method: 'POST', body: body }); };
  ApiClient.prototype.patch = function (path, body) { return this.request(path, { method: 'PATCH', body: body }); };
  ApiClient.prototype.delete = function (path) { return this.request(path, { method: 'DELETE' }); };

  MT.ApiClient = ApiClient;
})(window.MT);
