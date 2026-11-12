# Management Tugas

Aplikasi web untuk mengelola tugas, laporan, dan pengingat dengan Neon Managed Auth dan PostgreSQL di Neon. Antarmuka yang ada tetap menggunakan HTML, CSS, JavaScript, dan routing hash.

## Persyaratan

- Node.js 22.12 atau lebih baru
- Akun/proyek Neon PostgreSQL
- Untuk deployment: akun Vercel

## Struktur proyek

- `api/`, `lib/`, `assets/`, dan file HTML di root berisi aplikasi.
- `database/` berisi skema, migrasi, dan pemeriksaan database.
- `scripts/` berisi perintah proyek yang tersedia melalui `npm run`.
- `tools/diagnostics/` dan `tools/maintenance/` berisi utilitas pemeriksaan dan skrip pemeliharaan manual; skrip ini bukan bagian dari startup atau deployment aplikasi.
- `docs/` berisi dokumentasi dan ringkasan implementasi.
- File konfigurasi yang perlu ditemukan tool dari root (seperti `package.json`, `server.js`, `vite.auth.config.js`, dan `playwright.config.js`) tetap berada di root.
- File `.env*` tetap berada di root untuk pemuatan konfigurasi lokal dan tidak dipindahkan atau dimasukkan ke Git.

## Konfigurasi lokal

1. Pasang dependensi:

   ```powershell
   npm install
   ```

2. Buat `.env.local` di root proyek dan isi `DATABASE_URL` dengan connection string PostgreSQL pooled serta `NEON_AUTH_BASE_URL` dengan Auth Base URL dari cabang Neon yang sama. Aplikasi hanya membaca `NEON_AUTH_BASE_URL`; jangan mengatur alias `NEON_AUTH_URL` kedua. Jika kredensial pernah dibagikan, rotasi dahulu lalu masukkan nilai baru secara lokal—jangan mengirimkannya ke chat. Loader membaca `.env.local` dari lokasi proyek sehingga tidak bergantung pada current working directory. Nilai environment non-kosong yang disediakan shell/platform menang atas file lokal; nilai kosong pada file tidak menimpa nilai yang sudah disediakan. Nilai konfigurasi hanya dibaca server dan tidak disisipkan ke JavaScript browser.

   Neon Managed Auth harus sudah aktif pada cabang tersebut. Aktifkan verifikasi email di pengaturan Neon Auth dan daftarkan domain aplikasi pada trusted domains. `.env.local` diabaikan Git. `.env.example` hanya contoh dan bukan kredensial yang dapat dipakai.

   `DATABASE_URL` adalah koneksi PostgreSQL backend yang dipakai untuk query, CRUD, dan transaksi. `NEON_DATA_API_URL` tidak dipakai oleh aplikasi ini: semua endpoint data memanggil backend Node.js, yang memeriksa sesi/otorisasi lalu memakai SQL. Jangan mengganti `DATABASE_URL` dengan URL Data API dan jangan mengirim URL/kredensial koneksi database ke browser. Jika Data API kelak dipilih untuk kompatibilitas PostgREST, konfigurasikan autentikasi Neon Auth atau provider JWT eksternal beserta role/grant dan kebijakan akses tabel yang sesuai terlebih dahulu; jangan mengekspos endpoint tanpa autentikasi atau mengandalkan URL sebagai kredensial.

3. Untuk database baru, terapkan migrasi SQL **secara berurutan** melalui Neon SQL Editor:

   1. `database/migrations/001_initial_schema.sql`
   2. `database/migrations/002_legacy_owner_column.sql`
   3. `database/migrations/003_neon_auth_subject.sql`
   4. `database/migrations/004_account_preferences.sql`
   5. `database/migrations/005_activity_analytics.sql`

   Terapkan migrasi secara berurutan pada database produksi sebelum rilis. Server lokal memeriksa dan menerapkan migrasi yang belum tercatat saat mulai; `npm run migrate` menjalankan mekanisme yang sama. Jika database berisi data lama, tinjau skema dan buat cadangan terlebih dahulu. Migrasi kedua menyalin nilai `owner_id` lama ke `created_by` apabila kolom tersebut tersedia. Migrasi ketiga menambahkan linkage identitas Neon Auth ke profil aplikasi. Migrasi keempat menambahkan preferensi tema dan bahasa yang nullable agar pilihan lokal pengguna lama tetap digunakan sampai disimpan ke profil akun. Migrasi kelima menambah `activity_events` dan mengisi event `dibuat`, `diubah`, serta `selesai` dari tugas, laporan, dan pengingat yang telah ada. Backfill memakai `source_key` unik dan `ON CONFLICT DO NOTHING`, jadi file SQL aman dijalankan ulang dan tidak mengubah tabel lama. Untuk Neon SQL Editor, jalankan `database/migrations/005_activity_analytics.sql` setelah migrasi keempat; secara lokal gunakan `npm run migrate`. Indeks email tanpa membedakan huruf besar/kecil dapat gagal jika sudah ada email duplikat setelah dinormalisasi; selesaikan duplikasi sebelum menjalankan migrasi.

   Untuk database lama dengan kolom `users.nama`, `users.status_akun`, dan kolom pemilik bernama `pemilik_id`, **jangan** jalankan migrasi awal di atas. Tinjau dan jalankan `database/migrations/legacy_schema_upgrade.sql` sebagai jalur migrasi tersendiri setelah membuat backup/branch Neon, lalu jalankan `003_neon_auth_subject.sql`, `004_account_preferences.sql`, dan `005_activity_analytics.sql`. Migrasi upgrade mempertahankan tabel lama dengan nama `management_legacy_*_backup`; sesudah migrasi berhasil, sesi login lama perlu dibuat kembali.

