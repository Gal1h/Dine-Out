# DineOut: Plan dan Prompt Pengembangan (v2: React + Node.js + MySQL)

Aplikasi web untuk mengatur pemesanan makan/minum bersama dalam sebuah grup. Admin membuat grup, membuat akun member, mengadakan voting tempat makan, lalu menghitung tagihan dan subsidi berdasarkan form pesanan yang diisi anggota.

Target platform: **web responsif** (mobile-first), dapat dipasang sebagai PWA di Android dan iOS.

---

## 1. Ringkasan Teknis

| Komponen | Teknologi |
|---|---|
| Frontend | React 18+ dengan Vite, TypeScript |
| Routing | React Router |
| Styling | Tailwind CSS, dengan komponen dari shadcn/ui (dimodifikasi sesuai token tema sendiri) |
| State server | TanStack Query (React Query) |
| State lokal | Zustand (hanya untuk state UI, misalnya sesi login di sisi klien) |
| Form | React Hook Form + Zod |
| Backend | Node.js (LTS) dengan Express, TypeScript |
| Database | MySQL 8.x |
| ORM / query | Prisma (atau Drizzle, jika ingin SQL lebih dekat ke query mentah) |
| Validasi bersama | Zod schema di folder `shared/`, dipakai di frontend dan backend |
| Autentikasi | JWT di cookie `httpOnly` (access token pendek + refresh token), password di-hash dengan bcrypt |
| Penyimpanan file (screenshot menu) | Disk server (folder `uploads/`) dengan `sharp` untuk kompresi, atau S3-compatible storage jika nanti di-deploy ke cloud |
| AI | Gemini API (Google), dipanggil dari backend Node.js |
| Enkripsi key Gemini | AES-256-GCM, kunci enkripsi dari environment variable |
| Deploy (saran) | Frontend di static hosting atau dilayani Express, backend dan MySQL di VPS atau platform container |

### Catatan arsitektur penting

- **Waktu deadline ditentukan server.** Backend membandingkan deadline dengan waktu server, bukan dengan jam perangkat. Zona waktu tampilan: Asia/Jakarta (UTC+07:00). Simpan semua timestamp dalam UTC di MySQL (`DATETIME`), konversi ke Asia/Jakarta hanya di tampilan.
- **Otorisasi dilakukan di backend.** Setiap endpoint memeriksa sesi, keanggotaan grup, dan role. Tidak ada akses langsung dari klien ke database.
- **Gemini API key disimpan terenkripsi di MySQL** (kolom `gemini_key_encrypted`, `gemini_key_iv`, `gemini_key_tag` di tabel `users`). Key hanya didekripsi di server saat dibutuhkan, dan tidak pernah dikirim balik ke klien. Di UI, key hanya bisa diganti atau dihapus, tidak bisa dilihat ulang.
- **Akun member dengan username dan password.** Tidak perlu email. Username unik per grup (`UNIQUE (group_id, username)`). Login dilakukan dengan memilih grup, lalu username dan password. Token sesi memuat `groupId` untuk akun member, dan setiap request grup memverifikasi keanggotaan di tabel `group_members`.
- **Keamanan dasar:** rate limit pada endpoint login, helmet untuk header HTTP, validasi input di setiap endpoint dengan Zod, dan query lewat ORM untuk mencegah SQL injection.

---

## 2. Role dan Hak Akses

| Aksi | Admin (pembuat grup) | Mod | Member |
|---|:-:|:-:|:-:|
| Membuat grup | ✅ | ❌ | ❌ |
| Membuat akun member (bulk) | ✅ | ❌ | ❌ |
| Memberi/mencabut tag mod | ✅ | ❌ | ❌ |
| Membuat voting tempat makan | ✅ | ✅ | ❌ |
| Mengedit voting selama belum timeout | ✅ | ✅ | ❌ |
| Mengisi form pesanan | ✅ | ✅ | ✅ (setelah voting selesai) |
| Melihat rekap form pesanan | ✅ | ✅ | ❌ |
| Sortir pesanan dengan Gemini AI | ✅ | ❌ | ❌ |
| Membuat tagihan dan subsidi | ✅ | ❌ | ❌ |
| Mengisi Gemini API key di pengaturan | ✅ | ❌ | ❌ |

