/* ============================================================
   store.js — State aplikasi dan adapter API same-origin.
   ============================================================ */

window.MT = window.MT || {};

(function (MT) {
  'use strict';

  /* Registri bersama yang diisi oleh berkas view (dimuat setelah berkas ini).
     Wajib disiapkan di sini karena berkas view memakainya saat dimuat. */
  MT.aksi = MT.aksi || {};
  MT.modulHandler = MT.modulHandler || {};
  MT.rute = MT.rute || {};
  MT.penanganForm = MT.penanganForm || {};

  var KUNCI_KOLEKSI = ['pengguna', 'tugas', 'laporan', 'pengingat'];

  var LABEL_KOLEKSI = {
    pengguna: 'user',
    tugas: 'tugas',
    laporan: 'laporan',
    pengingat: 'pengingat'
  };

  var JUDUL_KOLEKSI = {
    pengguna: 'Manajemen Pengguna',
    tugas: 'Manajemen Tugas',
    laporan: 'Manajemen Laporan',
    pengingat: 'Pengingat'
  };
  var API_KOLEKSI = {
    tugas: 'tasks',
    laporan: 'reports',
    pengingat: 'reminders'
  };

  function endpointKoleksi(koleksi) {
    return koleksi === 'pengguna' ? 'users' : (API_KOLEKSI[koleksi] || koleksi);
  }

  function salin(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function neonAuthClient() {
    if (!MT.neonAuthClient) {
      var error = new Error('Klien Neon Auth belum dimuat.');
      error.pesan = error.message;
      throw error;
    }
    return MT.neonAuthClient;
  }

  function tokenNeonAuth() {
    return neonAuthClient().token().then(function (hasil) {
      if (hasil.error) {
        var error = new Error(hasil.error.message || 'Sesi Neon Auth tidak dapat diperiksa.');
        error.status = hasil.error.status;
        error.code = hasil.error.code;
        error.pesan = error.message;
        throw error;
      }
      return hasil.data && hasil.data.token || null;
    });
  }

  var pendingRequests = new Map();
  var responseCache = new Map();

  function getCachedResponse(key) {
    var entry = responseCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      responseCache.delete(key);
      return null;
    }
    return entry.data;
  }

  function setCachedResponse(key, data, ttlMs) {
    if (ttlMs <= 0) return;
    responseCache.set(key, {
      data: data,
      expiresAt: Date.now() + ttlMs
    });
  }

  function invalidateCache() {
    responseCache.clear();
  }

  function requestKey(path, opsi) {
    var method = (opsi && opsi.method) || 'GET';
    var body = opsi && opsi.body ? JSON.stringify(opsi.body) : '';
    return method + ' ' + path + (body ? ' ' + body : '');
  }

  var MAKS_PERCOBAAN = 3;
  var JEDA_DASAR = 1000;

  function apakahPerluCoba(err) {
    if (!err) return false;
    if (err.status && err.status >= 500) return true;
    if (err.code && ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'].includes(err.code)) return true;
    return false;
  }

  function denganPercobaanKembali(fn, percobaan) {
    percobaan = percobaan || 0;
    return fn().catch(function (err) {
      if (!apakahPerluCoba(err) || percobaan >= MAKS_PERCOBAAN - 1) {
        throw err;
      }
      var jeda = JEDA_DASAR * Math.pow(2, percobaan);
      return MT.jeda(jeda).then(function () {
        return denganPercobaanKembali(fn, percobaan + 1);
      });
    });
  }

  function permintaanAPI(path, opsi) {
    var key = requestKey(path, opsi);
    if (pendingRequests.has(key)) {
      return pendingRequests.get(key);
    }

    var isGet = (!opsi || !opsi.method || opsi.method === 'GET') && !(opsi && opsi.noCache);
    var cached = isGet ? getCachedResponse(key) : null;
    if (cached) {
      return Promise.resolve(cached);
    }

    // app.js normally owns MT.perf; tolerate it being absent so store.js works
    // standalone (tests, partial embeds) instead of throwing on the first request.
    var requestId = MT.perf ? ++MT.perf.requestCounter : 1;
    var requestMark = 'api-start-' + requestId + '-' + Date.now();
    try { performance.mark(requestMark); } catch (e) { /* noop */ }

    function buatPermintaan() {
      var konfigurasi = Object.assign({ credentials: 'same-origin' }, opsi || {});
      delete konfigurasi.noCache;
      konfigurasi.headers = Object.assign({}, konfigurasi.headers || {});
      if (konfigurasi.body && typeof konfigurasi.body !== 'string') {
        konfigurasi.headers['Content-Type'] = 'application/json';
        konfigurasi.body = JSON.stringify(konfigurasi.body);
      }

      return tokenNeonAuth().then(function (token) {
        if (token) konfigurasi.headers.Authorization = 'Bearer ' + token;
        return fetch(path, konfigurasi).then(function (respons) {
          var responseMark = 'api-end-' + requestId + '-' + Date.now();
          try {
            performance.mark(responseMark);
            performance.measure('api-' + requestId, requestMark, responseMark);
          } catch (e) { /* noop */ }
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
    }

    var promise = denganPercobaanKembali(buatPermintaan);
    var tracked = promise.then(
      function (result) {
        pendingRequests.delete(key);
        if (isGet && result) {
          setCachedResponse(key, result, 60000);
        }
        return result;
      },
      function (err) {
        pendingRequests.delete(key);
        throw err;
      }
    );
    // Return the original promise, not the derived one: attaching `.then` to
    // `promise` re-throws its rejection and produces an unhandled rejection the
    // moment the caller awaits (or ignores) `promise` directly.
    pendingRequests.set(key, promise);
    return tracked;
  }

  function logAuthError(action, error) {
    var pesan = error && error.message ? String(error.message) : '';
    if (pesan.length > 120) pesan = pesan.slice(0, 120) + '…';
    window.MT.debugAuth = {
      waktu: new Date().toISOString(),
      tindakan: action,
      status: error && error.status ? error.status : null,
      kode: error && error.code ? String(error.code).toUpperCase() : null,
      pesan: pesan
    };
    console.warn('[auth]', action, error && error.code ? String(error.code).toUpperCase() : '', pesan);
  }

  /* SDK @neondatabase/auth 0.7.0-beta MELEMPAR AuthApiError/AuthError untuk setiap
     respons non-2xx (customFetchImpl) dengan kode yang sudah dinormalisasi
     (huruf kecil, mis. user_already_exists, weak_password). Fungsi ini memetakan
     galat SDK, galat proxy, dan galat jaringan ke satu kosakata kode aplikasi. */
  var KODE_SDK = {
    USER_ALREADY_EXISTS: 'EMAIL_ALREADY_REGISTERED',
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'EMAIL_ALREADY_REGISTERED',
    EMAIL_EXISTS: 'EMAIL_ALREADY_REGISTERED',
    EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_REGISTERED',
    EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
    WEAK_PASSWORD: 'INVALID_PASSWORD',
    PASSWORD_TOO_SHORT: 'INVALID_PASSWORD',
    PASSWORD_TOO_LONG: 'INVALID_PASSWORD',
    INVALID_PASSWORD: 'INVALID_PASSWORD',
    EMAIL_ADDRESS_INVALID: 'INVALID_EMAIL',
    INVALID_EMAIL: 'INVALID_EMAIL',
    INVALID_NAME: 'INVALID_NAME',
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    INVALID_EMAIL_OR_PASSWORD: 'INVALID_CREDENTIALS',
    EMAIL_NOT_CONFIRMED: 'EMAIL_NOT_VERIFIED',
    EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
    OVER_REQUEST_RATE_LIMIT: 'RATE_LIMIT_EXCEEDED',
    OVER_EMAIL_SEND_RATE_LIMIT: 'RATE_LIMIT_EXCEEDED',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    TOO_MANY_ATTEMPTS: 'TOO_MANY_ATTEMPTS',
    INVALID_OTP: 'INVALID_OTP',
    OTP_EXPIRED: 'OTP_EXPIRED',
    FAILED_TO_SEND_EMAIL: 'FAILED_TO_SEND_EMAIL',
    AUTH_NOT_CONFIGURED: 'AUTH_NOT_CONFIGURED',
    AUTH_PROVIDER_UNAVAILABLE: 'AUTH_PROVIDER_UNAVAILABLE',
    INVALID_ORIGIN: 'HTTP_403',
    INVALID_CALLBACK_URL: 'HTTP_403',
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT',
    INVALID_RESPONSE: 'INVALID_RESPONSE',
    SDK_NOT_READY: 'SDK_NOT_READY'
  };

  function normalisasiGalatAuth(err) {
    err = err || {};
    var status = Number(err.status) || 0;
    var kodeAsli = String(err.code || '').toUpperCase();
    var pesan = String(err.message || '');
    var kode = KODE_SDK[kodeAsli] || '';
    if (!kode) {
      // Hanya galat fetch yang dianggap jaringan; TypeError lain adalah bug kode.
      if (/failed to fetch|networkerror|network request failed|load failed/i.test(pesan)) kode = 'NETWORK_ERROR';
      else if (err.name === 'TimeoutError' || err.name === 'AbortError') kode = 'TIMEOUT';
      else if (/send (verification )?email|failed to send/i.test(pesan)) kode = 'FAILED_TO_SEND_EMAIL';
      else if (/already exists|already registered/i.test(pesan)) kode = 'EMAIL_ALREADY_REGISTERED';
      else if (status === 409) kode = 'EMAIL_ALREADY_REGISTERED';
      else if (status === 429) kode = 'RATE_LIMIT_EXCEEDED';
      else if (status === 401) kode = 'INVALID_CREDENTIALS';
      else if (status === 403) kode = 'HTTP_403';
      else if (status === 502 || status === 503 || status === 504) kode = 'AUTH_PROVIDER_UNAVAILABLE';
      else if (status >= 500) kode = 'HTTP_5xx';
      else if (kodeAsli === 'VALIDATION_FAILED' || status === 400 || status === 422) {
        kode = /\bname\b/i.test(pesan) ? 'INVALID_NAME' : 'VALIDATION_FAILED';
      } else kode = 'UNKNOWN';
    }
    return { kode: kode, status: status, kodeAsli: kodeAsli || null };
  }

  function galatAuth(action, err) {
    var n = normalisasiGalatAuth(err);
    var error = new Error(err && err.message ? String(err.message) : n.kode);
    error.code = n.kode;
    error.status = n.status;
    error.kodeAsli = n.kodeAsli;
    error.retryAfter = err && err.retryAfter ? err.retryAfter : 0;
    error.pesan = error.message;
    logAuthError(action, error);
    return error;
  }

  var BATAS_WAKTU_REGISTRASI = 30000;
  function denganBatasWaktu(promise, ms) {
    // store.js juga dievaluasi tanpa timer global (vm test); jangan gagal di sana.
    if (typeof setTimeout !== 'function') return Promise.resolve(promise);
    // Batas waktu dapat diperpendek oleh tes otomatis lewat MT.konfigurasiAuth.
    var konf = MT.konfigurasiAuth;
    if (konf && Number(konf.batasWaktuMs) > 0) ms = Number(konf.batasWaktuMs);
    var timer;
    var batas = new Promise(function (_, reject) {
      timer = setTimeout(function () {
        var e = new Error('Permintaan melebihi batas waktu.');
        e.name = 'TimeoutError';
        e.code = 'TIMEOUT';
        reject(e);
      }, ms);
    });
    return Promise.race([promise, batas]).then(function (v) { clearTimeout(timer); return v; },
      function (e) { clearTimeout(timer); throw e; });
  }

  /* Membaca respons fetch Better Auth / proxy secara aman. Mendukung bentuk
     { code, message } (Better Auth) dan { ok:false, error:{ code, message } } (proxy). */
  function bacaResponsAuth(resp) {
    return resp.text().then(function (teks) {
      var body = null;
      if (teks) {
        try { body = JSON.parse(teks); } catch (e) { body = undefined; }
      }
      var retryAfter = 0;
      var ra = resp.headers && resp.headers.get ? resp.headers.get('retry-after') : null;
      if (ra != null && !isNaN(Number(ra))) retryAfter = Number(ra);
      var rincian = body && (body.error && typeof body.error === 'object' ? body.error : body) || {};
      if (!resp.ok || (body && body.ok === false)) {
        var err = new Error(rincian.message || ('HTTP ' + resp.status));
        err.status = resp.status;
        err.code = rincian.code || '';
        err.retryAfter = retryAfter || Number(rincian.retryAfter) || 0;
        throw err;
      }
      if (body === undefined) {
        var e2 = new Error('Respons server tidak dapat dibaca.');
        e2.status = resp.status;
        e2.code = 'INVALID_RESPONSE';
        throw e2;
      }
      return body || {};
    });
  }

  function profilAplikasi(nama) {
    return permintaanAPI('/api/auth/me').catch(function (err) {
      if (!err || err.code !== 'ACCOUNT_NOT_PROVISIONED') throw err;
      return permintaanAPI('/api/auth/register', {
        method: 'POST',
        body: { nama: nama }
      }).then(function () {
        return permintaanAPI('/api/auth/me');
      });
    }).then(function (sesi) {
      if (!sesi.user) {
        var error = new Error('Sesi belum berhasil dibuat. Silakan masuk kembali.');
        error.code = 'AUTH_SESSION_MISSING';
        error.pesan = error.message;
        throw error;
      }
      setPenggunaAktif(sesi.user);
      store.emit();
      return sesi.user;
    });
  }

  var state = {
    penggunaAktif: null,
    pengguna: [],
    tugas: [],
    laporan: [],
    pengingat: [],
    aktivitas: [],
    completionTrend: [],
    dashboardSummary: null,
    profileSummary: null,
    priorityTasks: [],
    upcomingItems: [],
    pemilikNama: {},
    itemCache: { pengguna: {}, tugas: {}, laporan: {}, pengingat: {} },
    pagination: {}
  };
  var pendengar = [];
  var prefs = { jedaMuat: 0, jedaSimpan: 0, errorMuat: false, errorSimpan: false };
  var nomorPermintaanHalaman = {};

  function setPenggunaAktif(pengguna) {
    state.penggunaAktif = pengguna || null;
    state.pengguna = pengguna ? [pengguna] : [];
    if (pengguna) state.pemilikNama[pengguna.id] = pengguna.nama;
  }

  var store = {
    KUNCI_KOLEKSI: KUNCI_KOLEKSI,
    LABEL_KOLEKSI: LABEL_KOLEKSI,
    JUDUL_KOLEKSI: JUDUL_KOLEKSI,

    get state() { return state; },
    get prefs() { return prefs; },
    get devMode() { return false; },

    langganan: function (fn) { pendengar.push(fn); },
    emit: function () { pendengar.forEach(function (fn) { fn(); }); },

    /* ---------- Autentikasi Neon Auth ---------- */

    masuk: function (email, kataSandi) {
      // Tahap 1: SDK. SDK melempar galat untuk respons non-2xx; cabang hasil.error
      // dipertahankan untuk adapter yang mengembalikan { error } tanpa melempar.
      return Promise.resolve().then(function () {
        return neonAuthClient().signIn.email({ email: email, password: kataSandi });
      }).then(function (hasil) {
        if (hasil && hasil.error) throw hasil.error;
        return hasil;
      }).then(function (hasil) {
        // Tahap 2: profil aplikasi. Galatnya dibiarkan apa adanya (kode server).
        var nama = hasil && hasil.data && hasil.data.user && hasil.data.user.name;
        return profilAplikasi(nama).then(function (pengguna) {
          return { ok: true, pengguna: pengguna };
        });
      }, function (err) {
        var e = galatAuth('masuk', err);
        if (e.code === 'INVALID_CREDENTIALS') return { ok: false, alasan: 'kredensial' };
        throw e;
      });
    },

    /* Hasil registrasi (satu-satunya kontrak yang dibaca views-auth.js):
       { ok:true, pengguna }                                  akun terverifikasi + profil siap
       { ok:false, alasan:'verifikasi-email', email, otp:'terkirim' }   akun dibuat, OTP diterima layanan
       { ok:false, alasan:'verifikasi-email', email, otp:'gagal', kode } akun dibuat, permintaan OTP gagal
       { ok:false, alasan:'tidak-pasti', kode }   request terkirim tetapi hasilnya tidak dapat dipastikan
       { ok:false, alasan:<penolakan>, kode }     registrasi ditolak (email-terdaftar, kata-sandi, email,
                                                  nama, data-tidak-valid, rate-limit, auth-config,
                                                  auth-unavailable, jaringan, akses-ditolak, error)
       Registrasi TIDAK pernah dikirim ulang otomatis. */
    registrasi: function (nama, email, kataSandi) {
      var tahap = 'sdk';
      return Promise.resolve().then(function () {
        var p = neonAuthClient().signUp.email({ email: email, password: kataSandi, name: nama });
        tahap = 'request';
        return denganBatasWaktu(p, BATAS_WAKTU_REGISTRASI);
      }).then(function (hasil) {
        if (hasil && hasil.error) throw hasil.error;
        var user = hasil && hasil.data && typeof hasil.data === 'object' ? hasil.data.user : null;
        if (!user || typeof user !== 'object' || !user.email) {
          // HTTP 2xx tetapi body kosong/bukan JSON/tanpa user: akun mungkin sudah dibuat.
          logAuthError('registrasi', { status: 200, code: 'INVALID_RESPONSE', message: 'Respons pendaftaran tidak dapat dibaca.' });
          return { ok: false, alasan: 'tidak-pasti', kode: 'INVALID_RESPONSE' };
        }
        if (!user.emailVerified) {
          return store.kirimUlangOtp(email).then(function () {
            return { ok: false, alasan: 'verifikasi-email', email: email, otp: 'terkirim' };
          }, function (errOtp) {
            return { ok: false, alasan: 'verifikasi-email', email: email, otp: 'gagal', kode: errOtp && errOtp.code || 'UNKNOWN', retryAfter: errOtp && errOtp.retryAfter || 0 };
          });
        }
        return profilAplikasi(nama).then(function (pengguna) {
          return { ok: true, pengguna: pengguna };
        });
      }, function (err) {
        if (tahap === 'sdk' && (!err || !err.status)) {
          var eSdk = galatAuth('registrasi', { code: 'SDK_NOT_READY', message: err && err.message });
          return { ok: false, alasan: 'error', kode: eSdk.code };
        }
        var e = galatAuth('registrasi', err);
        var peta = {
          EMAIL_ALREADY_REGISTERED: 'email-terdaftar',
          INVALID_PASSWORD: 'kata-sandi',
          INVALID_EMAIL: 'email',
          INVALID_NAME: 'nama',
          VALIDATION_FAILED: 'data-tidak-valid',
          RATE_LIMIT_EXCEEDED: 'rate-limit',
          TOO_MANY_ATTEMPTS: 'rate-limit',
          AUTH_NOT_CONFIGURED: 'auth-config',
          AUTH_PROVIDER_UNAVAILABLE: 'auth-unavailable',
          HTTP_5xx: 'auth-unavailable',
          HTTP_403: 'akses-ditolak',
          NETWORK_ERROR: 'jaringan',
          TIMEOUT: 'tidak-pasti',
          INVALID_RESPONSE: 'tidak-pasti',
          // Better Auth membuat user SEBELUM mengirim email (sign-up.mjs:241-245):
          // kegagalan pengiriman berarti akun mungkin sudah ada.
          FAILED_TO_SEND_EMAIL: 'tidak-pasti'
        };
        return { ok: false, alasan: peta[e.code] || 'error', kode: e.code, retryAfter: e.retryAfter || 0 };
      });
    },

    /* Verifikasi OTP lalu periksa sesi. Hasil:
       { ok:true, pengguna }               sesi tersedia, profil siap
       { ok:false, alasan:'terverifikasi' } email terverifikasi, sesi belum ada -> masuk manual
       throw Error{code}                   OTP salah/kedaluwarsa/rate limit/jaringan */
    verifikasiOtp: function (email, otp) {
      return Promise.resolve().then(function () {
        return denganBatasWaktu(fetch('/api/neon-auth/email-otp/verify-email', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, otp: otp })
        }), BATAS_WAKTU_REGISTRASI);
      }).then(bacaResponsAuth).then(null, function (err) {
        throw galatAuth('verifikasiOtp', err);
      }).then(function () {
        return store.sesi().then(null, function () { return null; });
      }).then(function (pengguna) {
        if (pengguna) return { ok: true, pengguna: pengguna };
        return { ok: false, alasan: 'terverifikasi', email: email };
      });
    },

    kirimUlangVerifikasi: function (email) {
      return fetch('/api/neon-auth/send-verification-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email })
      })
      .then(function (resp) {
        return resp.json()
        .catch(function () {
          var err = new Error('Respons server bukan valid JSON.');
          err.code = 'NETWORK_ERROR';
          err.status = 0;
          throw err;
        })
        .then(function (body) {
          if (body && body.error) {
            var err = new Error(body.error.message || 'Gagal mengirim kode verifikasi.');
            err.status = resp.status;
            err.code = String(resp.status || '').toUpperCase();
            var retryAfter = 0;
            var ra = resp.headers.get('retry-after');
            if (ra != null) {
              retryAfter = Number(ra);
              if (isNaN(retryAfter)) retryAfter = 0;
            }
            err.retryAfter = retryAfter;
            throw err;
          }
          if (!resp.ok) {
            var err2 = new Error('Permintaan ke server gagal.');
            err2.status = resp.status;
            err2.code = String(resp.status || '').toUpperCase();
            var retryAfter = 0;
            var ra = resp.headers.get('retry-after');
            if (ra != null) {
              retryAfter = Number(ra);
              if (isNaN(retryAfter)) retryAfter = 0;
            }
            err2.message = body && body.error ? body.error.message : err2.message;
            err2.retryAfter = retryAfter;
            throw err2;
          }
          return { ok: true };
        });
      })
      .catch(function (err) {
        if (err instanceof TypeError) {
          err.code = 'NETWORK_ERROR';
          err.status = 0;
        }
        logAuthError('kirimUlangVerifikasi', err);
        return Promise.reject(err);
      });
    },

    /* Meminta OTP verifikasi email. Resolve { ok:true } berarti layanan auth
       MENERIMA permintaan, bukan bukti email sudah sampai di kotak masuk. */
    kirimUlangOtp: function (email) {
      return Promise.resolve().then(function () {
        return denganBatasWaktu(fetch('/api/neon-auth/email-otp/send-verification-otp', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, type: 'email-verification' })
        }), BATAS_WAKTU_REGISTRASI);
      }).then(bacaResponsAuth).then(function () {
        return { ok: true };
      }, function (err) {
        throw galatAuth('kirimUlangOtp', err);
      });
    },

    sesi: function () {
      return neonAuthClient().getSession().then(function (hasil) {
        if (hasil.error) {
          var error = new Error(hasil.error.message || 'Sesi Neon Auth tidak dapat diperiksa.');
          error.status = hasil.error.status;
          error.code = (hasil.error.code || '').toUpperCase();
          error.pesan = error.message;
          throw error;
        }
        if (!hasil.data || !hasil.data.session || !hasil.data.user) {
          setPenggunaAktif(null);
          store.emit();
          return null;
        }
        return profilAplikasi(hasil.data.user.name).then(function (pengguna) {
          return pengguna;
        });
      });
    },

    bersihkanSesi: function () {
      setPenggunaAktif(null);
      state.tugas = [];
      state.laporan = [];
      state.pengingat = [];
      state.aktivitas = [];
      state.completionTrend = [];
      state.dashboardSummary = null;
      state.profileSummary = null;
      state.priorityTasks = [];
      state.upcomingItems = [];
      state.pemilikNama = {};
      state.itemCache = { pengguna: {}, tugas: {}, laporan: {}, pengingat: {} };
      state.pagination = {};
      invalidateCache();
      this.emit();
    },

    keluar: function () {
      var self = this;
      return neonAuthClient().signOut().then(function (hasil) {
        if (hasil.error) {
          var error = new Error(hasil.error.message || 'Sesi Neon Auth tidak dapat diakhiri.');
          error.status = hasil.error.status;
          error.code = (hasil.error.code || '').toUpperCase();
          error.pesan = error.message;
          throw error;
        }
        self.bersihkanSesi();
      });
    },

    simpanProfil: function (perubahan) {
      return permintaanAPI('/api/profile', {
        method: 'PATCH',
        body: perubahan
      }).then(function (hasil) {
        if (!hasil || !hasil.user) {
          var error = new Error('Profil akun tidak dapat diperbarui.');
          error.pesan = error.message;
          throw error;
        }
        setPenggunaAktif(hasil.user);
        store.emit();
        return hasil.user;
      });
    },

    /* ---------- Baca data ---------- */

    penggunaAktif: function () { return state.penggunaAktif; },
    role: function () { return state.penggunaAktif ? state.penggunaAktif.role : null; },
    adalahOwner: function () { return this.role() === 'owner'; },

    namaPengguna: function (id) {
      var u = state.pengguna.filter(function (x) { return x.id === id; })[0];
      return u ? u.nama : (state.pemilikNama[id] || 'Pengguna tidak dikenal');
    },

    emailPengguna: function (id) {
      var u = state.pengguna.filter(function (x) { return x.id === id; })[0];
      return u ? u.email : '—';
    },

    penggunaDenganEmail: function (email, kecualiId) {
      var e = String(email || '').trim().toLowerCase();
      return state.pengguna.filter(function (u) {
        return u.email.toLowerCase() === e && u.id !== kecualiId;
      })[0];
    },

    /* Visibilitas data: PROVISIONAL (belum dikonfirmasi).
       Owner melihat seluruh data; User hanya melihat data miliknya. */
    visibilitasAktif: true,

    daftar: function (koleksi) {
      return salin(state[koleksi] || []);
    },

    ambil: function (koleksi, id) {
      var item = (state[koleksi] || []).filter(function (x) { return x.id === id; })[0];
      item = item || (state.itemCache[koleksi] && state.itemCache[koleksi][id]);
      return item ? salin(item) : null;
    },

    bisaUbah: function (koleksi, item) {
      if (!item) return false;
      if (this.adalahOwner()) return true;
      var id = state.penggunaAktif ? state.penggunaAktif.id : null;
      return item.pemilikId === id;
    },

    /* ---------- Muat snapshot data yang sudah difilter oleh server ---------- */
    muat: function () {
      return permintaanAPI('/api/bootstrap').then(function (hasil) {
        state.dashboardSummary = hasil.summary;
        state.profileSummary = hasil.profileCounts;
        state.aktivitas = hasil.activity;
        state.completionTrend = hasil.completionTrend;
        state.priorityTasks = hasil.priorityTasks;
        state.upcomingItems = hasil.upcomingItems;
        hasil.priorityTasks.forEach(function (item) {
          if (item.pemilikId && item.pemilikNama) state.pemilikNama[item.pemilikId] = item.pemilikNama;
        });
        store.emit();
        return hasil;
      });
    },

    muatAktivitas: function () {
      return permintaanAPI('/api/activity').then(function (hasil) {
        state.aktivitas = hasil;
        store.emit();
        return hasil;
      });
    },

    muatRingkasanAktivitas: function (opsi) {
      opsi = opsi || {};
      var parameter = new URLSearchParams();
      parameter.set('rentang', opsi.rentang || '12m');
      if (opsi.tahun) parameter.set('tahun', String(opsi.tahun));
      if (opsi.userId) parameter.set('userId', opsi.userId);
      if (opsi.offset) parameter.set('offset', String(opsi.offset));
      if (opsi.hari) parameter.set('hari', opsi.hari);
      return permintaanAPI('/api/activity/summary?' + parameter.toString(), { noCache: true });
    },

    muatHalaman: function (koleksi, opsi) {
      opsi = opsi || {};
      var parameter = new URLSearchParams();
      parameter.set('page', String(opsi.page || 1));
      parameter.set('pageSize', String(opsi.pageSize || 8));
      parameter.set('sort', opsi.sort || 'created');
      if (opsi.search) parameter.set('q', opsi.search);
      if (opsi.status && opsi.status !== 'Semua status') parameter.set('status', opsi.status);
      if (opsi.role && opsi.role !== 'Semua role') parameter.set('role', opsi.role);
      if (opsi.from) parameter.set('from', opsi.from);
      if (opsi.to) parameter.set('to', opsi.to);
      var url = '/api/' + endpointKoleksi(koleksi) + '?' + parameter.toString();

      var requestId = (nomorPermintaanHalaman[koleksi] || 0) + 1;
      nomorPermintaanHalaman[koleksi] = requestId;
      return permintaanAPI(url).then(function (hasil) {
        if (nomorPermintaanHalaman[koleksi] !== requestId) return null;
        state[koleksi] = hasil.items;
        hasil.items.forEach(function (item) {
          if (koleksi === 'pengguna') state.pemilikNama[item.id] = item.nama;
        });
        state.pagination[koleksi] = hasil.pagination;
        store.emit();
        return hasil;
      });
    },

    ambilHalamanAPI: function (koleksi, opsi) {
      opsi = opsi || {};
      var parameter = new URLSearchParams();
      parameter.set('page', String(opsi.page || 1));
      parameter.set('pageSize', String(opsi.pageSize || 8));
      parameter.set('sort', opsi.sort || 'created');
      if (opsi.search) parameter.set('q', opsi.search);
      if (opsi.status && opsi.status !== 'Semua status') parameter.set('status', opsi.status);
      if (opsi.role && opsi.role !== 'Semua role') parameter.set('role', opsi.role);
      if (opsi.from) parameter.set('from', opsi.from);
      if (opsi.to) parameter.set('to', opsi.to);
      return permintaanAPI('/api/' + endpointKoleksi(koleksi) + '?' + parameter.toString());
    },

    ringkasanLaporan: function (opsi) {
      var parameter = new URLSearchParams();
      parameter.set('mode', opsi.mode);
      if (opsi.mode === 'month') parameter.set('month', opsi.month);
      else {
        parameter.set('from', opsi.from);
        parameter.set('to', opsi.to);
      }
      return permintaanAPI('/api/reports/summary?' + parameter.toString());
    },

    ambilDariServer: function (koleksi, id) {
      var endpoint = '/api/' + endpointKoleksi(koleksi) + '/';
      return permintaanAPI(endpoint + encodeURIComponent(id)).then(function (item) {
        if (item.pemilikId && item.pemilikNama) state.pemilikNama[item.pemilikId] = item.pemilikNama;
        state.itemCache[koleksi][item.id] = item;
        if (koleksi === 'pengguna') state.pemilikNama[item.id] = item.nama;
        if (item.pemilikId && item.pemilikNama) state.pemilikNama[item.pemilikId] = item.pemilikNama;
        return item;
      });
    },

    semuaHalaman: function (koleksi, opsi) {
      opsi = Object.assign({}, opsi || {}, { page: 1 });
      var semua = [];
      function bacaBerikutnya() {
        return store.ambilHalamanAPI(koleksi, opsi).then(function (hasil) {
          semua = semua.concat(hasil.items);
          if (!hasil.pagination.hasNext) return semua;
          opsi.page += 1;
          return bacaBerikutnya();
        });
      }
      return bacaBerikutnya();
    },

    /* ---------- CRUD API ---------- */

    idBaru: function (koleksi) {
      state.urutanId += 1;
      var awalan = { pengguna: 'usr', tugas: 'tsk', laporan: 'rpt', pengingat: 'rmd' }[koleksi] || 'dat';
      return awalan + '-' + String(state.urutanId + 900).padStart(3, '0');
    },

    tambah: function (koleksi, data) {
      var endpoint = '/api/' + endpointKoleksi(koleksi);
      return permintaanAPI(endpoint, { method: 'POST', body: data }).then(function (item) {
        var key = koleksi === 'pengguna' ? 'pengguna' : koleksi;
        state[key].unshift(item);
        state.itemCache[koleksi][item.id] = item;
        invalidateCache();
        store.emit();
        return item;
      });
    },

    ubah: function (koleksi, id, data) {
      var endpoint = '/api/' + endpointKoleksi(koleksi) + '/';
      if (koleksi === 'pengguna') {
        var current = store.ambil(koleksi, id);
        if (current) data = Object.assign({}, data, { expectedUpdatedAt: current.diperbaruiPada });
      }
      return permintaanAPI(endpoint + encodeURIComponent(id), {
        method: 'PATCH',
        body: data
      }).then(function (item) {
        var key = koleksi === 'pengguna' ? 'pengguna' : koleksi;
        state.itemCache[koleksi][id] = item;
        var indeks = state[key].findIndex(function (x) { return x.id === id; });
        if (indeks >= 0) state[key][indeks] = item;
        if (koleksi === 'pengguna' && state.penggunaAktif && state.penggunaAktif.id === id) {
          state.penggunaAktif = item;
        }
        invalidateCache();
        store.emit();
        return item;
      });
    },

    hapus: function (koleksi, id) {
      var endpoint = '/api/' + endpointKoleksi(koleksi) + '/';
      if (koleksi === 'pengguna') {
        var current = store.ambil(koleksi, id);
        if (current) endpoint += encodeURIComponent(id) + '?expectedUpdatedAt=' +
          encodeURIComponent(current.diperbaruiPada);
        else endpoint += encodeURIComponent(id);
      } else {
        endpoint += encodeURIComponent(id);
      }
      return permintaanAPI(endpoint, { method: 'DELETE' }).then(function (hasil) {
        var key = koleksi === 'pengguna' ? 'pengguna' : koleksi;
        state[key] = state[key].filter(function (item) { return item.id !== id; });
        delete state.itemCache[koleksi][id];
        invalidateCache();
        store.emit();
        return hasil;
      });
    },

    /* ---------- Aktivitas ---------- */

    catatAktivitas: function (entri) {
      var namaAktor = state.penggunaAktif ? state.penggunaAktif.nama : 'Pengunjung';
      state.aktivitas.unshift({
        waktu: MT.tanggalSelisih(0),
        aktor: entri.aktor || namaAktor,
        aksi: entri.aksi,
        objek: entri.objek,
        modul: entri.modul
      });
      if (state.aktivitas.length > 40) state.aktivitas.length = 40;
      if (!entri.senyap) this.emit();
    },

    /* ---------- Ringkasan untuk dashboard ---------- */

    ringkasan: function () {
      if (state.dashboardSummary) {
        return {
          tugas: Object.fromEntries(Object.entries(state.dashboardSummary.tasks).map(function (entry) {
            return [entry[0], Number(entry[1])];
          })),
          laporan: Object.fromEntries(Object.entries(state.dashboardSummary.reports).map(function (entry) {
            return [entry[0], Number(entry[1])];
          })),
          pengingat: Object.fromEntries(Object.entries(state.dashboardSummary.reminders).map(function (entry) {
            return [entry[0], Number(entry[1])];
          })),
          pengguna: { total: Number(state.dashboardSummary.users.total) },
          deadlineSegera: state.upcomingItems
        };
      }
      var tugas = this.daftar('tugas');
      var laporan = this.daftar('laporan');
      var pengingat = this.daftar('pengingat');
      var hitung = function (arr, status) {
        return arr.filter(function (x) { return x.status === status; }).length;
      };
      var lewat = tugas.filter(function (t) {
        return t.status !== 'Selesai' && MT.selisihHari(t.deadline) < 0;
      }).length;
      var segera = tugas.filter(function (t) {
        var s = MT.selisihHari(t.deadline);
        return t.status !== 'Selesai' && s !== null && s >= 0 && s <= 3;
      }).length;
      return {
        tugas: {
          total: tugas.length,
          belum: hitung(tugas, 'Belum Dimulai'),
          proses: hitung(tugas, 'Sedang Dikerjakan'),
          selesai: hitung(tugas, 'Selesai'),
          lewat: lewat,
          segera: segera
        },
        laporan: {
          total: laporan.length,
          belum: hitung(laporan, 'Belum Dimulai'),
          proses: hitung(laporan, 'Sedang Dikerjakan'),
          selesai: hitung(laporan, 'Selesai')
        },
        pengingat: {
          total: pengingat.length,
          aktif: hitung(pengingat, 'Aktif'),
          nonaktif: hitung(pengingat, 'Nonaktif'),
          selesai: hitung(pengingat, 'Selesai')
        },
        pengguna: { total: state.pengguna.length }
      };
    },

    /* Daftar lintas modul dengan deadline terdekat */
    deadlineTerdekat: function (batas) {
      if (state.upcomingItems.length) return salin(state.upcomingItems.slice(0, batas || 6));
      var hasil = [];
      ['tugas', 'laporan', 'pengingat'].forEach(function (koleksi) {
        store.daftar(koleksi).forEach(function (item) {
          if (item.status === 'Selesai') return;
          var selisih = MT.selisihHari(item.deadline);
          if (selisih === null) return;
          hasil.push({
            koleksi: koleksi,
            id: item.id,
            nama: item.nama,
            deadline: item.deadline,
            status: item.status,
            pemilik: store.namaPengguna(item.pemilikId),
            pemilikId: item.pemilikId,
            selisih: selisih
          });
        });
      });
      hasil.sort(function (a, b) { return a.selisih - b.selisih; });
      return hasil.slice(0, batas || 6);
    },

    /* ---------- Preferensi alat uji (dev mode dinonaktifkan) ---------- */

    setPrefs: function (perubahan) {
      Object.assign(prefs, perubahan);
      this.emit();
    },

    resetDataContoh: function () {
      state.penggunaAktif = null;
      state.pengguna = [];
      state.tugas = [];
      state.laporan = [];
      state.pengingat = [];
      state.aktivitas = [];
      state.completionTrend = [];
      state.dashboardSummary = null;
      state.profileSummary = null;
      state.priorityTasks = [];
      state.upcomingItems = [];
      state.pemilikNama = {};
      state.itemCache = { pengguna: {}, tugas: {}, laporan: {}, pengingat: {} };
      state.pagination = {};
      invalidateCache();
      this.emit();
    }
  };

  /* ============================================================
     Aturan validasi form (Bahasa Indonesia, spesifik per field)
     ============================================================ */

  function wajib(nilai, pesan) {
    return function (v) {
      if (typeof nilai === 'function' ? nilai(v) : !v || !String(v).trim()) return pesan;
      return null;
    };
  }

  function aturanGenerik(kata) {
    return function (nilai) {
      var e = {};
      var pesan = wajib(null, 'Nama ' + kata + ' wajib diisi.')(nilai.nama);
      if (pesan) e.nama = pesan;
      else if (String(nilai.nama).trim().length < 4) e.nama = 'Nama ' + kata + ' minimal 4 karakter.';

      var pesanDesk = wajib(null, 'Deskripsi ' + kata + ' wajib diisi.')(nilai.deskripsi);
      if (pesanDesk) e.deskripsi = pesanDesk;
      else if (String(nilai.deskripsi).trim().length < 10) e.deskripsi = 'Deskripsi ' + kata + ' minimal 10 karakter agar jelas bagi pembaca.';

      var pesanDeadline = wajib(null, 'Pilih deadline terlebih dahulu.')(nilai.deadline);
      if (pesanDeadline) e.deadline = pesanDeadline;

      var pesanStatus = wajib(null, 'Status ' + kata + ' wajib dipilih.')(nilai.status);
      if (pesanStatus) e.status = pesanStatus;

      return e;
    };
  }

  MT.aturan = {
    tugas: aturanGenerik('tugas'),
    laporan: aturanGenerik('laporan'),
    pengingat: aturanGenerik('pengingat'),

    pengguna: function (nilai, mode) {
      var e = {};
      var pesanNama = wajib(null, 'Nama user wajib diisi.')(nilai.nama);
      if (pesanNama) e.nama = pesanNama;
      else if (String(nilai.nama).trim().length < 3) e.nama = 'Nama user minimal 3 karakter.';

      var pesanEmail = wajib(null, 'Email wajib diisi.')(nilai.email);
      if (pesanEmail) e.email = pesanEmail;
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(nilai.email).trim())) {
        e.email = 'Format email belum sesuai. Contoh: nama@perusahaan.id.';
      }

      var pesanRole = wajib(null, 'Role user wajib dipilih.')(nilai.role);
      if (pesanRole) e.role = pesanRole;

      return e;
    },

    masuk: function (nilai) {
      var e = {};
      var pesanEmail = wajib(null, 'Email wajib diisi.')(nilai.email);
      if (pesanEmail) e.email = pesanEmail;
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(nilai.email).trim())) {
        e.email = 'Format email belum sesuai. Contoh: nama@perusahaan.id.';
      }
      var pesanSandi = wajib(null, 'Kata sandi wajib diisi.')(nilai.kataSandi);
      if (pesanSandi) e.kataSandi = pesanSandi;
      return e;
    }
  };

  MT.validasi = function (nilai, aturan, mode) {
    var galat = aturan(nilai, mode) || {};
    var jumlah = Object.keys(galat).length;
    return { galat: galat, jumlah: jumlah, valid: jumlah === 0 };
  };

  MT.store = store;
})(window.MT);
