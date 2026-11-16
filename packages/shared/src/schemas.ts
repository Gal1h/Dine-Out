import { z } from "zod";
import { LIMITS } from "./constants.js";

const displayName = z
  .string()
  .trim()
  .min(LIMITS.displayName.min, "Nama minimal 2 karakter")
  .max(LIMITS.displayName.max, "Nama maksimal 100 karakter");

const password = z
  .string()
  .min(LIMITS.password.min, "Password minimal 8 karakter")
  .max(LIMITS.password.max, "Password maksimal 72 karakter");

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(LIMITS.username.min, "Username minimal 3 karakter")
  .max(LIMITS.username.max, "Username maksimal 50 karakter")
  .regex(/^[a-z0-9._-]+$/, "Username hanya boleh huruf, angka, titik, garis bawah, dan strip");

export const emailSchema = z.string().trim().toLowerCase().email("Format email tidak valid");
export const uuidSchema = z.string().uuid("ID tidak valid");

export const registerAdminSchema = z.object({
  email: emailSchema,
  password,
  displayName,
});
export type RegisterAdminInput = z.infer<typeof registerAdminSchema>;

export const loginAdminSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password wajib diisi"),
});
export type LoginAdminInput = z.infer<typeof loginAdminSchema>;

export const loginMemberSchema = z.object({
  groupId: uuidSchema,
  username: usernameSchema,
  password: z.string().min(1, "Password wajib diisi"),
});
export type LoginMemberInput = z.infer<typeof loginMemberSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Password saat ini wajib diisi"),
  newPassword: password,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateProfileSchema = z.object({
  displayName,
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const geminiKeySchema = z.object({
  apiKey: z
    .string()
    .trim()
    .min(20, "API key terlalu pendek")
    .max(200, "API key terlalu panjang"),
});
export type GeminiKeyInput = z.infer<typeof geminiKeySchema>;

export const groupNameSchema = z
  .string()
  .trim()
  .min(LIMITS.groupName.min, "Nama grup minimal 2 karakter")
  .max(LIMITS.groupName.max, "Nama grup maksimal 100 karakter");

export const createGroupSchema = z.object({
  name: groupNameSchema,
});
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const bulkMemberRowSchema = z.object({
  username: usernameSchema,
  password,
  displayName,
});
export type BulkMemberRow = z.infer<typeof bulkMemberRowSchema>;

export const bulkMembersSchema = z.object({
  members: z
    .array(bulkMemberRowSchema)
    .min(1, "Minimal satu akun")
    .max(LIMITS.bulkMembers, "Maksimal 50 akun per batch"),
});
export type BulkMembersInput = z.infer<typeof bulkMembersSchema>;

export const memberRoleSchema = z.object({
  role: z.enum(["mod", "member"]),
});
export type MemberRoleInput = z.infer<typeof memberRoleSchema>;

export const resetMemberPasswordSchema = z.object({
  newPassword: password,
});
export type ResetMemberPasswordInput = z.infer<typeof resetMemberPasswordSchema>;

export const mapsUrlSchema = z
  .string()
  .trim()
  .max(LIMITS.mapsUrl, "URL terlalu panjang")
  .refine((value) => {
    try {
      const url = new URL(value);
      if (!/^https?:$/.test(url.protocol)) return false;
      const host = url.hostname.toLowerCase();
      return (
        host === "maps.app.goo.gl" ||
        host === "goo.gl" ||
        host === "maps.google.com" ||
        /(^|\.)google\.[a-z.]+$/.test(host)
      );
    } catch {
      return false;
    }
  }, "Gunakan link Google Maps yang valid");

const isoDate = z
  .string()
  .datetime({ offset: true, message: "Format tanggal tidak valid" })
  .or(z.string().datetime({ message: "Format tanggal tidak valid" }));

export const createVoteSchema = z
  .object({
    storeName: z
      .string()
      .trim()
      .min(LIMITS.storeName.min, "Nama toko minimal 2 karakter")
      .max(LIMITS.storeName.max, "Nama toko maksimal 150 karakter"),
    mapsUrl: mapsUrlSchema,
    menuText: z
      .string()
      .trim()
      .max(LIMITS.menuText, "Teks menu terlalu panjang")
      .optional()
      .or(z.literal("")),
    voteDeadline: isoDate,
    orderDeadline: isoDate,
  })
  .refine((v) => new Date(v.orderDeadline) > new Date(v.voteDeadline), {
    message: "Batas isi form harus setelah batas voting",
    path: ["orderDeadline"],
  });
export type CreateVoteInput = z.infer<typeof createVoteSchema>;

export const updateVoteSchema = z.object({
  storeName: createVoteSchema.innerType().shape.storeName.optional(),
  mapsUrl: mapsUrlSchema.optional(),
  menuText: z
    .string()
    .trim()
    .max(LIMITS.menuText, "Teks menu terlalu panjang")
    .optional()
    .or(z.literal("")),
  voteDeadline: isoDate.optional(),
  orderDeadline: isoDate.optional(),
  removeMenuImage: z.boolean().optional(),
});
export type UpdateVoteInput = z.infer<typeof updateVoteSchema>;

export const itemTypeSchema = z.enum(["food", "drink"]);

export const orderItemSchema = z.object({
  itemType: itemTypeSchema,
  name: z
    .string()
    .trim()
    .min(1, "Nama item wajib diisi")
    .max(LIMITS.itemName, "Nama item maksimal 150 karakter"),
  qty: z
    .number()
    .int("Jumlah harus bilangan bulat")
    .min(LIMITS.qty.min, "Jumlah minimal 1")
    .max(LIMITS.qty.max, "Jumlah maksimal 99"),
  note: z.string().trim().max(LIMITS.itemNote, "Catatan maksimal 255 karakter").optional().or(z.literal("")),
});
export type OrderItemInput = z.infer<typeof orderItemSchema>;

export const submitOrderSchema = z.object({
  items: z
    .array(orderItemSchema)
    .min(1, "Isi minimal satu item")
    .max(LIMITS.itemsPerOrder, "Maksimal 25 item per pesanan"),
});
export type SubmitOrderInput = z.infer<typeof submitOrderSchema>;

export const summaryItemSchema = z.object({
  itemType: itemTypeSchema,
  name: z.string().trim().min(1).max(LIMITS.itemName),
  totalQty: z.number().int().min(1).max(9999),
});
export type SummaryItemInput = z.infer<typeof summaryItemSchema>;

export const saveManualSummarySchema = z.object({
  items: z.array(summaryItemSchema).min(1, "Minimal satu item").max(200),
});
export type SaveManualSummaryInput = z.infer<typeof saveManualSummarySchema>;

export const saveAiSummarySchema = z.object({
  items: z.array(summaryItemSchema).min(1, "Minimal satu item").max(200),
  aiRaw: z.string().max(100_000).optional(),
});
export type SaveAiSummaryInput = z.infer<typeof saveAiSummarySchema>;

export const geminiSummaryResponseSchema = z.object({
  foodTotals: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        totalQty: z.number().int().min(1),
      }),
    )
    .default([]),
  drinkTotals: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        totalQty: z.number().int().min(1),
      }),
    )
    .default([]),
});
export type GeminiSummaryResponse = z.infer<typeof geminiSummaryResponseSchema>;

export const billPriceSchema = z.object({
  itemType: itemTypeSchema,
  name: z.string().trim().min(1).max(LIMITS.itemName),
  price: z
    .number()
    .int("Harga harus bilangan bulat")
    .min(0, "Harga tidak boleh negatif")
    .max(LIMITS.price, "Harga terlalu besar"),
});
export type BillPriceInput = z.infer<typeof billPriceSchema>;

export const billSubsidySchema = z.object({
  userId: uuidSchema,
  foodSubsidy: z.number().int().min(0).max(LIMITS.subsidy).default(0),
  drinkSubsidy: z.number().int().min(0).max(LIMITS.subsidy).default(0),
});
export type BillSubsidyInput = z.infer<typeof billSubsidySchema>;

export const createBillSchema = z.object({
  prices: z.array(billPriceSchema).min(1, "Isi minimal satu harga").max(200),
  subsidies: z.array(billSubsidySchema).max(200).default([]),
});
export type CreateBillInput = z.infer<typeof createBillSchema>;

export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
