import { describe, expect, it } from "vitest";
import { calculateBillLine } from "@dineout/shared";
import { computeBill } from "../src/services/bill.js";

describe("calculateBillLine", () => {
  it("Contoh 1: subsidi minuman saja", () => {
    const line = calculateBillLine(0, 13_000, 0, 10_000);
    expect(line.drinkPayable).toBe(3_000);
    expect(line.payable).toBe(3_000);
  });

  it("Contoh 2: subsidi makanan, sisa hangus", () => {
    const line = calculateBillLine(8_000, 5_000, 10_000, 0);
    expect(line.foodPayable).toBe(0);
    expect(line.drinkPayable).toBe(5_000);
    expect(line.payable).toBe(5_000);
    // sisa subsidi tidak berpindah kategori
    expect(line.payable).not.toBe(0);
  });

  it("Contoh 3: subsidi makanan dan minuman sekaligus", () => {
    const line = calculateBillLine(20_000, 13_000, 10_000, 5_000);
    expect(line.foodPayable).toBe(10_000);
    expect(line.drinkPayable).toBe(8_000);
    expect(line.payable).toBe(18_000);
  });

  it("tidak pernah menghasilkan nilai negatif", () => {
    const line = calculateBillLine(0, 0, 50_000, 50_000);
    expect(line.payable).toBe(0);
  });
});

describe("computeBill", () => {
  const prices = [
    { itemType: "food" as const, name: "Nasi Goreng", price: 25_000 },
    { itemType: "food" as const, name: "Ayam Geprek", price: 20_000 },
    { itemType: "drink" as const, name: "Es Teh Manis", price: 5_000 },
    { itemType: "drink" as const, name: "Es Jeruk", price: 8_000 },
  ];

  it("menghitung total per user dari qty dan harga", () => {
    const result = computeBill(
      [
        {
          userId: "u1",
          items: [
            { itemType: "food", name: "Nasi Goreng", qty: 2 },
            { itemType: "drink", name: "Es Teh Manis", qty: 1 },
          ],
        },
      ],
      prices,
      [{ userId: "u1", foodSubsidy: 10_000, drinkSubsidy: 0 }],
    );

    expect(result.rows[0]).toMatchObject({
      foodTotal: 50_000,
      drinkTotal: 5_000,
      foodPayable: 40_000,
      drinkPayable: 5_000,
      payable: 45_000,
    });
    expect(result.warnings).toHaveLength(0);
  });

  it("mencocokkan nama item tanpa membedakan huruf besar/kecil dan spasi", () => {
    const result = computeBill(
      [{ userId: "u1", items: [{ itemType: "food", name: "  nasi   goreng ", qty: 1 }] }],
      prices,
      [],
    );
    expect(result.rows[0].foodTotal).toBe(25_000);
  });

  it("mencocokkan item dengan nama yang lebih panjang", () => {
    const result = computeBill(
      [{ userId: "u1", items: [{ itemType: "food", name: "Nasi Goreng Spesial", qty: 1 }] }],
      prices,
      [],
    );
    expect(result.rows[0].foodTotal).toBe(25_000);
  });

  it("memberi warning dan harga 0 untuk item yang belum punya harga", () => {
    const result = computeBill(
      [{ userId: "u1", items: [{ itemType: "food", name: "Sate Kambing", qty: 3 }] }],
      prices,
      [],
    );
    expect(result.rows[0].foodTotal).toBe(0);
    expect(result.warnings.some((w) => w.message.includes("Sate Kambing"))).toBe(true);
  });

  it("menandai sisa subsidi yang hangus", () => {
    const result = computeBill(
      [{ userId: "u1", items: [{ itemType: "food", name: "Ayam Geprek", qty: 1 }] }],
      prices,
      [{ userId: "u1", foodSubsidy: 30_000, drinkSubsidy: 0 }],
    );
    expect(result.rows[0].foodPayable).toBe(0);
    expect(result.warnings.some((w) => w.message.includes("hangus"))).toBe(true);
  });
});