4. Buat profil Owner pertama setelah migrasi berhasil:

   ```powershell
   npm run bootstrap:owner
   ```

   Nama dan email dimasukkan secara interaktif. Skrip tidak membuat profil jika Owner sudah tersedia. Profil Owner yang ada dan hash kata sandi legacy tetap dipertahankan. Kredensial login baru dibuat melalui Neon Auth menggunakan alamat email terverifikasi yang sama.

   Pemilik dapat mendaftar memakai email terverifikasi yang sama dengan profil Owner yang baru disiapkan. Pendaftar baru dapat membuat profil akun langsung melalui formulir aplikasi; role awal selalu `User`. Jika verifikasi email diwajibkan, profil dibuat saat pengguna kembali dan masuk setelah verifikasi. Hash kata sandi lokal lama tidak dihapus atau digunakan lagi untuk autentikasi.

5. Jalankan aplikasi:

   ```powershell
   npm run dev
   ```

   Buka `http://localhost:3000`. `npm run dev` membangun browser SDK Auth lalu menjalankan server; `npm start` menjalankan server tanpa tahap build. `npm run bootstrap:owner` menggunakan loader environment yang sama. Server melayani `index.html`, aset di `/assets`, dan halaman pintasan HTML yang tersedia; routing modul menggunakan hash URL. Berkas source, konfigurasi, migrasi, dan environment tidak disajikan sebagai file statis. Jalankan `npm test` untuk menguji aplikasi lokal. `GET /api/health` menjalankan `SELECT 1` lalu memeriksa kolom inti data. Respons HTTP 503 membedakan `DATABASE_NOT_CONFIGURED`, `DATABASE_URL_INVALID`, `DATABASE_AUTHENTICATION_FAILED`, `DATABASE_CONNECTION_FAILED`, dan `DATABASE_SCHEMA_INCOMPLETE`; hanya koneksi dan schema lengkap yang sehat. Endpoint lama `/api/test-db` tidak digunakan.

## Deployment Vercel

1. Hubungkan proyek ini ke Vercel.
2. Atur `DATABASE_URL`, `NEON_AUTH_BASE_URL`, dan (opsional) `ACTIVITY_TIMEZONE` di Project Settings → Environment Variables untuk setiap environment Vercel (Production, Preview, Development) yang akan digunakan. Zona waktu bawaan adalah `Asia/Jakarta`. Gunakan connection string PostgreSQL Neon pooled untuk request aplikasi; `.env.local` lokal tidak otomatis tersedia pada deployment. Jangan masukkan connection string direct yang hanya diperlukan untuk migrasi. Aktifkan verifikasi email Neon Auth dan daftarkan domain production/preview sebagai trusted domains.
3. Terapkan migrasi secara manual di Neon SQL Editor: untuk database baru gunakan `001_initial_schema.sql` hingga `005_activity_analytics.sql` secara berurutan; untuk database lama gunakan jalur `legacy_schema_upgrade.sql`, lalu `003_neon_auth_subject.sql`, `004_account_preferences.sql`, dan `005_activity_analytics.sql` seperti dijelaskan di atas. Jalankan bootstrap Owner hanya jika belum ada Owner. Jangan mengunggah `.env.local`.
4. Deploy. API tersedia di bawah `/api`; `GET /api/health` memeriksa konektivitas database serta keberadaan tabel/kolom yang dipakai aplikasi.

Vercel CLI tidak disertakan sebagai dependensi proyek. Untuk pengembangan lokal gunakan `npm run dev`; deployment dilakukan melalui integrasi Git Vercel.

## API dan akses

