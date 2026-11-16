# DineOut

Aplikasi patungan makan untuk tim: admin membuat grup, semua anggota voting tempat makan, mengisi pesanan sebelum batas waktu, lalu admin membuat rekap dan tagihan per orang.

Monorepo berisi:

| Path | Isi |
| --- | --- |
| `apps/api` | Express + TypeScript + Prisma (MySQL), auth cookie JWT, upload menu, Gemini AI, perhitungan tagihan |
| `apps/web` | React 18 + Vite + TypeScript, TanStack Query, React Hook Form + Zod, Tailwind, PWA |
| `packages/shared` | Skema Zod, konstanta, dan fungsi perhitungan tagihan yang dipakai API & web |

## Prasyarat

- Node.js 20+
- pnpm 10 (`npm i -g pnpm`)
- MySQL 8 yang berjalan lokal

## Menjalankan

```bash
pnpm install

# Siapkan environment API
cp apps/api/.env.example apps/api/.env
# lalu isi DATABASE_URL, JWT_SECRET, GEMINI_ENC_KEY (lihat komentar di file)

# Buat database bila belum ada
mysql -u root -p -e "CREATE DATABASE dineout CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

pnpm db:migrate
pnpm db:seed
pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:3001 (health check: `/api/health`)

`pnpm dev` menjalankan API dan web sekaligus. Untuk terpisah: `pnpm dev:api` dan `pnpm dev:web`.

## Akun demo (hasil seed)

| Peran | Kredensial |
| --- | --- |
| Admin | `admin@dineout.test` / `admin12345` |
| Member (mod) | grup “Kantor Senja”, username `budi` / `member12345` |
| Member | grup “Kantor Senja”, username `andi` / `member12345` |
| Member | grup “Kantor Senja”, username `citra` / `member12345` |

Seed membuat 3 voting: satu masih voting, satu masa pemesanan, satu selesai lengkap dengan rekap dan tagihan.

## Perintah penting

```bash
pnpm typecheck          # typecheck semua workspace (web & api)
pnpm test               # unit test perhitungan tagihan
pnpm build              # build API + web
pnpm db:migrate         # prisma migrate dev
pnpm db:seed            # isi data demo
```

## Catatan perilaku

- **Auth**: access token 15 menit di cookie `dineout_at`, refresh token 7 hari di `dineout_rt` dan dirotasi setiap refresh. Logout menghapus keduanya.
- **Status voting** dihitung dari waktu server: `open` sebelum batas voting, `ordering` sebelum batas pesanan, setelah itu `closed`.
- **Rekap** hanya bisa dibuat admin/mod setelah batas voting lewat. Rekap adalah snapshot; perubahan pesanan setelahnya tidak mengubah tagihan lama.
- **Sortir AI** hanya untuk admin dan memerlukan Gemini API key yang disimpan terenkripsi (AES-256-GCM) lewat halaman Profil. Tanpa key atau bila key tidak valid, UI menampilkan error dan pengguna bisa memakai sortir manual.
- **Tagihan** mencocokkan nama item pesanan ke daftar harga (exact → substring → kemiripan kata). Item tanpa harga dihitung Rp0 dan muncul sebagai catatan. Subsidi bersifat per kategori (makanan/minuman); sisa subsidi yang melebihi tagihan hangus dan dilaporkan di “Catatan perhitungan”.
- **Upload menu** disimpan sebagai WebP di `apps/api/uploads` (di-serve di `/uploads/...`).
- **Uang** disimpan sebagai `BigInt` rupiah di database dan dikirim sebagai number di API.

## Struktur singkat API

- `POST /api/auth/admin/register`, `POST /api/auth/admin/login`, `POST /api/auth/member/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/groups`, `POST /api/groups`, `GET /api/groups/:id`, anggota & voting grup
- `POST /api/groups/:groupId/votes`, `GET|PATCH /api/votes/:id`, pesanan `PUT /api/votes/:id/orders/me`, `GET /api/votes/:id/orders`
- `POST /api/votes/:id/summaries/manual`, `POST /api/votes/:id/summaries/ai`, `POST /api/votes/:id/summaries/ai/save`
- `POST /api/summaries/:id/bills`, `GET /api/bills/:id`, `GET /api/votes/:id/bills`
- `GET|PATCH /api/profile`, `PUT|DELETE /api/profile/gemini-key`

## Lisensi

Proyek internal, belum dipublikasikan.
