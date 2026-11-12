/* ============================================================
   views-notes.js — Halaman Catatan & Handoff dan halaman Profil.
   Memisahkan secara eksplisit: requirement MVP, usulan tambahan,
   dan keputusan yang masih terbuka (belum boleh dianggap final).
   ============================================================ */

window.MT = window.MT || {};

(function (MT) {
  'use strict';

  function bagian(id, nomor, judul, isi) {
    return '<section class="section" id="' + id + '">' +
      '<div class="section-head"><div>' +
        '<p class="eyebrow">Bagian ' + nomor + '</p>' +
        '<h3>' + judul + '</h3>' +
      '</div></div>' + isi + '</section>';
  }

  function panel(judul, isi, catatan) {
    return '<div class="panel">' +
      (judul ? '<div class="panel-head"><h3>' + judul + '</h3>' + (catatan ? '<p>' + catatan + '</p>' : '') + '</div>' : '') +
      '<div class="panel-pad">' + isi + '</div>' +
    '</div>';
  }

  function tabelDoc(kepala, baris) {
    return '<div class="table-scroll"><table class="doc-table">' +
      '<thead><tr>' + kepala.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead>' +
      '<tbody>' + baris.map(function (r) {
        return '<tr>' + r.map(function (sel) { return '<td>' + sel + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }

  function renderCatatan() {
    return '<div class="page-head">' +
        '<div class="page-head-text">' +
          '<h2>' + MT.t('notes.page_title') + '</h2>' +
          '<p>' + MT.t('notes.page_desc') + '</p>' +
        '</div>' +
        '<div class="page-head-actions">' +
          '<button type="button" class="btn btn-ghost" data-action="catatan.cetak">' + MT.icon('download') + MT.t('notes.print_pdf') + '</button>' +
        '</div>' +
      '</div>' +

      panel('Status implementasi',
        tabelDoc(
          ['Area', 'Status', 'Keterangan'],
          [
            ['Antarmuka 5 modul MVP', '<span class="badge badge-teal">Ada</span>', 'Dashboard, Manajemen Pengguna, Manajemen Tugas, Manajemen Laporan, Reminder.'],
            ['CRUD + validasi field wajib', '<span class="badge badge-teal">Ada</span>', 'Data dimuat dan disimpan melalui API server ke Neon PostgreSQL.'],
            ['State loading / kosong / error / sukses', '<span class="badge badge-teal">Ada</span>', 'Menggunakan skeleton, empty state, pesan API, dan notifikasi yang sudah tersedia.'],
            ['Koneksi basis data PostgreSQL / Neon', '<span class="badge badge-teal">API siap</span>', 'GET /api/health menguji query database; konfigurasi koneksi ada di server saja.'],
            ['Otentikasi, hash kata sandi, sesi', '<span class="badge badge-teal">Ada</span>', 'bcrypt, cookie httpOnly, sesi persisten 7 hari, dan bootstrap Owner interaktif.'],
            ['Rate limiting, backup otomatis 7 hari', '<span class="badge badge-coral">Sebagian</span>', 'Rate limiting login tersedia; backup otomatis belum dikonfigurasi.'],
            ['Notifikasi aktif / in-app', '<span class="badge badge-coral">Tidak dibuat</span>', 'Berada di daftar out of scope sekaligus disebut sebagai usulan — dicatat sebagai keputusan terbuka.']
          ]
        ),
        'Backup dan deployment produksi tetap memerlukan konfigurasi terpisah'
      ) +

      bagian('lingkup', 1, 'Lingkup MVP dan hal di luar lingkup', panel(null,
        '<p class="prose" style="margin-bottom:14px">Lima modul inti dipertahankan lengkap: Dashboard, Manajemen Pengguna, Manajemen Tugas, ' +
        'Manajemen Laporan, dan Reminder. Modul inti tidak dihapus maupun disederhanakan.</p>' +
        tabelDoc(['Kategori', 'Butir', 'Perlakuan'], [
          ['MVP', 'Catat, lacak, kelola, laporkan tugas harian/bulanan', 'CRUD tersimpan pada Neon PostgreSQL'],
          ['MVP', 'Owner mengelola user; User mengelola tugas, laporan, reminder', 'Otorisasi dan kepemilikan diperiksa di backend'],
          ['MVP', 'Reminder dikelola sebagai data', 'CRUD tersedia; pemicu/notifikasi belum dijalankan'],
          ['Out of scope', 'Chat', 'Tidak dibuat sama sekali'],
          ['Out of scope', 'Lampiran / unggah berkas', 'Tidak dibuat sama sekali'],
          ['Out of scope', 'Notifikasi aktif', 'Tidak dibuat; konflik dengan usulan “In-app notification” dicatat sebagai keputusan terbuka'],
          ['Out of scope', 'Audit trail lengkap', 'Aktivitas dasar dicatat; histori audit lengkap belum dibuat']
        ])
      )) +

      bagian('keputusan', 2, 'Requirement, usulan, dan keputusan terbuka', panel(null,
        '<p class="prose" style="margin-bottom:14px">Perbedaan ini dijaga agar fitur yang belum disetujui tidak dianggap final. ' +
        'Penanda yang dipakai pada antarmuka: <span class="tag-requirement">Requirement</span> ' +
        '<span class="tag-usulan">Usulan</span> <span class="tag-terbuka">Keputusan terbuka</span>.</p>' +
        tabelDoc(['Butir', 'Status', 'Catatan'], [
          ['CRUD pada 4 entitas + validasi field wajib', '<span class="tag-requirement">Requirement</span>', 'API memvalidasi dan menyimpan perubahan pada database.'],
          ['Role Owner vs User', '<span class="tag-requirement">Requirement</span>', 'API melindungi user-management dan membatasi record menurut kepemilikan.'],
          ['Dialog konfirmasi sebelum menghapus', '<span class="tag-requirement">Requirement</span>', 'Sudah ada pada seluruh modul.'],
          ['Pencarian, filter, urutan, paginasi', '<span class="tag-usulan">Usulan</span>', 'Disiapkan agar konsisten antar modul; belum requirement final.'],
          ['Rekap laporan otomatis + ekspor CSV', '<span class="tag-usulan">Usulan</span>', 'Ada di modul laporan sebagai gambaran keluaran.'],
          ['Kolom “Status akun” pada user', '<span class="tag-usulan">Usulan</span>', 'Dipakai untuk menonaktifkan akses tanpa menghapus data.'],
          ['Kartu metrik &amp; grafik dashboard', '<span class="tag-usulan">Usulan</span>', 'Metrik final belum ditetapkan.'],
          ['Autentikasi aplikasi privat', '<span class="tag-requirement">Diputuskan</span>', 'Login diwajibkan; registrasi publik dan reset sandi mandiri belum dibuat.'],
          ['Visibilitas data (milik sendiri vs semua)', '<span class="tag-terbuka">Sementara</span>', 'Owner melihat semua; User hanya data yang dibuatnya. Konfirmasi kebijakan sebelum produksi.'],
          ['Perilaku saat deadline terlewat', '<span class="tag-terbuka">Keputusan terbuka</span>', 'Tidak ada perubahan status otomatis pada aplikasi.'],
          ['Perilaku reminder (pemicu, pengulangan, zona waktu)', '<span class="tag-terbuka">Keputusan terbuka</span>', 'Belum diimplementasikan.'],
          ['Monetisasi &amp; KPI resmi', '<span class="tag-terbuka">Keputusan terbuka</span>', 'Belum ditetapkan dan tidak diasumsikan oleh aplikasi.']
        ])
      )) +

      bagian('role', 3, 'Matriks izin sementara (belum final)', panel(null,
        tabelDoc(['Kemampuan', 'Owner', 'User', 'Catatan'], [
          ['Tambah / ubah / hapus user', 'Ya', 'Tidak', 'Menu dan rute dibatasi; pemeriksaan wajib diulang di server.'],
          ['Lihat data user lain', 'Ya', 'Tidak', 'Profil hanya menampilkan akun sendiri.'],
          ['CRUD tugas, laporan, reminder', 'Ya (semua data)', 'Ya (data miliknya)', 'Visibilitas milik sendiri adalah keputusan sementara.'],
          ['Melihat dashboard', 'Ya', 'Ya', 'Isi metrik per role belum disepakati.'],
          ['Mengubah pengaturan sistem', 'Belum ditetapkan', 'Belum ditetapkan', 'Keputusan terbuka.']
        ]),
        'Kebijakan akses data saat ini diterapkan di server dan perlu persetujuan produk sebelum produksi'
      )) +

      bagian('field', 4, 'Pemetaan field wajib untuk handoff', panel(null,
        '<p class="prose" style="margin-bottom:14px">Field wajib tetap tersedia pada antarmuka. Skema yang dipakai berada pada migrasi SQL berurutan.</p>' +
        tabelDoc(['Entitas', 'Field produk', 'Penyimpanan'], [
          ['User', 'Nama, email, kata sandi, role', '<code class="code-inline">name</code>, <code class="code-inline">email</code>, <code class="code-inline">password_hash</code>, <code class="code-inline">role</code>'],
          ['Task', 'Nama, deskripsi, deadline, status', '<code class="code-inline">created_by</code> mengacu pada user pembuat'],
          ['Report', 'Nama, deskripsi, deadline, status', '<code class="code-inline">created_by</code> mengacu pada user pembuat'],
          ['Reminder', 'Nama, deskripsi, deadline, status', '<code class="code-inline">created_by</code>; belum ada pemicu terjadwal']
        ]) +
        '<p class="meta-label" style="margin:22px 0 10px">Migrasi versi</p>' +
        '<pre class="code-block"><span class="c-key">database/migrations/001_initial_schema.sql</span>\n' +
        '<span class="c-key">database/migrations/002_legacy_owner_column.sql</span></pre>' +
        '<p class="muted-sm" style="margin-top:12px">Deadline kalender disimpan sebagai tipe <code class="code-inline">date</code>. Nilai role disimpan dalam huruf kecil; enum status mengikuti status UI saat ini dan masih perlu konfirmasi produk.</p>'
      )) +

      bagian('teknis', 5, 'Kewajiban handoff teknis', panel(null,
        '<div class="grid-2">' +
          '<div><p class="meta-label" style="margin-bottom:10px">Wajib sebelum produksi</p>' +
            '<ul class="checklist">' +
                  '<li><span class="check-mark">' + MT.icon('check') + '</span><span>Kata sandi di-hash dengan bcrypt dan tidak pernah disimpan atau ditampilkan sebagai teks asli.</span></li>' +
                  '<li><span class="check-mark">' + MT.icon('check') + '</span><span>Rate limiting pada login diterapkan per alamat IP; endpoint data memerlukan sesi.</span></li>' +
                  '<li><span class="check-mark">' + MT.icon('check') + '</span><span>Otorisasi di server untuk setiap endpoint (role + kepemilikan data).</span></li>' +
              '<li><span class="check-mark check-mark-todo">' + MT.icon('close') + '</span><span>Backup otomatis setiap 7 hari, beserta uji pemulihan (restore).</span></li>' +
              '<li><span class="check-mark check-mark-todo">' + MT.icon('close') + '</span><span>Loading state dan pencegahan klik ganda pada seluruh aksi tulis.</span></li>' +
            '</ul></div>' +
          '<div><p class="meta-label" style="margin-bottom:10px">Rancangan struktur API</p>' +
            '<pre class="code-block">' +
              'POST   <span class="c-key">/api/auth/login</span>\n' +
              'POST   <span class="c-key">/api/auth/logout</span>\n' +
              '\n' +
              'GET    <span class="c-key">/api/users</span>\n' +
              'POST   <span class="c-key">/api/users</span>\n' +
              'PATCH  <span class="c-key">/api/users/:id</span>\n' +
              'DELETE <span class="c-key">/api/users/:id</span>\n' +
              '\n' +
              '<span class="c-comment"># pola sama untuk:</span>\n' +
              '<span class="c-key">/api/tasks</span> · <span class="c-key">/api/reports</span> · <span class="c-key">/api/reminders</span>' +
            '</pre>' +
            '<p class="muted-sm" style="margin-top:10px">Batas login adalah 8 percobaan per 15 menit per IP; sesi berlaku 7 hari; penghapusan bersifat permanen. ' +
            'Backup otomatis belum dikonfigurasi.</p></div>' +
        '</div>' +
        '<p class="meta-label" style="margin:22px 0 10px">Variabel lingkungan yang diperkirakan dibutuhkan</p>' +
        '<pre class="code-block">' +
          'DATABASE_URL        <span class="c-comment"># Neon PostgreSQL (pooled connection)</span>\n' +
          '<span class="c-comment"># SESSION_SECRET tidak diperlukan; token acak disimpan sebagai hash di database.</span>\n' +
          '<span class="c-comment"># Nilai konfigurasi rate limit ditetapkan di server.</span>' +
        '</pre>' +
        '<p class="muted-sm" style="margin-top:12px">Manajemen secret, pipeline deploy, dan domain belum ditentukan. ' +
        'Backup 7 hari dicatat di dokumen ini, bukan sebagai menu pada aplikasi pengguna.</p>'
      )) +

      bagian('teknologi', 6, 'Teknologi, target, dan deliverables', panel(null,
        '<div class="grid-2">' +
          '<div><dl class="def-list">' +
            '<div class="def-row"><dt>Frontend</dt><dd>HTML dan CSS kustom, JavaScript tanpa framework</dd></div>' +
            '<div class="def-row"><dt>Backend</dt><dd>API JavaScript untuk Node.js lokal dan Vercel Functions</dd></div>' +
            '<div class="def-row"><dt>Basis data</dt><dd>PostgreSQL di Neon; perlu konfigurasi dan migrasi sebelum digunakan</dd></div>' +
            '<div class="def-row"><dt>Hosting</dt><dd>Vercel — belum dideploy</dd></div>' +
            '<div class="def-row"><dt>Autentikasi</dt><dd>Email + kata sandi, sesi server, dan akun Owner awal melalui skrip interaktif</dd></div>' +
            '<div class="def-row"><dt>Target selesai</dt><dd>31 Oktober 2026</dd></div>' +
          '</dl></div>' +
          '<div><p class="meta-label" style="margin-bottom:10px">Estimasi sumber daya (5 hari kerja)</p>' +
            '<ul class="checklist">' +
              '<li><span class="check-mark">' + MT.icon('check') + '</span><span>Perancangan desain: 1 hari</span></li>' +
              '<li><span class="check-mark">' + MT.icon('check') + '</span><span>Pengembangan: 2 hari</span></li>' +
              '<li><span class="check-mark">' + MT.icon('check') + '</span><span>Pengujian: 1 hari</span></li>' +
              '<li><span class="check-mark">' + MT.icon('check') + '</span><span>Deployment: 1 hari</span></li>' +
            '</ul>' +
            '<p class="muted-sm" style="margin-top:12px">Deliverables: kode sumber, dokumentasi (halaman ini), ' +
            'dan deployment bila disepakati.</p></div>' +
        '</div>'
      )) +

      bagian('alur', 7, 'Alur aplikasi yang dapat diuji', panel(null,
        '<ul class="checklist">' +
          '<li><span class="check-mark">' + MT.icon('check') + '</span><span>Buat Owner awal dengan skrip bootstrap, lalu masuk ke Dashboard menggunakan akun yang tersimpan di Neon.</span></li>' +
          '<li><span class="check-mark">' + MT.icon('check') + '</span><span>Dashboard → Manajemen Tugas → Detail → Ubah → Hapus dengan dialog konfirmasi.</span></li>' +
          '<li><span class="check-mark">' + MT.icon('check') + '</span><span>Dashboard → Manajemen Pengguna (Owner) → Tambah/Ubah/Hapus user.</span></li>' +
          '<li><span class="check-mark">' + MT.icon('check') + '</span><span>Dashboard → Manajemen Laporan → CRUD + rekap konsep + ekspor CSV.</span></li>' +
          '<li><span class="check-mark">' + MT.icon('check') + '</span><span>Dashboard → Reminder → CRUD tanpa pemicu otomatis.</span></li>' +
          '<li><span class="check-mark">' + MT.icon('check') + '</span><span>Form kosong → validasi gagal → isian dipertahankan → perbaiki → simpan berhasil.</span></li>' +
          '<li><span class="check-mark">' + MT.icon('check') + '</span><span>Pencarian/filter tanpa hasil → empty state + tombol atur ulang.</span></li>' +
          '<li><span class="check-mark">' + MT.icon('check') + '</span><span>Masuk sebagai User lalu buka <code class="code-inline">#/pengguna</code> → halaman akses ditolak.</span></li>' +
        '</ul>'
      )) +

      bagian('uat', 8, 'Checklist UAT minimal', panel(null,
        tabelDoc(['Butir uji', 'Kondisi lulus', 'Status implementasi'], [
          ['Validasi field wajib', 'Pesan spesifik muncul dekat field, isian tidak hilang', '<span class="badge badge-teal">Dapat diuji</span>'],
          ['CRUD sesuai izin', 'Owner dapat mengelola user; User ditolak saat membuka modul pengguna', '<span class="badge badge-teal">Dapat diuji</span>'],
          ['Password hash + salt', 'Tidak ada kata sandi tersimpan sebagai teks asli', '<span class="badge badge-teal">Diimplementasikan</span>'],
          ['Rate limiting', 'Percobaan masuk berlebih dibatasi dengan pesan jelas', '<span class="badge badge-teal">Diimplementasikan</span>'],
          ['Loading &amp; anti double submit', 'Tombol nonaktif dan menampilkan proses saat menyimpan', '<span class="badge badge-teal">Dapat diuji</span>'],
          ['Backup otomatis 7 hari', 'Jadwal backup dan prosedur restore terbukti', '<span class="badge badge-coral">Belum dikonfigurasi</span>']
        ]),
        'Belum ada klaim lulus UAT produksi sebelum migrasi dan pengujian integrasi dilakukan'
      )) +

      bagian('terbuka', 9, 'Daftar keputusan terbuka', panel(null,
        tabelDoc(['Keputusan', 'Pilihan yang perlu disepakati', 'Dampak bila ditunda'], [
          ['Autentikasi', 'Login wajib; registrasi publik tidak tersedia; Owner awal dibuat lewat bootstrap; sesi 7 hari; reset sandi belum tersedia', 'Setujui kebijakan pemulihan akun sebelum produksi'],
          ['Dashboard', 'Metrik resmi serta perbedaan tampilan Owner dan User', 'Angka pada dashboard belum dapat dijadikan acuan'],
          ['Izin &amp; visibilitas', 'Matriks izin final dan cakupan data (sendiri, tim, atau semua)', 'Risiko kebocoran data bila aturan sementara belum dikonfirmasi'],
          ['Kolom &amp; status', 'Kolom tambahan, daftar status resmi, prioritas, label', 'Perlu migrasi tambahan bila skema dikunci terlalu cepat'],
          ['Pencarian &amp; penyajian', 'Perlu tidaknya search/filter/sort/pagination sebagai fitur final', 'Beban query dan indeks basis data belum dapat diperhitungkan'],
          ['Laporan', 'Rekap otomatis vs manual, metrik, kebutuhan ekspor', 'Modul laporan berisiko dikembangkan dua arah'],
          ['Reminder', 'Waktu pemicu, pengulangan, zona waktu, tautan ke tugas, cara pengiriman, notifikasi in-app', 'Keputusan ini menentukan kebutuhan penjadwal (scheduler)'],
          ['Audit trail', 'Perlu tidaknya jejak audit (di luar MVP)', 'Investigasi perubahan data sulit dilakukan'],
          ['Monetisasi &amp; KPI', 'Model bisnis dan indikator keberhasilan resmi', 'Sengaja tidak dibuat agar tidak menampilkan angka karangan']
        ])
      ));
  }

  MT.rute.catatan = {
    judul: function () { return 'Catatan & Handoff'; },
    remah: function () { return [{ label: 'Dashboard', rute: 'dashboard' }, { label: 'Catatan & Handoff' }]; },
    render: renderCatatan
  };

  MT.aksi['catatan.cetak'] = function () {
    MT.toast('info', 'Siap disimpan sebagai PDF', 'Gunakan dialog cetak peramban (Ctrl/Cmd + P) lalu pilih “Simpan sebagai PDF”.');
    setTimeout(function () { window.print(); }, 400);
  };

  /* ---------------- Pengaturan akun ---------------- */

  function renderProfil() {
    var u = MT.store.penggunaAktif();
    var orangnya = MT.store.state.pengguna.filter(function (x) { return x.id === u.id; })[0] || {};
    var tema = u.tema || MT.theme.get();
    var bahasa = u.bahasa || MT.i18n.getLocale();
    var hitungan = MT.store.state.profileSummary || { tasks: 0, reports: 0, reminders: 0 };

    return '<div class="page-head">' +
        '<div class="page-head-text">' +
        '<h2>' + MT.t('profile.title') + '</h2>' +
        '<p>' + MT.t('profile.description') + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="profile-grid">' +
        '<div class="stack">' +
          '<section class="panel">' +
          '<div class="panel-head"><h3>' + MT.t('profile.preferences') + '</h3></div>' +
            '<form class="panel-pad" data-form-modul="profile">' +
            '<div class="field"><label for="profile-name">' + MT.t('profile.name') + '</label>' +
                '<input id="profile-name" name="nama" type="text" value="' + MT.esc(u.nama) + '" minlength="3" maxlength="160" autocomplete="name" required></div>' +
            '<div class="field"><label for="profile-email">' + MT.t('profile.email') + '</label>' +
                '<input id="profile-email" type="email" value="' + MT.esc(u.email) + '" readonly aria-describedby="profile-email-help">' +
              '<p class="field-help" id="profile-email-help">' + MT.t('profile.email_readonly') + '</p></div>' +
            '<div class="field"><label for="profile-role">' + MT.t('profile.role') + '</label>' +
              '<input id="profile-role" type="text" value="' + MT.esc(MT.t(u.role === 'owner' ? 'role.owner' : 'role.user')) + '" readonly></div>' +
              '<div class="grid-2">' +
              '<div class="field"><label for="profile-theme">' + MT.t('profile.theme') + '</label><div class="select-wrap">' +
                '<select id="profile-theme" name="tema"><option value="light"' + (tema === 'light' ? ' selected' : '') + '>' + MT.t('profile.theme_light') + '</option>' +
                  '<option value="dark"' + (tema === 'dark' ? ' selected' : '') + '>' + MT.t('profile.theme_dark') + '</option>' +
                  '<option value="system"' + (tema === 'system' ? ' selected' : '') + '>' + MT.t('profile.theme_system') + '</option></select></div></div>' +
              '<div class="field"><label for="profile-language">' + MT.t('profile.language') + '</label><div class="select-wrap">' +
                '<select id="profile-language" name="bahasa"><option value="id"' + (bahasa === 'id' ? ' selected' : '') + '>' + MT.t('profile.language_indonesian') + '</option>' +
                  '<option value="en"' + (bahasa === 'en' ? ' selected' : '') + '>English</option></select></div></div>' +
              '</div>' +
              '<div class="panel-foot panel-foot-actions">' +
                '<button type="submit" class="btn btn-primary">' + MT.labelTombolKerja('Simpan perubahan') + '</button>' +
              '</div>' +
            '</form>' +
          '</section>' +
          '<section class="panel">' +
            '<div class="panel-head"><h3>' + MT.t('profile.password_title') + '</h3><p>' + MT.t('profile.password_current_help') + '</p></div>' +
            '<form class="panel-pad" data-form-modul="profile-password">' +
              '<div class="field"><label for="profile-current-password">' + MT.t('profile.password_current') + '</label>' +
                '<input id="profile-current-password" name="currentPassword" type="password" autocomplete="current-password" maxlength="128" required></div>' +
              '<div class="field"><label for="profile-new-password">' + MT.t('profile.password_new') + '</label>' +
                '<input id="profile-new-password" name="newPassword" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></div>' +
              '<div class="field"><label for="profile-confirm-password">' + MT.t('profile.password_confirm') + '</label>' +
                '<input id="profile-confirm-password" name="confirmPassword" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></div>' +
              '<div class="panel-foot panel-foot-actions">' +
                '<button type="submit" class="btn btn-primary">' + MT.labelTombolKerja('Perbarui kata sandi') + '</button>' +
              '</div>' +
            '</form>' +
          '</section>' +
        '</div>' +
        '<aside class="stack">' +
          '<section class="panel">' +
            '<div class="panel-head"><h3>' + MT.t('profile.identity') + '</h3></div>' +
            '<div class="panel-pad">' +
              '<div style="display:flex;align-items:center;gap:14px;margin-bottom:18px">' +
                MT.avatar(u.nama, 'avatar-lg') +
                '<div><strong style="display:block;font-size:15px">' + MT.esc(u.nama) + '</strong>' +
                '<span class="muted-sm">' + MT.esc(u.email) + '</span></div>' +
              '</div>' +
              '<dl class="def-list">' +
                '<div class="def-row"><dt>' + MT.t('profile.role') + '</dt><dd>' + MT.t(u.role === 'owner' ? 'role.owner' : 'role.user') + '</dd></div>' +
                '<div class="def-row"><dt>' + MT.t('profile.status') + '</dt><dd>' + MT.t(orangnya.statusAkun === 'Nonaktif' ? 'profile.inactive' : 'profile.active') + '</dd></div>' +
                '<div class="def-row"><dt>' + MT.t('nav.manajemen_tugas') + '</dt><dd>' + Number(hitungan.tasks || 0) + ' ' + MT.t('profile.data_suffix') + '</dd></div>' +
                '<div class="def-row"><dt>' + MT.t('nav.manajemen_laporan') + '</dt><dd>' + Number(hitungan.reports || 0) + ' ' + MT.t('profile.data_suffix') + '</dd></div>' +
                '<div class="def-row"><dt>' + MT.t('nav.pengingat') + '</dt><dd>' + Number(hitungan.reminders || 0) + ' ' + MT.t('profile.data_suffix') + '</dd></div>' +
              '</dl>' +
            '</div>' +
          '</section>' +
        '</aside>' +
      '</div>';
  }

  function nilaiForm(form, nama) {
    var field = form.elements.namedItem(nama);
    return field ? field.value : '';
  }

  MT.penanganForm.profil = function (konteks) {
    var form = konteks.form;
    var tombol = konteks.tombol;
    var nama = nilaiForm(form, 'nama').trim();
    var tema = nilaiForm(form, 'tema');
    var bahasa = nilaiForm(form, 'bahasa');
    var pengguna = MT.store.penggunaAktif();
    MT.setTombolLoading(tombol, true, 'Menyimpan...');

    var perbaruiNamaAuth = nama === pengguna.nama
      ? Promise.resolve()
      : Promise.resolve().then(function () {
          return MT.neonAuthClient.updateUser({ name: nama });
        }).then(function (hasil) {
          if (hasil && hasil.error) throw hasil.error;
        });

    perbaruiNamaAuth.then(function () {
      return MT.store.simpanProfil({ nama: nama, tema: tema, bahasa: bahasa });
    }).then(function () {
      MT.theme.set(tema);
      MT.applyTheme();
      return MT.i18n.setLocale(bahasa);
    }).then(function () {
      MT.toast('success', MT.t('profile.saved_title'), MT.t('profile.saved_desc'));
      MT.renderRute();
    }).catch(function (error) {
      console.error('Pembaruan pengaturan akun gagal.', error);
      MT.toast('error', MT.t('profile.save_error_title'),
        (error && error.pesan) || (error && error.message) || MT.t('profile.save_error_desc'));
    }).finally(function () {
      MT.setTombolLoading(tombol, false);
    });
  };

  MT.penanganForm['profile-password'] = function (konteks) {
    var form = konteks.form;
    var tombol = konteks.tombol;
    var currentPassword = nilaiForm(form, 'currentPassword');
    var newPassword = nilaiForm(form, 'newPassword');
    var confirmPassword = nilaiForm(form, 'confirmPassword');
    if (newPassword.length < 8 || newPassword.length > 128) {
      MT.toast('error', MT.t('profile.password_invalid_title'), MT.t('profile.password_invalid_desc'));
      form.elements.namedItem('newPassword').focus();
      return;
    }
    if (newPassword !== confirmPassword) {
      MT.toast('error', MT.t('profile.password_mismatch_title'), MT.t('profile.password_mismatch_desc'));
      form.elements.namedItem('confirmPassword').focus();
      return;
    }

    MT.setTombolLoading(tombol, true, 'Memperbarui...');
    Promise.resolve().then(function () {
      return MT.neonAuthClient.changePassword({
        currentPassword: currentPassword,
        newPassword: newPassword,
        revokeOtherSessions: true
      });
    }).then(function (hasil) {
      if (hasil && hasil.error) throw hasil.error;
      form.reset();
      MT.toast('success', MT.t('profile.password_updated_title'), MT.t('profile.password_updated_desc'));
    }).catch(function (error) {
      console.error('Perubahan kata sandi gagal.', error);
      MT.toast('error', MT.t('profile.password_update_error_title'),
        (error && error.message) || MT.t('profile.password_update_error_desc'));
    }).finally(function () {
      MT.setTombolLoading(tombol, false);
    });
  };

  MT.rute.profil = {
    judul: function () { return MT.t('profile.title'); },
    remah: function () { return [{ label: MT.t('breadcrumb.dashboard'), rute: 'dashboard' }, { label: MT.t('profile.title') }]; },
    render: renderProfil
  };
})(window.MT);