- `/api/neon-auth/*` meneruskan permintaan SDK ke Neon Auth menggunakan URL yang hanya tersedia pada server.
- `GET /api/auth/me` memverifikasi JWT EdDSA terhadap JWKS Neon dan memetakan subjek identitas terverifikasi ke profil aplikasi.
- `POST /api/auth/register` membuat profil role `user` untuk identitas Neon Auth yang emailnya sudah diverifikasi; pendaftaran tidak dapat memberikan role Owner.
- `GET /api/bootstrap` memuat data yang telah difilter oleh server.
- `/api/tasks`, `/api/reports`, dan `/api/reminders` menyediakan operasi CRUD.
- `/api/users` menyediakan operasi CRUD untuk Owner.
- `GET /api/activity` mengambil aktivitas yang boleh dilihat pengguna.
- `GET /api/activity/summary` menyediakan agregat analitik aktivitas dengan filter rentang waktu dan anggota khusus Owner.
- `GET /api/health` menguji konektivitas database dan keberadaan kolom skema yang dibutuhkan aplikasi.

Neon Auth menjadi satu-satunya penyedia login, logout, dan session. Browser memulihkan session melalui SDK, lalu mengirim JWT singkat ke API; backend memvalidasi tanda tangan, issuer, audience, role token dasar, serta masa berlaku sebelum memproses data. Setelah logout, session Neon Auth diakhiri; JWT stateless yang sudah diterbitkan dapat tetap valid sampai kedaluwarsa (maksimal 15 menit), sesuai dokumentasi Neon.

Tabel `users` tetap menjadi registry profil, role, dan status aplikasi. Kolom nullable `auth_subject` menghubungkan profil dengan subjek Neon Auth terverifikasi; profil lama yang belum tertaut dapat dikaitkan melalui kecocokan email terverifikasi tanpa mengubah nama, role, atau statusnya. Jika tidak ada profil lama, backend membuat profil baru dengan role `user` yang ditetapkan server. Role `owner`/`user` selalu diambil dari database, bukan dari JWT atau formulir. Pembuatan identitas Neon Auth dan profil PostgreSQL adalah dua operasi lintas layanan, bukan transaksi atomik: jika profil gagal disimpan setelah identitas dibuat, pengguna dapat masuk kembali setelah email diverifikasi dan aplikasi akan mencoba menyelesaikan provisioning lagi. Verifikasi email wajib diaktifkan pada konfigurasi Neon Auth.

Hash `password_hash` dan session lama tidak dihapus oleh integrasi ini. Endpoint login bcrypt lama sudah tidak aktif dan hash legacy tidak lagi digunakan untuk autentikasi. Kata sandi baru disimpan/dikelola oleh Neon Auth; kolom `password_hash` yang diwajibkan skema lama hanya menerima hash bcrypt dari nilai acak yang tidak dapat dipakai sebagai kredensial. Formulir kelola pengguna tidak lagi meminta atau mengubah kata sandi legacy.

Otorisasi dan kepemilikan record diperiksa di server, bukan hanya melalui menu antarmuka.

### Daftar, rekap, dan perubahan Owner

Endpoint daftar `GET /api/users`, `/api/tasks`, `/api/reports`, dan `/api/reminders` memakai pagination server-side. Parameter `page` dimulai dari 1, `pageSize` dibatasi 1–100 (default API 8), `q` untuk pencarian, `status` untuk status, serta `role` khusus daftar pengguna. `sort` hanya menerima kolom yang diizinkan endpoint. Respons memuat `items` dan metadata `pagination` (`page`, `pageSize`, `total`, `totalPages`, `hasPrevious`, `hasNext`). Jumlah dan baris halaman dibaca dalam satu transaksi snapshot; pengurutan selalu memakai ID sebagai pemecah seri agar hasil deterministik.

`GET /api/bootstrap` mengembalikan agregat hitungan dashboard dan daftar prioritas terbatas, bukan kumpulan data yang terpotong. `GET /api/reports/summary` menghitung rekap seluruh laporan dalam bulan atau rentang tanggal, dengan maksimal 10 item pratinjau. Fitur ekspor membaca halaman berikutnya sampai seluruh hasil terambil.

Perubahan atau penghapusan pengguna mengirim `expectedUpdatedAt` dari versi data yang ditampilkan. Jika data sudah berubah, API mengembalikan `409 USER_CHANGED`; aplikasi harus memuat ulang sebelum pengguna mencoba lagi. Perubahan status/role Owner, penghapusan Owner, dan bootstrap Owner pertama memakai advisory lock transaksi yang sama. Tes integrasi memverifikasi bahwa permintaan konkuren tidak dapat menonaktifkan atau menghapus Owner aktif terakhir.