---

## 3. Model Data (MySQL)

Data pesanan dan tagihan dinormalisasi ke tabel terpisah agar bisa di-query dan dijumlahkan dengan SQL.

### 3.1 DDL (ringkasan)

```sql
CREATE TABLE users (
  id              CHAR(36)     PRIMARY KEY,           -- UUID
  account_type    ENUM('admin','member') NOT NULL,
  email           VARCHAR(255) NULL UNIQUE,           -- hanya admin
  password_hash   VARCHAR(255) NOT NULL,
  display_name    VARCHAR(100) NOT NULL,
  gemini_key_encrypted VARBINARY(512) NULL,           -- hanya admin, terenkripsi
  gemini_key_iv        VARBINARY(16)  NULL,
  gemini_key_tag       VARBINARY(16)  NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE groups (
  id          CHAR(36)     PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  admin_id    CHAR(36)     NOT NULL,
  timezone    VARCHAR(40)  NOT NULL DEFAULT 'Asia/Jakarta',
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id)
);

CREATE TABLE group_members (
  group_id     CHAR(36)     NOT NULL,
  user_id      CHAR(36)     NOT NULL,
  role         ENUM('admin','mod','member') NOT NULL,
  username     VARCHAR(50)  NULL,                     -- untuk akun member
  joined_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, user_id),
  UNIQUE KEY uq_group_username (group_id, username),
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE
);

CREATE TABLE votes (
  id              CHAR(36)     PRIMARY KEY,
  group_id        CHAR(36)     NOT NULL,
  store_name      VARCHAR(150) NOT NULL,
  maps_url        VARCHAR(500) NOT NULL,
  menu_text       TEXT         NULL,
  menu_image_path VARCHAR(255) NULL,                  -- path file di storage
  vote_deadline   DATETIME     NOT NULL,              -- UTC
  order_deadline  DATETIME     NOT NULL,              -- UTC
  created_by      CHAR(36)     NOT NULL,
  updated_by      CHAR(36)     NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  CHECK (order_deadline > vote_deadline)
);
-- Status (open / ordering / closed) dihitung dari waktu server, tidak disimpan.

CREATE TABLE vote_orders (
  id           CHAR(36)  PRIMARY KEY,
  vote_id      CHAR(36)  NOT NULL,
  user_id      CHAR(36)  NOT NULL,
  submitted_at DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_vote_user (vote_id, user_id),
  FOREIGN KEY (vote_id) REFERENCES votes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE vote_order_items (
  id          CHAR(36)     PRIMARY KEY,
  order_id    CHAR(36)     NOT NULL,
  item_type   ENUM('food','drink') NOT NULL,
  name        VARCHAR(150) NOT NULL,
  qty         SMALLINT UNSIGNED NOT NULL,
  note        VARCHAR(255) NULL,
  FOREIGN KEY (order_id) REFERENCES vote_orders(id) ON DELETE CASCADE
);

CREATE TABLE order_summaries (
  id          CHAR(36)  PRIMARY KEY,
  vote_id     CHAR(36)  NOT NULL,
  source      ENUM('manual','gemini') NOT NULL,
  created_by  CHAR(36)  NOT NULL,
  created_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vote_id) REFERENCES votes(id) ON DELETE CASCADE
);

CREATE TABLE order_summary_items (
  id          CHAR(36)     PRIMARY KEY,
  summary_id  CHAR(36)     NOT NULL,
  item_type   ENUM('food','drink') NOT NULL,
  name        VARCHAR(150) NOT NULL,
  total_qty   INT UNSIGNED NOT NULL,
  FOREIGN KEY (summary_id) REFERENCES order_summaries(id) ON DELETE CASCADE
);

CREATE TABLE bills (
  id          CHAR(36)  PRIMARY KEY,
  vote_id     CHAR(36)  NOT NULL,
  summary_id  CHAR(36)  NOT NULL,
  created_by  CHAR(36)  NOT NULL,                      -- selalu admin
  created_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vote_id)    REFERENCES votes(id)           ON DELETE CASCADE,
  FOREIGN KEY (summary_id) REFERENCES order_summaries(id) ON DELETE CASCADE
);

CREATE TABLE bill_prices (
  id          CHAR(36)     PRIMARY KEY,
  bill_id     CHAR(36)     NOT NULL,
  item_type   ENUM('food','drink') NOT NULL,
  name        VARCHAR(150) NOT NULL,
  price       BIGINT UNSIGNED NOT NULL,                -- Rupiah, bilangan bulat
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
);

CREATE TABLE bill_user_totals (
  id             CHAR(36)  PRIMARY KEY,
  bill_id        CHAR(36)  NOT NULL,
  user_id        CHAR(36)  NOT NULL,
  food_total     BIGINT UNSIGNED NOT NULL DEFAULT 0,
  drink_total    BIGINT UNSIGNED NOT NULL DEFAULT 0,
  food_subsidy   BIGINT UNSIGNED NOT NULL DEFAULT 0,
  drink_subsidy  BIGINT UNSIGNED NOT NULL DEFAULT 0,
  food_payable   BIGINT UNSIGNED NOT NULL DEFAULT 0,   -- max(0, food_total - food_subsidy)
  drink_payable  BIGINT UNSIGNED NOT NULL DEFAULT 0,   -- max(0, drink_total - drink_subsidy)
  payable        BIGINT UNSIGNED NOT NULL DEFAULT 0,   -- food_payable + drink_payable
  UNIQUE KEY uq_bill_user (bill_id, user_id),
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Catatan:**
- Nilai uang disimpan sebagai `BIGINT` dalam Rupiah utuh, bukan `DECIMAL` atau `FLOAT`, karena Rupiah tidak memakai pecahan.
- `payable` dan turunannya dihitung di backend saat tagihan dibuat, lalu disimpan sebagai snapshot. Dengan begitu, tagihan yang sudah dibagikan tidak berubah jika harga atau pesanan diubah setelahnya.
- Status voting (`open`, `ordering`, `closed`) dihitung dari `vote_deadline`, `order_deadline`, dan waktu server, jadi tidak disimpan sebagai kolom.

---

## 4. Alur Kerja Detail

### 4.1 Autentikasi dan grup
1. **Admin** daftar atau login dengan email dan password. Password di-hash dengan bcrypt (cost minimal 12).
2. Admin membuat **grup** dengan nama. Backend otomatis menambahkan admin ke `group_members` dengan role `admin`.
3. Dari halaman grup, admin dapat **membuat akun member secara bulk**:
   - Form dinamis: tambah baris (username, password, display name).
   - Username harus unik dalam grup (dicek di backend dan dijaga oleh constraint database).
   - Password minimal 8 karakter.
   - Admin bisa melihat daftar akun yang dibuat dan mengatur ulang password member.
   - Pembuatan bulk berjalan dalam satu transaksi database, sehingga jika satu baris gagal, seluruh batch dibatalkan.
4. Member login dengan **pilih grup, lalu username dan password**. Member bisa mengganti password sendiri.
5. Admin dapat memberi tag **mod** ke member lewat daftar anggota. Mod bisa dicabut kapan saja.

### 4.2 Membuat voting tempat makan
1. Admin atau mod membuka grup dan menekan **"Buat Voting"**.
2. Field yang diisi:
   - Nama toko (wajib)
   - Link Google Maps (wajib, divalidasi formatnya di frontend dan backend)
   - Screenshot menu (opsional, diunggah ke backend, dikompres dengan `sharp` ke WebP sebelum disimpan, maksimal 5 MB sebelum kompresi)
   - Menu dalam bentuk teks (opsional, text area). Minimal salah satu dari screenshot atau teks menu harus diisi.
   - **Batas waktu voting** (tanggal dan jam, zona Asia/Jakarta, dikonversi ke UTC di backend)
   - **Batas waktu isi form menu** (harus setelah batas voting)
3. Voting berstatus `open` sampai `vote_deadline` terlewati.
4. Saat voting `open`, admin atau mod dapat **mengedit** semua field di atas. Backend mengisi `updated_by` dan `updated_at`.
5. Backend menolak edit jika `vote_deadline` sudah lewat, dengan respons error yang jelas.

### 4.3 Pengisian form pesanan
1. Setelah `vote_deadline` lewat, status berubah ke `ordering`. Member melihat form pesanan.
2. Form berisi dua bagian: **Makanan** dan **Minuman**. Setiap bagian bisa berisi beberapa item (nama, jumlah, catatan opsional).
3. Member bisa mengedit pesanannya sampai `order_deadline`. Saat menyimpan, backend menghapus item lama dan menulis item baru dalam satu transaksi.
4. Setelah `order_deadline`, form terkunci dan status menjadi `closed`.
5. Member yang belum mengisi form ditampilkan di daftar "Belum pesan", agar admin bisa mengingatkan.

### 4.4 Rekap dan sortir pesanan
Admin atau mod melihat rekap semua pesanan. Ada dua cara sortir:

**a. Manual**
- Admin melihat daftar pesanan mentah dan menggabungkan item secara manual (misalnya "Nasi goreng" dari 3 orang = 3).
- Hasil disimpan ke `order_summaries` dengan `source = 'manual'` dan itemnya ke `order_summary_items`.

**b. Gemini AI**
- Admin menekan "Sortir dengan AI". Jika Gemini API key belum diisi di pengaturan, tombol mengarahkan admin ke halaman Pengaturan.
- Frontend memanggil `POST /api/votes/:id/summaries/ai`. Backend membaca semua order dari MySQL, mendekripsi key, lalu memanggil Gemini dari server.
- Prompt meminta output JSON terstruktur: `foodTotals` dan `drinkTotals`. Backend memvalidasi JSON dengan Zod sebelum dikembalikan ke klien. Jika JSON tidak valid, backend mencoba sekali lagi, lalu mengembalikan error.
- Hasil ditampilkan ke admin untuk **direview dan diedit** sebelum disimpan. AI bisa salah menggabungkan nama item.
- Setelah disimpan, hasil dengan `source = 'gemini'` masuk ke `order_summaries`.
- Jika key salah atau kuota Gemini habis, backend mengembalikan pesan error yang jelas dan admin tetap bisa sortir manual.
- Key tidak pernah dicatat di log server. Logger dikonfigurasi untuk menyensor header dan field yang berisi key.

### 4.5 Tagihan dan subsidi
Tagihan hanya bisa dibuat oleh **admin**.

1. Admin membuka rekap yang sudah disimpan, lalu menekan **"Buat Tagihan"**.
2. Admin mengisi **daftar harga** per item, bisa diambil dari menu teks atau diisi manual. Setiap item diberi tipe: makanan atau minuman.
3. Backend menghitung total per user dari pesanannya:
   - `food_total` = jumlah (harga makanan × qty) dari pesanan user
   - `drink_total` = jumlah (harga minuman × qty) dari pesanan user
4. Admin mengisi **subsidi per user** dalam dua kategori yang berdiri sendiri:
   - **Subsidi makanan** (nominal Rupiah): hanya dikurangkan dari total makanan user.
   - **Subsidi minuman** (nominal Rupiah): hanya dikurangkan dari total minuman user.
   - Admin boleh mengisi salah satu, keduanya, atau tidak sama sekali (nilai 0).
5. Backend menghitung tagihan per kategori, lalu menjumlahkannya:
   - `food_payable` = `max(0, food_total − food_subsidy)`
   - `drink_payable` = `max(0, drink_total − drink_subsidy)`
   - `payable` = `food_payable + drink_payable`
6. **Subsidi yang melebihi tagihan kategorinya hangus.** Sisa subsidi tidak dipindahkan ke kategori lain dan tidak dibawa ke tagihan berikutnya.
7. Seluruh perhitungan dan penyimpanan `bills`, `bill_prices`, dan `bill_user_totals` dilakukan dalam satu transaksi.

**Contoh 1 (subsidi minuman saja):** Andi memesan minuman Rp13.000 dan makanan Rp0. Admin memberi subsidi minuman Rp10.000. Andi membayar Rp3.000.

**Contoh 2 (subsidi makanan, sisa hangus):** Budi memesan makanan Rp8.000 dan minuman Rp5.000. Admin memberi subsidi makanan Rp10.000. Subsidi makanan hanya terpakai Rp8.000, sisa Rp2.000 hangus. Budi membayar Rp5.000 untuk minuman.

**Contoh 3 (keduanya):** Citra memesan makanan Rp20.000 dan minuman Rp13.000. Subsidi makanan Rp10.000 dan subsidi minuman Rp5.000. Citra membayar Rp10.000 untuk makanan dan Rp8.000 untuk minuman, total Rp18.000.

8. Hasil ditampilkan sebagai ringkasan per user: total makanan, subsidi makanan, bayar makanan, total minuman, subsidi minuman, bayar minuman, dan total bayar. Hasil bisa disalin sebagai teks, atau diunduh sebagai gambar (dirender di frontend dengan `html-to-image` atau sejenisnya).

---

## 5. Struktur API (ringkasan)

Semua endpoint berada di bawah `/api`. Respons error memakai format seragam `{ error: { code, message } }`.

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| POST | `/auth/admin/register` | Publik | Daftar admin |
| POST | `/auth/admin/login` | Publik | Login admin |
| POST | `/auth/member/login` | Publik | Login member (groupId, username, password) |
| POST | `/auth/logout` | Login | Hapus sesi |
| PATCH | `/auth/password` | Login | Ganti password sendiri |
| GET/POST | `/groups` | Admin (POST), login (GET) | Daftar dan buat grup |
| GET | `/groups/:id` | Anggota | Detail grup |
| POST | `/groups/:id/members/bulk` | Admin | Buat akun member bulk |
| PATCH | `/groups/:id/members/:userId/role` | Admin | Tag atau cabut mod |
| POST | `/groups/:id/members/:userId/password` | Admin | Reset password member |
| GET/POST | `/groups/:id/votes` | Admin, mod (POST) | Daftar dan buat voting |
| PATCH | `/votes/:id` | Admin, mod | Edit voting (sebelum `vote_deadline`) |
| PUT | `/votes/:id/orders/me` | Anggota | Simpan atau ubah pesanan sendiri (sebelum `order_deadline`) |
| GET | `/votes/:id/orders` | Admin, mod | Rekap pesanan dan daftar "Belum pesan" |
| POST | `/votes/:id/summaries/manual` | Admin, mod | Simpan rekap manual |
| POST | `/votes/:id/summaries/ai` | Admin | Sortir dengan Gemini (hasil belum disimpan) |
| POST | `/votes/:id/summaries/ai/save` | Admin | Simpan hasil AI yang sudah direview |
| POST | `/summaries/:id/bills` | Admin | Buat tagihan dari rekap |
| GET | `/bills/:id` | Admin | Detail tagihan |
| PUT | `/profile/gemini-key` | Admin | Simpan atau ganti Gemini API key (terenkripsi) |
| DELETE | `/profile/gemini-key` | Admin | Hapus Gemini API key |

Middleware yang dipakai: `requireAuth` (verifikasi JWT), `requireGroupMember`, `requireGroupRole(['admin','mod'])`, dan `requireDeadline('vote' | 'order')` yang membandingkan waktu server dengan deadline dari database.

---

## 6. Daftar Layar

1. **Splash / Onboarding**
2. **Login**: pilihan "Admin" (email) atau "Member" (pilih grup, username, password)
3. **Daftar Admin**
4. **Daftar Grup**: daftar grup yang diikuti, tombol buat grup
5. **Detail Grup**
   - Tab: Voting aktif, Riwayat, Anggota
6. **Kelola Anggota** (admin): tambah akun bulk, tag mod, reset password
7. **Buat / Edit Voting** (admin dan mod)
8. **Detail Voting**
   - Info toko, link Maps (membuka aplikasi Google Maps di perangkat), screenshot menu, teks menu
   - Countdown voting dan countdown form
   - Form pesanan (member)
   - Daftar pesanan masuk dan "Belum pesan" (admin dan mod)
9. **Rekap Pesanan** (admin dan mod): tampilan manual atau AI
10. **Tagihan** (admin): input daftar harga, subsidi makanan dan minuman per user, hasil per user
11. **Profil dan Pengaturan**
    - Nama, ganti password
    - Gemini API key (admin): input disembunyikan, hanya bisa diganti atau dihapus, dengan keterangan bahwa key disimpan terenkripsi di server

---

## 7. Desain UI/UX

**Arah visual: simple, modern, dan tidak terlihat seperti hasil generasi AI.**

Hindari ciri umum desain AI: gradien ungu-biru, glassmorphism berlebihan, ikon emoji sebagai elemen utama, sudut yang terlalu membulat di semua elemen, dan teks marketing yang generik.

Arah yang disarankan:
- **Palet terbatas**: satu warna aksen hangat (misalnya oranye tanah atau merah bata) di atas netral (off-white, abu-abu hangat, hitam kebiruan). Hindari lebih dari dua warna aksen. Token warna didefinisikan sebagai CSS variable dan dikonfigurasi di Tailwind.
- **Tipografi**: satu keluarga font untuk UI (misalnya Inter atau Manrope) dengan skala ukuran yang jelas. Angka harga dan jumlah pakai font dengan digit tabular (`font-variant-numeric: tabular-nums`).
- **Layout**: mobile-first, banyak ruang kosong, tepi tegas, pembatas tipis, bukan kartu bayangan berlapis. Pada layar lebar, konten dibatasi lebarnya agar tetap mudah dibaca.
- **Komponen**: gunakan komponen dari shadcn/ui sebagai titik awal, tetapi sesuaikan dengan token tema sendiri. Jangan membuat semua komponen terlihat sama.
- **Ikon**: satu set ikon konsisten (misalnya Lucide), bukan emoji.
- **Copy (teks)**: bahasa Indonesia yang singkat dan langsung, misalnya "Batas voting: 19.00, 12 Nov" dan bukan kalimat motivasi.
- **Mode gelap**: didukung lewat token tema, tetapi bukan fitur utama di versi pertama.
- **Motion**: transisi secukupnya, misalnya perubahan status voting, bukan animasi di setiap elemen. Hormati `prefers-reduced-motion`.
- **PWA**: manifest dan service worker dasar agar bisa dipasang di layar utama. Cache offline hanya untuk aset statis, bukan untuk data grup.

---

## 8. Keamanan

- Autentikasi: JWT di cookie `httpOnly`, `secure`, dan `sameSite=strict`. Access token berumur pendek, refresh token dirotasi.
- Password di-hash dengan bcrypt. Login dibatasi dengan rate limit per IP dan per akun.
- Setiap query dibatasi oleh `group_id` dan role dari sesi. Akun member tidak bisa mengakses grup lain, meskipun username-nya sama.
- Validasi input dengan Zod di backend: panjang string, jumlah item per pesanan, format URL Maps, tipe file upload (hanya gambar), dan ukuran maksimal.
- Upload file: nama file dibuat ulang dengan UUID, konten diverifikasi dengan `sharp`, dan file disajikan dari folder yang tidak bisa dieksekusi.
- CORS dibatasi ke domain frontend. Header keamanan diatur dengan `helmet`.
- Gemini API key:
  - Dienkripsi dengan AES-256-GCM. Kunci enkripsi disimpan di environment variable, bukan di database.
  - Tidak pernah dikembalikan ke klien, tidak masuk log, dan tidak masuk error response.
  - Jika kunci enkripsi diganti, key lama tidak bisa didekripsi dan admin harus mengisi ulang.
- Environment variable (`DATABASE_URL`, `JWT_SECRET`, `GEMINI_ENC_KEY`) tidak pernah masuk repository. Gunakan file `.env` lokal dan secret manager di server produksi.

---

## 9. Struktur Proyek (monorepo)

```
dineout/
├─ apps/
│  ├─ web/                 # React + Vite
│  │  ├─ src/
│  │  │  ├─ app/           # routing, layout, providers
│  │  │  ├─ features/      # auth, groups, votes, orders, summaries, bills, profile
│  │  │  ├─ components/    # komponen UI bersama
│  │  │  ├─ lib/           # api client, query client, utilitas tanggal (Asia/Jakarta)
│  │  │  └─ types/
│  └─ api/                 # Node.js + Express
│     ├─ src/
│     │  ├─ routes/
│     │  ├─ controllers/
│     │  ├─ services/      # logika bisnis (termasuk perhitungan tagihan)
│     │  ├─ middleware/    # auth, role, deadline, error handler
│     │  ├─ db/            # Prisma schema, migrasi, client
│     │  ├─ integrations/  # gemini, enkripsi
│     │  └─ lib/           # logger, konfigurasi env
│     └─ uploads/          # tidak masuk repository
├─ packages/
│  └─ shared/              # Zod schema, tipe, konstanta yang dipakai web dan api
├─ docker-compose.yml      # MySQL 8 untuk pengembangan
└─ DINEOUT_PLAN.md
```

Dengan `packages/shared`, aturan validasi seperti batas panjang nama, format URL Maps, dan struktur pesanan hanya ditulis sekali.

---

## 10. Tahapan Pengerjaan

**Fase 1: Fondasi**
- Setup monorepo (pnpm workspace), Vite + React + TypeScript, Express + TypeScript
- Setup MySQL lewat Docker Compose, Prisma, dan migrasi awal
- Setup Tailwind, token tema, dan komponen dasar
- Login admin, login member, dan daftar grup
- Middleware auth dan role

**Fase 2: Manajemen grup dan anggota**
- Buat grup
- Buat akun member bulk (dalam satu transaksi)
- Tag mod
- Ganti dan reset password

**Fase 3: Voting**
- Buat dan edit voting dengan validasi waktu di server
- Upload screenshot, kompresi dengan `sharp`, dan penyimpanan file
- Countdown dan status otomatis berdasarkan deadline server

**Fase 4: Form pesanan**
- Form makanan dan minuman terpisah
- Simpan dan edit pesanan sampai deadline
- Daftar "Belum pesan"

**Fase 5: Rekap dan AI**
- Rekap manual
- Pengaturan Gemini API key dengan enkripsi AES-256-GCM
- Sortir dengan Gemini dari backend, validasi JSON dengan Zod, dan review admin

**Fase 6: Tagihan**
- Input daftar harga dan subsidi per user
- Perhitungan `payable` per user di service layer, dengan tes unit untuk contoh 1 sampai 3
- Salin hasil sebagai teks dan unduh sebagai gambar

**Fase 7: Hardening dan rilis**
- Uji otorisasi untuk setiap endpoint (termasuk percobaan akses lintas grup)
- Uji tampilan di perangkat Android dan iOS sungguhan
- Penanganan error dan kondisi jaringan buruk
- PWA manifest, build produksi, dan deploy

---

## 11. Prompt untuk Pengembangan (siap pakai)

Gunakan prompt ini untuk meminta AI coding agent membangun fitur per fase.

```
Bangun aplikasi web bernama DineOut sebagai monorepo dengan pnpm workspace:
- apps/web: React 18 + Vite + TypeScript, React Router, TanStack Query,
  Zustand (hanya untuk state UI), React Hook Form + Zod, Tailwind CSS,
  komponen dasar dari shadcn/ui yang disesuaikan dengan token tema sendiri.
