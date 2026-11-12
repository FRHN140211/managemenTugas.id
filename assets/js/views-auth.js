/* ============================================================
   views-auth.js — Layar masuk: validasi, toggle kata sandi,
   state loading, kredensial salah, dan kegagalan teknis.
   Autentikasi menggunakan API server dan sesi cookie httpOnly.
   ============================================================ */

window.MT = window.MT || {};

(function (MT) {
  'use strict';

  var form, inputNama, inputEmail, inputSandi, inputKonfirmasi, tombol, alertBox, tombolToggle, tombolMode, tombolSekunder, tombolToggleKonfirmasi;
  var inputLupaEmail, inputOtp, tombolKirimUlangOtp;
  var currentMode = 'login';
  var autentikasiBerlangsung = false;
  var statusOtp = null; // 'terkirim' | 'gagal' | null — hasil permintaan OTP terakhir
  var intervalHitungMundur = null;
  var JEDA_KIRIM_ULANG = 60;

  function hentikanHitungMundur() {
    if (intervalHitungMundur) { clearInterval(intervalHitungMundur); intervalHitungMundur = null; }
    var cnt = document.getElementById('auth-otp-resend-countdown');
    if (cnt) cnt.textContent = '';
  }

  /* Satu interval untuk jeda kirim ulang. Tombol nonaktif selama jeda. */
  function mulaiHitungMundur(detik) {
    hentikanHitungMundur();
    var btn = document.getElementById('auth-resend-otp');
    var cnt = document.getElementById('auth-otp-resend-countdown');
    if (!btn) return;
    var sisa = Math.max(1, Math.min(3600, Math.round(detik || JEDA_KIRIM_ULANG)));
    btn.disabled = true;
    if (cnt) cnt.textContent = MT.t('auth.email_check_resend_in', { n: sisa });
    intervalHitungMundur = setInterval(function () {
      sisa -= 1;
      if (sisa <= 0) {
        hentikanHitungMundur();
        btn.disabled = false;
        return;
      }
      if (cnt) cnt.textContent = MT.t('auth.email_check_resend_in', { n: sisa });
    }, 1000);
  }

  function bersihkan() {
    if (form) MT.bersihkanGalat(form);
    if (alertBox) alertBox.hidden = true;
  }

  function tampilkanAlert(judul, pesan, tambahan, jenis) {
    alertBox.hidden = false;
    alertBox.className = 'alert alert-' + (jenis || 'danger');
    var iconEl = alertBox.querySelector('[data-auth-alert-icon]');
    if (iconEl) iconEl.innerHTML = MT.icon('alert');
    var titleEl = alertBox.querySelector('[data-auth-alert-title]');
    if (titleEl) titleEl.textContent = judul;
    var messageEl = alertBox.querySelector('[data-auth-alert-message]');
    if (messageEl) messageEl.innerHTML = MT.esc(pesan) + (tambahan ? ' <span class="muted-sm">' + MT.esc(tambahan) + '</span>' : '');
  }

  /* Satu peta kode galat -> [judul, deskripsi] untuk seluruh layar auth.
     Kode berasal dari store.js (normalisasiGalatAuth), bukan teks mentah server. */
  var PESAN_GALAT = {
    EMAIL_ALREADY_REGISTERED: ['auth.email_exists_title', 'auth.email_exists_desc'],
    INVALID_PASSWORD: ['auth.error_password_rejected', 'auth.error_password_rejected_desc'],
    INVALID_EMAIL: ['auth.error_invalid_email', 'auth.error_invalid_email_desc'],
    INVALID_NAME: ['auth.error_invalid_name', 'auth.error_invalid_name_desc'],
    VALIDATION_FAILED: ['auth.error_validation', 'auth.error_validation_desc'],
    INVALID_CREDENTIALS: ['auth.login_error_title', 'auth.login_error_desc'],
    EMAIL_NOT_VERIFIED: ['auth.error_email_not_verified', 'auth.error_email_not_verified_desc'],
    ACCOUNT_DISABLED: ['auth.error_account_disabled', 'auth.error_account_disabled_desc'],
    IDENTITY_ALREADY_LINKED: ['auth.error_identity_linked', 'auth.error_identity_linked_desc'],
    AUTH_SESSION_MISSING: ['auth.error_session_missing', 'auth.error_session_missing_desc'],
    AUTH_NOT_CONFIGURED: ['auth.error_auth_not_configured', 'auth.error_auth_not_configured_desc'],
    AUTH_PROVIDER_UNAVAILABLE: ['auth.error_service_unavailable', 'auth.error_service_unavailable_desc'],
    HTTP_5xx: ['auth.error_service_unavailable', 'auth.error_service_unavailable_desc'],
    HTTP_403: ['auth.error_http_403', 'auth.error_http_403_desc'],
    NETWORK_ERROR: ['auth.error_network', 'auth.error_network_desc'],
    TIMEOUT: ['auth.register_uncertain_title', 'auth.register_uncertain_desc'],
    INVALID_RESPONSE: ['auth.register_uncertain_title', 'auth.register_uncertain_desc'],
    FAILED_TO_SEND_EMAIL: ['auth.error_failed_to_send_email', 'auth.error_failed_to_send_email_desc'],
    DATABASE_NOT_CONFIGURED: ['auth.error_database_not_configured', 'auth.error_database_not_configured_desc'],
    DATABASE_SCHEMA_INCOMPLETE: ['auth.error_database_schema_incomplete', 'auth.error_database_schema_incomplete_desc'],
    DATABASE_UNAVAILABLE: ['auth.error_database_unavailable', 'auth.error_database_unavailable_desc'],
    INTERNAL_ERROR: ['auth.error_internal', 'auth.error_internal_desc'],
    INVALID_OTP: ['auth.error_invalid_otp', 'auth.error_invalid_otp_desc'],
    OTP_EXPIRED: ['auth.error_otp_expired', 'auth.error_otp_expired_desc'],
    TOO_MANY_ATTEMPTS: ['auth.error_rate_limit', 'auth.error_rate_limit_desc'],
    RATE_LIMIT_EXCEEDED: ['auth.error_rate_limit', 'auth.error_rate_limit_desc']
  };

  function tampilkanGalatKode(kode, cadangan) {
    var k = String(kode || '').toUpperCase();
    var pasangan = PESAN_GALAT[k] || cadangan || ['auth.auth_error_title', 'auth.auth_error_desc'];
    tampilkanAlert(MT.t(pasangan[0]), MT.t(pasangan[1]), null, 'danger');
  }

  function setStatus(status) {
    if (form) form.setAttribute('data-auth-state', status);
  }

  function kosongkanSandi() {
    if (inputSandi) inputSandi.value = '';
    if (inputKonfirmasi) inputKonfirmasi.value = '';
  }

  function setAuthTexts() {
    var labels = {
      name: MT.t('auth.field_name'),
      email: MT.t('auth.field_email'),
      password: MT.t('auth.field_password'),
      'confirm-password': MT.t('auth.field_confirm_password'),
      otp: MT.t('auth.field_otp')
    };
    document.querySelectorAll('[data-auth-label]').forEach(function (el) {
      var key = el.getAttribute('data-auth-label');
      if (labels[key]) el.textContent = labels[key];
    });
    document.querySelectorAll('[data-auth-copy]').forEach(function (el) {
      el.textContent = MT.t(el.getAttribute('data-auth-copy'));
    });

    document.getElementById('auth-name').placeholder = MT.t('auth.placeholder_name');
    document.getElementById('auth-email').placeholder = MT.t('auth.placeholder_email');
    document.getElementById('auth-password').placeholder = MT.t('auth.placeholder_password');
    document.getElementById('auth-password-confirm').placeholder = MT.t('auth.placeholder_confirm_password');
    var otpInput = document.getElementById('auth-otp');
    if (otpInput) otpInput.placeholder = MT.t('auth.placeholder_otp');
    var resendBtn = document.getElementById('auth-resend-otp');
    if (resendBtn) {
      resendBtn.querySelector('.btn-label').textContent = MT.t('auth.btn_resend_otp');
      // setTombolLoading memulihkan label dari dataset; perbarui saat bahasa berganti.
      resendBtn.dataset.labelAsli = MT.t('auth.btn_resend_otp');
    }

    var eyeShow = MT.t('auth.password_toggle_show');
    var eyeHide = MT.t('auth.password_toggle_hide');
    if (tombolToggle) {
      tombolToggle.setAttribute('aria-label', eyeShow);
      tombolToggle.innerHTML = MT.icon('eye');
    }
    if (tombolToggleKonfirmasi) {
      tombolToggleKonfirmasi.setAttribute('aria-label', eyeShow);
      tombolToggleKonfirmasi.innerHTML = MT.icon('eye');
    }
  }

  function renderForgotField() {
    if (!form || document.getElementById('auth-forgot-email')) return;
    var field = document.createElement('div');
    field.className = 'field';
    field.setAttribute('data-auth-field', 'lupa-email');
    field.innerHTML = [
      '<label for="auth-forgot-email" data-auth-label="email"></label>',
      '<div class="input-wrap has-icon">',
      '<span class="input-icon" data-icon="mail" aria-hidden="true"></span>',
      '<input id="auth-forgot-email" name="lupaEmail" type="email" autocomplete="email" inputmode="email" maxlength="254" placeholder="" aria-describedby="auth-forgot-email-error">',
      '</div>',
      '<p class="field-error" id="auth-forgot-email-error" role="alert" hidden></p>'
    ].join('');
    inputLupaEmail = field.querySelector('#auth-forgot-email');
    tombol.parentNode.insertBefore(field, tombol);
    field.querySelector('[data-icon]').innerHTML = MT.icon('mail');
    inputLupaEmail.placeholder = MT.t('auth.forgot_email_placeholder');
    field.querySelector('label').textContent = MT.t('auth.field_email');
    inputLupaEmail.addEventListener('input', function () {
      inputLupaEmail.removeAttribute('aria-invalid');
      var errEl = field.querySelector('.field-error');
      if (errEl) { errEl.hidden = true; errEl.textContent = ''; }
      if (alertBox) alertBox.hidden = true;
    });
  }

  function removeForgotField() {
    var forgotField = document.getElementById('auth-forgot-email');
    if (forgotField && forgotField.closest('.field')) {
      forgotField.closest('.field').remove();
    }
    inputLupaEmail = null;
  }

  /* Field OTP adalah markup statis di index.html (label via data-auth-label="otp").
     Sebelumnya field ini DIHAPUS dari DOM saat keluar mode OTP lalu dibuat ulang
     dengan teks Indonesia hardcoded. Sekarang hanya ditampilkan/disembunyikan. */
  function renderOtpField() {
    inputOtp = document.getElementById('auth-otp');
    var field = document.querySelector('[data-auth-field="verifikasi-otp"]');
    if (field) field.hidden = false;
  }

  function removeOtpField() {
    var field = document.querySelector('[data-auth-field="verifikasi-otp"]');
    if (field) field.hidden = true;
    if (inputOtp) {
      inputOtp.value = '';
      inputOtp.removeAttribute('aria-invalid');
    }
    hentikanHitungMundur();
    var resendBtn = document.getElementById('auth-resend-otp');
    if (resendBtn) {
      resendBtn.hidden = true;
      resendBtn.disabled = false;
    }
  }

  function removeEmailCheck() {
    var box = document.getElementById('auth-email-check');
    if (box) box.remove();
  }

  function removeOtpEmail() {
    var el = document.querySelector('.auth-otp-email');
    if (el) el.remove();
  }

  function renderMode(mode) {
    currentMode = mode;
    setAuthTexts();
    var config = {
      login: {
        heading: 'auth.login_title',
        desc: 'auth.login_desc',
        switchText: 'auth.switch_to_register',
        switchLabel: 'auth.btn_register',
        submitLabel: 'auth.btn_login',
        pageTitle: 'auth.page_title_login',
        showName: false,
        showConfirm: false,
        secondaryVisible: true,
        secondaryText: 'auth.link_forgot_password',
        secondaryAction: 'forgot',
        passwordAutocomplete: 'current-password'
      },
      register: {
        heading: 'auth.register_title',
        desc: 'auth.register_desc',
        switchText: 'auth.switch_to_login',
        switchLabel: 'auth.btn_login',
        submitLabel: 'auth.btn_create_account',
        pageTitle: 'auth.page_title_register',
        showName: true,
        showConfirm: true,
        secondaryVisible: false,
        secondaryText: '',
        secondaryAction: 'none',
        passwordAutocomplete: 'new-password'
      },
      forgot: {
        heading: 'auth.forgot_title',
        desc: 'auth.forgot_desc',
        switchText: 'auth.switch_back_to_login',
        switchLabel: 'auth.btn_back_to_login',
        submitLabel: 'auth.btn_send_link',
        pageTitle: 'auth.page_title_forgot',
        showName: false,
        showConfirm: false,
        secondaryVisible: true,
        secondaryText: 'auth.link_back_to_login',
        secondaryAction: 'login',
        passwordAutocomplete: 'email'
      },
      otp: {
        heading: 'auth.verify_title',
        desc: 'auth.verify_desc',
        switchText: 'auth.switch_back_to_login',
        switchLabel: 'auth.btn_back_to_login',
        submitLabel: 'auth.btn_verify_otp',
        pageTitle: 'auth.page_title_verify',
        showName: false,
        showConfirm: false,
        // Kirim ulang hanya lewat satu tombol #auth-resend-otp; tombol sekunder
        // dulu memanggil kirimUlangOtp() yang tidak ada di scope (ReferenceError).
        secondaryVisible: false,
        secondaryText: '',
        secondaryAction: 'none',
        passwordAutocomplete: 'one-time-code'
      }
    }[mode] || config.login;

    document.querySelector('[data-auth-heading]').textContent = MT.t(config.heading);
    document.querySelector('[data-auth-description]').textContent = MT.t(config.desc);
    document.querySelector('[data-auth-switch-text]').textContent = MT.t(config.switchText);
    tombolMode.textContent = MT.t(config.switchLabel);
    tombol.querySelector('.btn-label').textContent = MT.t(config.submitLabel);
    tombol.setAttribute('data-label-asli', MT.t(config.submitLabel));
    document.title = MT.t(config.pageTitle) + ' — ManagenTugas.id';

    document.querySelector('[data-auth-field="nama"]').hidden = !config.showName;
    document.querySelector('[data-auth-field="konfirmasi"]').hidden = !config.showConfirm;
    var emailField = document.querySelector('[data-auth-field="email"]');
    if (emailField) emailField.hidden = mode === 'otp' || mode === 'forgot';
    var passwordField = document.querySelector('[data-auth-field="password"]');
    if (passwordField) passwordField.hidden = mode === 'otp' || mode === 'forgot';
    inputNama.required = config.showName;
    inputKonfirmasi.required = config.showConfirm;
    inputSandi.autocomplete = config.passwordAutocomplete;

    if (mode === 'forgot') {
      renderForgotField();
    } else {
      removeForgotField();
    }

    if (mode === 'otp') {
      renderOtpField();
      tampilkanLayarOtp();
    } else {
      removeOtpField();
      removeEmailCheck();
      removeOtpEmail();
    }

    if (tombolSekunder) {
      if (config.secondaryVisible) {
        tombolSekunder.hidden = false;
        tombolSekunder.textContent = MT.t(config.secondaryText);
        tombolSekunder.dataset.secondaryAction = config.secondaryAction;
      } else {
        tombolSekunder.hidden = true;
        tombolSekunder.textContent = '';
      }
    }

    if (tombolToggleKonfirmasi) {
      tombolToggleKonfirmasi.hidden = mode !== 'register';
    }

    if (alertBox) alertBox.hidden = true;
    bersihkan();
  }

  function tampilkanLayarOtp() {
    removeOtpEmail();
    var otpDesc = document.querySelector('[data-auth-description]');
    var emailVal = inputEmail ? inputEmail.value.trim() : '';
    var terkirim = statusOtp !== 'gagal';
    if (otpDesc) otpDesc.textContent = MT.t(terkirim ? 'auth.verify_desc' : 'auth.verify_desc_pending');
    if (otpDesc && emailVal) {
      var emailEl = document.createElement('p');
      emailEl.className = 'auth-otp-email';
      // textContent sudah aman; MT.esc() di sini dulu menampilkan &amp; dsb. secara harfiah.
      emailEl.textContent = MT.t(terkirim ? 'auth.email_check_sent_to' : 'auth.otp_account_email') + ' ' + emailVal;
      if (otpDesc.nextSibling) {
        otpDesc.parentNode.insertBefore(emailEl, otpDesc.nextSibling);
      } else {
        otpDesc.parentNode.appendChild(emailEl);
      }
    }
    var otpField = document.querySelector('[data-auth-field="verifikasi-otp"]');
    if (otpField) otpField.hidden = false;
    var resendBtn = document.getElementById('auth-resend-otp');
    if (resendBtn) resendBtn.hidden = false;
  }

  function kirim(e) {
    e.preventDefault();
    if (autentikasiBerlangsung) return;
    bersihkan();

    var nilai = {
      nama: inputNama ? inputNama.value.trim() : '',
      email: (currentMode === 'forgot' && inputLupaEmail ? inputLupaEmail.value.trim() : (inputEmail ? inputEmail.value.trim() : '')),
      kataSandi: inputSandi ? inputSandi.value : '',
      konfirmasiKataSandi: inputKonfirmasi ? inputKonfirmasi.value : '',
      token: '',
      password: inputSandi ? inputSandi.value : '',
      confirmPassword: ''
    };

    if (currentMode === 'forgot') {
      if (!nilai.email) {
        var field = document.getElementById('auth-forgot-email');
        if (field) {
          field.setAttribute('aria-invalid', 'true');
          var errorEl = field.closest('.field').querySelector('.field-error');
          if (errorEl) {
            errorEl.hidden = false;
            errorEl.textContent = MT.t('auth.error_email_required');
          }
        }
        tampilkanAlert(MT.t('auth.form_incomplete_title'), MT.t('auth.form_incomplete_desc'));
        return;
      }

      autentikasiBerlangsung = true;
      tombolMode.disabled = true;
      MT.setTombolLoading(tombol, true, MT.t('auth.loading'));
      fetch('/api/auth/forgot-password', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: nilai.email, redirectTo: window.location.origin + '/#/login' })
      }).then(function (response) {
        return response.text().then(function (teks) {
          var payload = {};
          if (teks) { try { payload = JSON.parse(teks); } catch (e) { payload = {}; } }
          var rincian = (payload && payload.error && typeof payload.error === 'object') ? payload.error : payload;
          if (!response.ok || payload.ok === false || rincian.status === false) {
            throw Object.assign(new Error((rincian && rincian.message) || 'Permintaan gagal.'), {
              code: String((rincian && rincian.code) || '').toUpperCase(),
              status: response.status
            });
          }
          return payload;
        });
      }).then(function () {
        // Pesan netral: tidak membocorkan apakah email terdaftar.
        tampilkanAlert(MT.t('auth.forgot_success_title'), MT.t('auth.forgot_success_desc'), null, 'info');
        renderMode('login');
        if (alertBox) {
          alertBox.hidden = false;
          var t = alertBox.querySelector('[data-auth-alert-title]');
          var m = alertBox.querySelector('[data-auth-alert-message]');
          if (t) t.textContent = MT.t('auth.forgot_success_title');
          if (m) m.textContent = MT.t('auth.forgot_success_desc');
        }
      }).catch(function (err) {
        var code = err && err.code ? String(err.code).toUpperCase() : '';
        if (code === 'RATE_LIMIT_EXCEEDED' || code === 'OVER_REQUEST_RATE_LIMIT' || err.status === 429) {
          tampilkanAlert(MT.t('auth.error_rate_limit'), MT.t('auth.error_rate_limit_desc'), null, 'danger');
          return;
        }
        if (err && !err.status) {
          tampilkanAlert(MT.t('auth.error_network'), MT.t('auth.error_network_desc'), null, 'danger');
          return;
        }
        tampilkanAlert(MT.t('auth.auth_error_title'), MT.t('auth.auth_error_desc'), null, 'danger');
      }).finally(function () {
        autentikasiBerlangsung = false;
        tombolMode.disabled = false;
        MT.setTombolLoading(tombol, false);
      });
      return;
    }

    // Validasi layar auth memakai teks locale (MT.aturan.masuk berisi teks Indonesia
    // hardcoded). Mode OTP tidak memvalidasi kata sandi karena field-nya tersembunyi.
    var hasil = { galat: {}, valid: true };
    if (currentMode !== 'otp') {
      if (!nilai.email) hasil.galat.email = MT.t('auth.error_email_required');
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(nilai.email)) hasil.galat.email = MT.t('auth.error_email_format');
      if (!nilai.kataSandi) hasil.galat.kataSandi = MT.t('auth.error_password_required');
    }
    hasil.valid = Object.keys(hasil.galat).length === 0;
    if (currentMode === 'register') {
      if (nilai.nama.length < 3 || nilai.nama.length > 160) {
        hasil.galat.nama = MT.t('auth.error_name_length');
      }
      if (nilai.kataSandi.length < 8 || nilai.kataSandi.length > 128) {
        hasil.galat.kataSandi = MT.t('auth.error_password_length');
      }
      if (nilai.konfirmasiKataSandi !== nilai.kataSandi) {
        hasil.galat.konfirmasiKataSandi = MT.t('auth.error_confirm_password');
      }
      hasil.valid = Object.keys(hasil.galat).length === 0;
    }

    if (!hasil.valid) {
      MT.tampilkanGalatValidasi(form, hasil.galat);
      tampilkanAlert(MT.t('auth.form_incomplete_title'), MT.t('auth.form_incomplete_desc'));
      return;
    }

    if (currentMode === 'otp' && !(inputOtp && inputOtp.value.trim())) {
      MT.tampilkanGalatValidasi(form, { otp: MT.t('auth.error_otp_required') });
      tampilkanAlert(MT.t('auth.form_incomplete_title'), MT.t('auth.form_incomplete_desc'));
      return;
    }

    var modeAwal = currentMode;
    autentikasiBerlangsung = true;
    tombolMode.disabled = true;
    setStatus(modeAwal + '_loading');
    MT.setTombolLoading(tombol, true, MT.t('auth.loading'));

    Promise.resolve().then(function () {
      if (modeAwal === 'otp') {
        return MT.store.verifikasiOtp(inputEmail.value.trim(), inputOtp.value.trim());
      }
      return modeAwal === 'login'
        ? MT.store.masuk(nilai.email, nilai.kataSandi)
        : MT.store.registrasi(nilai.nama, nilai.email, nilai.kataSandi);
    }).then(function (hasil) {
      hasil = hasil || {};
      if (hasil.ok) {
        // AUTHENTICATED: bersihkan semua artefak sebelum dashboard dibuka.
        removeOtpField();
        removeEmailCheck();
        removeOtpEmail();
        statusOtp = null;
        form.reset();
        setStatus('authenticated');
        MT.masukBerhasil();
        return;
      }
      if (hasil.alasan === 'verifikasi-email') {
        // VERIFICATION_PENDING: akun SUDAH dibuat. Jangan tampilkan galat registrasi.
        kosongkanSandi();
        statusOtp = hasil.otp === 'gagal' ? 'gagal' : 'terkirim';
        inputEmail.value = hasil.email || nilai.email;
        renderMode('otp');
        if (statusOtp === 'gagal') {
          setStatus('otp_failed');
          var kodeOtp = String(hasil.kode || '').toUpperCase();
          var pasangan = kodeOtp === 'RATE_LIMIT_EXCEEDED' || kodeOtp === 'TOO_MANY_ATTEMPTS'
            ? ['auth.otp_request_failed_title', 'auth.error_rate_limit_desc']
            : ['auth.otp_request_failed_title', 'auth.otp_request_failed_desc'];
          tampilkanAlert(MT.t(pasangan[0]), MT.t(pasangan[1]), null, 'warning');
          if (hasil.retryAfter) mulaiHitungMundur(hasil.retryAfter);
        } else {
          setStatus('verification_pending');
          mulaiHitungMundur(JEDA_KIRIM_ULANG);
        }
        if (inputOtp) inputOtp.focus();
        return;
      }
      if (hasil.alasan === 'terverifikasi') {
        // EMAIL_VERIFIED tanpa sesi: kembali ke login dengan email dipertahankan.
        var emailTerverifikasi = hasil.email || inputEmail.value.trim();
        statusOtp = null;
        renderMode('login');
        inputEmail.value = emailTerverifikasi;
        setStatus('email_verified');
        tampilkanAlert(MT.t('auth.verify_success_title'), MT.t('auth.verify_success_desc'), null, 'success');
        if (inputSandi) inputSandi.focus();
        return;
      }
      if (hasil.alasan === 'kredensial') {
        setStatus('login');
        tampilkanAlert(MT.t('auth.login_error_title'), MT.t('auth.login_error_desc'), null, 'danger');
        inputSandi.value = '';
        inputSandi.focus();
        return;
      }
      // REGISTRATION_FAILED / hasil tidak pasti: form registrasi tetap terlihat,
      // nama + email dipertahankan, kata sandi dikosongkan. Tidak ada retry otomatis.
      setStatus(hasil.alasan === 'tidak-pasti' ? 'registration_uncertain' : 'registration_failed');
      kosongkanSandi();
      var kodeReg = hasil.kode || '';
      if (hasil.alasan === 'tidak-pasti') {
        tampilkanAlert(MT.t(kodeReg === 'FAILED_TO_SEND_EMAIL' ? 'auth.error_failed_to_send_email' : 'auth.register_uncertain_title'),
          MT.t('auth.register_uncertain_desc'), null, 'warning');
      } else if (hasil.alasan === 'error') {
        // Kode tak dikenal / SDK gagal / 401 pada sign-up: pesan registrasi umum.
        tampilkanAlert(MT.t('auth.register_failed_title'), MT.t('auth.register_failed_desc'), null, 'danger');
      } else if (hasil.alasan === 'email-terdaftar') {
        tampilkanAlert(MT.t('auth.email_exists_title'), MT.t('auth.email_exists_desc'), null, 'info');
      } else {
        tampilkanGalatKode(kodeReg, ['auth.register_failed_title', 'auth.register_failed_desc']);
      }
      if (hasil.alasan === 'kata-sandi') MT.tampilkanGalatValidasi(form, { kataSandi: MT.t('auth.error_password_rejected_desc') });
      if (hasil.alasan === 'email') MT.tampilkanGalatValidasi(form, { email: MT.t('auth.error_invalid_email_desc') });
      if (hasil.alasan === 'nama') MT.tampilkanGalatValidasi(form, { nama: MT.t('auth.error_invalid_name_desc') });
    }).catch(function (err) {
      // Galat dilempar oleh masuk() / verifikasiOtp() / profil aplikasi. Kode sudah
      // dinormalisasi di store.js; tidak ada pesan mentah server yang ditampilkan.
      var kode = err && err.code ? String(err.code).toUpperCase() : '';
      if (modeAwal === 'otp') {
        setStatus('otp_failed');
        if (inputOtp) { inputOtp.value = ''; inputOtp.focus(); }
        if (kode === 'INVALID_OTP' || kode === 'OTP_EXPIRED') {
          MT.tampilkanGalatValidasi(form, { otp: MT.t(PESAN_GALAT[kode][1]) });
        }
        tampilkanGalatKode(kode, ['auth.otp_verify_failed_title', 'auth.otp_verify_failed_desc']);
        return;
      }
      setStatus(modeAwal === 'register' ? 'registration_failed' : 'auth_error');
      if (modeAwal === 'register') kosongkanSandi();
      tampilkanGalatKode(kode, modeAwal === 'register'
        ? ['auth.register_failed_title', 'auth.register_failed_desc']
        : null);
    }).finally(function () {
      autentikasiBerlangsung = false;
      tombolMode.disabled = false;
      MT.setTombolLoading(tombol, false);
    });
  }

  function tampilkanEmailCheck(email) {
    email = String(email || '').trim();
    var box = document.getElementById('auth-email-check');
    if (!box) {
      box = document.createElement('div');
      box.id = 'auth-email-check';
      box.className = 'auth-email-check';
      var alertBox = document.getElementById('auth-alert');
      if (alertBox) {
        alertBox.hidden = true;
      }
      if (form) {
        form.insertBefore(box, form.firstChild);
      }
    }
    box.hidden = false;
    box.innerHTML =
      '<div class="auth-email-check-icon"><img src="/assets/icons/favicon.svg" alt="" aria-hidden="true"></div>' +
      '<div class="auth-email-check-body">' +
        '<p class="auth-email-check-title">' + MT.t('auth.email_check_title') + '</p>' +
        '<p class="auth-email-check-desc" id="auth-email-check-desc">' +
          MT.t('auth.email_check_desc') + '<br>' +
          '<span id="auth-email-check-hint">' + MT.t('auth.email_check_sent_hint') + '</span>' +
        '</p>' +
        '<p class="auth-email-check-actions">' +
          '<a class="link-button auth-email-check-change" id="auth-email-change" href="#/login">' +
            MT.t('auth.email_check_change_email') +
          '</a>' +
        '</p>' +
      '</div>';

    document.getElementById('auth-email-change').textContent = MT.t('auth.email_check_change_email');
  }

  function siapkanToggleSandi() {
    var bindToggle = function (toggleEl, inputEl) {
      if (!toggleEl || !inputEl) return;
      toggleEl.addEventListener('click', function () {
        var terlihat = inputEl.type === 'text';
        inputEl.type = terlihat ? 'password' : 'text';
        toggleEl.setAttribute('aria-pressed', terlihat ? 'false' : 'true');
        toggleEl.setAttribute('aria-label', terlihat ? MT.t('auth.password_toggle_show') : MT.t('auth.password_toggle_hide'));
        toggleEl.innerHTML = MT.icon(terlihat ? 'eye' : 'eyeOff');
        inputEl.focus();
      });
    };
    bindToggle(tombolToggle, inputSandi);
    bindToggle(tombolToggleKonfirmasi, inputKonfirmasi);
  }

  MT.auth = {
    init: function () {
      form = document.getElementById('auth-form');
      if (!form) return;

      document.querySelectorAll('[data-icon]').forEach(function (el) {
        el.innerHTML = MT.icon(el.getAttribute('data-icon'));
      });

      inputEmail = document.getElementById('auth-email');
      inputNama = document.getElementById('auth-name');
      inputSandi = document.getElementById('auth-password');
      inputKonfirmasi = document.getElementById('auth-password-confirm');
      tombol = document.getElementById('auth-submit');
      alertBox = document.getElementById('auth-alert');
      tombolToggle = document.getElementById('auth-toggle-password');
      tombolToggleKonfirmasi = document.getElementById('auth-toggle-password-confirm');
      tombolMode = document.querySelector('[data-auth-mode-toggle]');
      tombolSekunder = document.getElementById('auth-secondary-action');
      inputOtp = document.getElementById('auth-otp');
      tombolKirimUlangOtp = document.getElementById('auth-resend-otp');

      if (tombolKirimUlangOtp) {
        // Satu listener, satu tombol. Label ada di <span class="btn-label">, hitung
        // mundur di span terpisah, jadi tidak ada textContent yang menghapus anak node.
        tombolKirimUlangOtp.addEventListener('click', function () {
          var btn = tombolKirimUlangOtp;
          if (btn.disabled || currentMode !== 'otp' || autentikasiBerlangsung) return;
          autentikasiBerlangsung = true;
          setStatus('otp_loading');
          MT.setTombolLoading(btn, true, MT.t('auth.loading'));
          MT.store.kirimUlangOtp(inputEmail.value.trim()).then(function () {
            MT.setTombolLoading(btn, false);
            statusOtp = 'terkirim';
            tampilkanLayarOtp();
            setStatus('verification_pending');
            if (inputOtp) inputOtp.value = '';
            tampilkanAlert(MT.t('auth.email_check_resend_sent_title'), MT.t('auth.email_check_resend_sent_desc'), null, 'success');
            mulaiHitungMundur(JEDA_KIRIM_ULANG);
          }, function (err) {
            MT.setTombolLoading(btn, false);
            setStatus('otp_failed');
            var kode = err && err.code ? String(err.code).toUpperCase() : '';
            tampilkanGalatKode(kode, ['auth.otp_request_failed_title', 'auth.otp_request_failed_desc']);
            if (kode === 'RATE_LIMIT_EXCEEDED' || kode === 'TOO_MANY_ATTEMPTS') {
              mulaiHitungMundur(err.retryAfter || JEDA_KIRIM_ULANG);
            }
          }).then(function () {
            autentikasiBerlangsung = false;
          });
        });
      }

      setAuthTexts();
      var themeContainer = document.getElementById('auth-theme-switch-container');
      if (themeContainer && MT.themeSwitcher) {
        themeContainer.innerHTML = MT.themeSwitcher();
      }
      var languageContainer = document.getElementById('auth-lang-switch-container');
      if (languageContainer && MT.bahasaSwitcher) {
        languageContainer.innerHTML = MT.bahasaSwitcher();
        languageContainer.addEventListener('click', function (event) {
          var trigger = event.target.closest('.fg-select-trigger');
          if (!trigger) return;
          var panel = trigger.parentNode.querySelector('.fg-panel');
          var isOpen = trigger.getAttribute('aria-expanded') === 'true';
          if (panel) panel.hidden = isOpen;
          trigger.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
        });
      }
      MT.i18n.onChange(function () {
        setAuthTexts();
        renderMode(currentMode);
        if (languageContainer && MT.bahasaSwitcher) {
          languageContainer.innerHTML = MT.bahasaSwitcher();
        }
      });
      siapkanToggleSandi();
      if (tombolSekunder) {
        tombolSekunder.addEventListener('click', function () {
          if (autentikasiBerlangsung) return;
          renderMode(currentMode === 'login' ? 'forgot' : 'login');
          setStatus(currentMode);
        });
      }
      form.addEventListener('submit', kirim);
      tombolMode.addEventListener('click', function () {
        if (autentikasiBerlangsung) return;
        if (currentMode === 'otp') {
          // Kembali ke login: email dipertahankan agar pengguna bisa masuk setelah verifikasi.
          var email = inputEmail.value;
          statusOtp = null;
          renderMode('login');
          inputEmail.value = email;
          inputEmail.readOnly = false;
          setStatus('login');
          return;
        }
        renderMode(currentMode === 'login' ? 'register' : 'login');
        setStatus(currentMode);
      });

      [inputNama, inputEmail, inputSandi, inputKonfirmasi, inputOtp].forEach(function (input) {
        if (!input) return;
        input.addEventListener('input', function () {
          input.removeAttribute('aria-invalid');
          var field = input.closest('.field');
          var pesanEl = field ? field.querySelector('.field-error') : null;
          if (pesanEl) { pesanEl.hidden = true; pesanEl.textContent = ''; }
          if (alertBox) alertBox.hidden = true;
        });
      });

      renderMode('login');
      setStatus('login');
    },
    // Hanya untuk diagnosis/tes: status UI aktif, tanpa data rahasia.
    status: function () {
      return { mode: currentMode, state: form ? form.getAttribute('data-auth-state') : null, otp: statusOtp, sibuk: autentikasiBerlangsung };
    }
  };
})(window.MT);