Tes unit dijalankan dengan `npm test`. Pagination memakai `LIMIT/OFFSET` tanpa batas 500; integrasi opt-in menguji 1.237 record untuk setiap daftar, CRUD API, dan perubahan Owner konkuren. Untuk menjalankannya, siapkan database disposable yang namanya secara jelas mengandung `test`, terapkan skema canonical, dan pastikan seluruh tabel data kosong. Atur `TEST_DATABASE_URL` hanya di environment lokal/CI yang aman, lalu jalankan `npm test`; jangan gunakan URL database produksi atau database aktif yang menyimpan data. Tes akan menolak nama database yang tidak sesuai dan database yang tidak kosong.

## Keamanan

- Security headers: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, dan `Strict-Transport-Security` di production.
- Rate limiting: login 5 percobaan per 15 menit, registrasi 3 per 24 jam, API umum 120 permintaan per 60 detik.
- Neon Auth memulihkan sesi persisten sebelum layar login ditampilkan; navigasi hash tetap dipertahankan saat refresh. Logout manual meminta konfirmasi dan disinkronkan ke tab lain. Session timeout aplikasi tetap 30 menit tanpa aktivitas, dengan peringatan 5 menit sebelumnya.
- Perubahan kata sandi dibatasi hingga 5 percobaan per 15 menit per alamat IP, selain pemeriksaan kredensial oleh Neon Auth.
- Pengaturan Akun memperbarui nama, tema, dan bahasa pada profil aplikasi; ganti kata sandi melalui Neon Auth memerlukan kata sandi saat ini dan membatasi sesi lain. Email dan role bersifat baca-saja.
- Dashboard Aktivitas membaca agregat dari `activity_events`; role User selalu dibatasi ke ID sesi terverifikasi, sedangkan Owner dapat melihat tim atau memilih anggota tanpa mengirim email atau atribut sensitif. Event perubahan data ditulis server-side setelah mutasi berhasil; bila pencatatan analitik gagal, mutasi utama dan audit `activity_logs` tetap berhasil.
- Perubahan tugas, laporan, pengingat dan login email yang berhasil dicatat sebagai event. Tenggat dan waktu dikelompokkan memakai `ACTIVITY_TIMEZONE` (bawaan `Asia/Jakarta`). Skema saat ini tidak memiliki prioritas maupun kategori tugas, jadi dashboard tidak menampilkan breakdown palsu untuk keduanya.
- CSRF protection: disiapkan untuk cookie-based auth; Bearer token Neon Auth tidak memerlukan CSRF token.
- `X-Powered-By` dinonaktifkan; request ID ditambahkan untuk tracing.

## Observabilitas

- Request logging: semua request dicatat dengan method, URL, status, durasi, dan request ID. Error 5xx dan slow requests (>1s) dicetak ke `stderr`.
- Frontend performance marks: setiap transisi route diukur menggunakan `performance.mark()` dan `performance.measure()`.
- Database retry: query dan transaksi otomatis retry untuk error transien (`ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND`, `ECONNREFUSED`, `57P01`, `53300`) dengan exponential backoff.

## Frontend Performance

- Lazy loading: modul non-kritis (`catatan`, `aktivitas`, `pengguna`) dimuat secara dinamis saat route pertama kali diakses.
- Request deduplication: permintaan API yang sama tidak dijalankan berkali-kali secara bersamaan.
- Error handling: `unhandledrejection` ditangkap dan ditampilkan sebagai toast.

## Database Quality

- Index tambahan untuk query patterns umum: `(created_by, status)` pada tabel records, `(actor_id, occurred_at DESC)` pada `activity_logs`, dan partial index untuk sessions aktif.
- Query optimasi: `getUser` menggunakan `LEFT JOIN` aggregated statt subquery correlated untuk menghitung jumlah record.
- Database retry: lihat Observabilitas.

- Aturan akses sementara: Owner dapat melihat semua record; User hanya record yang dibuatnya.
- Status tugas/laporan (`Belum Dimulai`, `Sedang Dikerjakan`, `Selesai`) dan pengingat (`Aktif`, `Nonaktif`, `Selesai`) mengikuti antarmuka saat ini.
- Pengingat disimpan sebagai data; belum ada jadwal pemicu atau pengiriman notifikasi otomatis.
- Kebijakan backup/retensi, pemulihan, dan observabilitas belum dikonfigurasi.

Jangan gunakan data produksi sampai migrasi, pembuatan Owner, kebijakan akses, dan pengaturan backup/deployment ditinjau untuk kebutuhan operasional.
#   m a n a g e m e n T u g a s . i d  
 