- apps/api: Node.js LTS + Express + TypeScript, Prisma ke MySQL 8,
  JWT di cookie httpOnly, bcrypt untuk password, Zod untuk validasi,
  helmet, rate limit pada endpoint login.
- packages/shared: Zod schema dan tipe yang dipakai web dan api.

Konteks:
- Aplikasi untuk mengatur pesan makan bersama dalam grup.
- Dua role utama: Admin (pembuat grup) dan Member. Admin dapat memberi tag
  "mod" ke member. Mod dapat membuat dan mengedit voting tempat makan.
- Akun member dibuat admin secara bulk dengan username dan password.
  Username unik per grup. Akun hanya berlaku untuk grup tempat dibuat.
- Zona waktu: Asia/Jakarta untuk tampilan. Semua timestamp disimpan UTC.
  Deadline divalidasi di server, tidak pernah dari jam perangkat.
- Semua uang disimpan sebagai BIGINT dalam Rupiah utuh.

Kerjakan fase 1 terlebih dahulu:
1. Setup pnpm workspace, Vite + React + TypeScript di apps/web, dan Express
   + TypeScript di apps/api. Tambahkan docker-compose.yml untuk MySQL 8.
2. Setup Prisma dengan schema MySQL sesuai DINEOUT_PLAN.md bagian 3, lalu
   buat migrasi awal.
