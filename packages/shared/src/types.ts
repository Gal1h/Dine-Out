import type { ItemType, VoteStatus } from "./constants.js";

export type Role = "admin" | "mod" | "member";

export interface SessionUser {
  id: string;
  accountType: "admin" | "member";
  email: string | null;
  displayName: string;
}

export interface GroupSummary {
  id: string;
  name: string;
  adminId: string;
  createdAt: string;
  role: Role;
  memberCount: number;
  activeVoteCount: number;
}

export interface MemberRow {
  userId: string;
  displayName: string;
  username: string | null;
  email: string | null;
  role: Role;
  joinedAt: string;
}

export interface VoteSummary {
  id: string;
  groupId: string;
  storeName: string;
  mapsUrl: string;
  menuText: string | null;
  menuImageUrl: string | null;
  voteDeadline: string;
  orderDeadline: string;
  status: VoteStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  orderCount?: number;
  hasMyOrder?: boolean;
}

export interface OrderItem {
  id: string;
  itemType: ItemType;
  name: string;
  qty: number;
  note: string | null;
}

export interface OrderRow {
  id: string;
  userId: string;
  displayName: string;
  username: string | null;
  submittedAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export interface OrdersResponse {
  vote: VoteSummary;
  orders: OrderRow[];
  notOrdered: Array<{ userId: string; displayName: string; username: string | null }>;
  totals: {
    foodItems: number;
    drinkItems: number;
    people: number;
  };
}

export interface MyOrderResponse {
  order: { id: string; submittedAt: string; updatedAt: string; items: OrderItem[] } | null;
  vote: VoteSummary;
}

export interface SummaryItem {
  id: string;
  itemType: ItemType;
  name: string;
  totalQty: number;
}

export interface OrderSummary {
  id: string;
  voteId: string;
  source: "manual" | "gemini";
  createdAt: string;
  createdBy: string;
  createdByName?: string;
  items: SummaryItem[];
}

export interface AiSummaryResult {
  items: Array<{ itemType: ItemType; name: string; totalQty: number }>;
  aiRaw: string;
  model: string;
}

export interface BillPriceRow {
  id: string;
  itemType: ItemType;
  name: string;
  price: number;
}

export interface BillUserTotalRow {
  userId: string;
  displayName: string;
  username: string | null;
  foodTotal: number;
  drinkTotal: number;
  foodSubsidy: number;
  drinkSubsidy: number;
  foodPayable: number;
  drinkPayable: number;
  payable: number;
}

export interface BillResponse {
  id: string;
  voteId: string;
  summaryId: string;
  storeName: string;
  createdAt: string;
  createdBy: string;
  prices: BillPriceRow[];
  users: BillUserTotalRow[];
  totals: {
    food: number;
    drink: number;
    payable: number;
    subsidy: number;
  };
  warnings: Array<{ userId?: string; message: string }>;
}

export interface AuthMeResponse {
  user: SessionUser;
  group: { id: string; name: string; role: Role } | null;
  hasGeminiKey: boolean;
}
