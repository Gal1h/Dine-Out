export const TIMEZONE = "Asia/Jakarta";

export const LIMITS = {
  displayName: { min: 2, max: 100 },
  groupName: { min: 2, max: 100 },
  username: { min: 3, max: 50 },
  password: { min: 8, max: 72 },
  storeName: { min: 2, max: 150 },
  mapsUrl: 500,
  menuText: 20000,
  itemName: 150,
  itemNote: 255,
  itemsPerOrder: 25,
  qty: { min: 1, max: 99 },
  bulkMembers: 50,
  menuImageBytes: 5 * 1024 * 1024,
  price: 100_000_000,
  subsidy: 100_000_000,
} as const;

export const ORDER_STATUSES = ["open", "ordering", "closed"] as const;
export type VoteStatus = (typeof ORDER_STATUSES)[number];

export type ItemType = "food" | "drink";

export const ITEM_TYPE_LABEL: Record<ItemType, string> = {
  food: "Makanan",
  drink: "Minuman",
};

/** Status dihitung dari waktu server, tidak pernah dari jam perangkat. */
export function voteStatusAt(
  now: Date,
  voteDeadline: Date | string,
  orderDeadline: Date | string,
): VoteStatus {
  const t = now.getTime();
  if (t < new Date(voteDeadline).getTime()) return "open";
  if (t < new Date(orderDeadline).getTime()) return "ordering";
  return "closed";
}

export interface BillLine {
  foodTotal: number;
  drinkTotal: number;
  foodSubsidy: number;
  drinkSubsidy: number;
  foodPayable: number;
  drinkPayable: number;
  payable: number;
}

/**
 * Subsidi bersifat per kategori dan tidak berpindah kategori.
 * Sisa subsidi yang melebihi tagihan kategorinya hangus.
 */
export function calculateBillLine(
  foodTotal: number,
  drinkTotal: number,
  foodSubsidy: number,
  drinkSubsidy: number,
): BillLine {
  const clamp = (n: number) => Math.max(0, Math.trunc(n || 0));
  const ft = clamp(foodTotal);
  const dt = clamp(drinkTotal);
  const fs = clamp(foodSubsidy);
  const ds = clamp(drinkSubsidy);
  const foodPayable = Math.max(0, ft - fs);
  const drinkPayable = Math.max(0, dt - ds);
  return {
    foodTotal: ft,
    drinkTotal: dt,
    foodSubsidy: fs,
    drinkSubsidy: ds,
    foodPayable,
    drinkPayable,
    payable: foodPayable + drinkPayable,
  };
}

export function formatRupiah(value: number): string {
  return "Rp" + new Intl.NumberFormat("id-ID").format(Math.trunc(value || 0));
}

export function normalizeItemName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}