3. Buat middleware requireAuth dan requireGroupMember di apps/api.
4. Buat endpoint POST /api/auth/admin/register, POST /api/auth/admin/login,
   dan POST /api/auth/member/login (groupId, username, password).
5. Buat halaman login admin, login member (pilih grup, username, password),
   dan daftar grup di apps/web. Gunakan TanStack Query untuk data server.
6. Buat token tema warna (satu aksen hangat di atas netral) di Tailwind.

Aturan desain:
- Sederhana dan modern, tidak generik. Hindari gradien ungu, glassmorphism,
  emoji sebagai ikon, dan sudut membulat di semua elemen.
- Mobile-first. Satu keluarga font, digit tabular untuk angka.
- Teks UI dalam bahasa Indonesia yang singkat.

Aturan keamanan:
- Jangan pernah mengembalikan password_hash atau Gemini API key ke klien.
- Setiap query grup wajib difilter berdasarkan group_id dari keanggotaan
  yang sudah diverifikasi, bukan dari input klien.

Setelah selesai, jelaskan struktur file yang dibuat, variabel environment
yang dibutuhkan (DATABASE_URL, JWT_SECRET, GEMINI_ENC_KEY), dan langkah
menjalankan web, api, dan MySQL secara lokal.
```

**Prompt lanjutan untuk fase 5 (ganti bagian "Kerjakan fase"):**

```
Kerjakan fase 5: Rekap dan AI.
- Halaman Rekap Pesanan untuk admin dan mod: semua order dari voting
  terpilih, dipisah makanan dan minuman, dan daftar member yang belum pesan.
  Data diambil dari endpoint GET /api/votes/:id/orders.
- Tombol "Sortir Manual": simpan ke order_summaries dengan source 'manual'
  dan item ke order_summary_items, dalam satu transaksi.
- Pengaturan Gemini API key (hanya admin): PUT /api/profile/gemini-key
  mengenkripsi key dengan AES-256-GCM dari GEMINI_ENC_KEY, lalu menyimpan
  ciphertext, iv, dan tag. Key tidak pernah dikembalikan ke klien.
  Input di UI disembunyikan dan hanya bisa diganti atau dihapus.
- Tombol "Sortir dengan AI": POST /api/votes/:id/summaries/ai membaca semua
  order dari MySQL, mendekripsi key di server, dan memanggil Gemini dengan
  output JSON terstruktur (foodTotals, drinkTotals). Validasi JSON dengan Zod
  sebelum dikembalikan. Retry sekali jika JSON tidak valid. Tampilkan error
  yang jelas jika key salah atau kuota habis.
- Hasil AI ditampilkan untuk direview dan diedit admin di frontend, lalu
  disimpan lewat POST /api/votes/:id/summaries/ai/save dengan source 'gemini'.
- Jangan pernah mencatat API key ke log. Sensor header dan field key di logger.
```

---

## 12. Pertanyaan Terbuka (perlu diputuskan)

1. **Satu voting aktif atau banyak**: dalam satu grup, boleh ada beberapa voting berjalan bersamaan?
2. **Kepemilikan grup**: bisakah admin dipindah ke orang lain?
3. **Riwayat**: berapa lama voting dan tagihan lama disimpan?
4. **Notifikasi**: apakah perlu notifikasi saat voting dibuka, mendekati deadline, atau tagihan dibuat? (Untuk web, bisa lewat Web Push atau notifikasi dalam aplikasi saja.)
5. **Pembayaran**: apakah tagihan hanya menampilkan nominal, atau perlu integrasi QRIS/e-wallet? (Di luar cakupan versi pertama.)
6. **Pengumpulan data pribadi**: nama dan username saja cukup, atau perlu nomor HP untuk kebutuhan tagihan?
7. **Platform final**: web responsif dan PWA sudah cukup, atau perlu aplikasi native (React Native) untuk Play Store dan App Store?
8. **Key Gemini di server**: apakah Anda setuju key disimpan terenkripsi di server (perubahan dari desain awal), atau tetap ingin key hanya di perangkat admin?

---

## 13. Batasan Versi Pertama (Out of Scope)

- Pembayaran dalam aplikasi
- Chat antar anggota
- Integrasi langsung dengan layanan pesan-antar (GoFood, GrabFood, dll.)
- Login dengan Google (bisa ditambahkan nanti lewat OAuth)
- Sinkronisasi Gemini API key antar akun admin
- Mode offline penuh (hanya penanganan error dan cache dasar)
- Aplikasi native (kecuali diputuskan lewat pertanyaan 7)
