import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const uuid = () => crypto.randomUUID();
const now = Date.now();
const HOUR = 60 * 60 * 1000;

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: "admin@dineout.test" } });
  if (existing) {
    console.log("Seed dilewati: data demo sudah ada.");
    return;
  }

  const passwordHash = await bcrypt.hash("admin12345", 12);
  const memberHash = await bcrypt.hash("member12345", 12);

  const admin = await prisma.user.create({
    data: {
      id: uuid(),
      accountType: "admin",
      email: "admin@dineout.test",
      passwordHash,
      displayName: "Admin DineOut",
    },
  });

  const group = await prisma.group.create({
    data: {
      id: uuid(),
      name: "Kantor Senja",
      adminId: admin.id,
      members: {
        create: { userId: admin.id, role: "admin" },
      },
    },
  });

  const memberSeeds = [
    { username: "andi", displayName: "Andi Pratama" },
    { username: "budi", displayName: "Budi Santoso" },
    { username: "citra", displayName: "Citra Lestari" },
  ];

  const members = [];
  for (const seed of memberSeeds) {
    const user = await prisma.user.create({
      data: {
        id: uuid(),
        accountType: "member",
        passwordHash: memberHash,
        displayName: seed.displayName,
        memberships: {
          create: { groupId: group.id, role: "member", username: seed.username },
        },
      },
    });
    members.push(user);
  }
  await prisma.groupMember.update({
    where: { groupId_userId: { groupId: group.id, userId: members[1].id } },
    data: { role: "mod" },
  });

  const ordering = await prisma.vote.create({
    data: {
      id: uuid(),
      groupId: group.id,
      storeName: "Warung Nasi Ibu Sari",
      mapsUrl: "https://maps.google.com/?q=warung+nasi+ibu+sari",
      menuText:
        "Makanan:\n- Nasi Goreng Spesial 25.000\n- Ayam Geprek 20.000\n- Mie Ayam 18.000\n\nMinuman:\n- Es Teh Manis 5.000\n- Es Jeruk 8.000\n- Air Mineral 4.000",
      voteDeadline: new Date(now - 2 * HOUR),
      orderDeadline: new Date(now + 22 * HOUR),
      createdBy: admin.id,
    },
  });

  const closed = await prisma.vote.create({
    data: {
      id: uuid(),
      groupId: group.id,
      storeName: "Bakso Pak Kumis",
      mapsUrl: "https://maps.app.goo.gl/contohBakso",
      menuText: "Bakso Campur 20.000\nEs Teh 5.000",
      voteDeadline: new Date(now - 72 * HOUR),
      orderDeadline: new Date(now - 48 * HOUR),
      createdBy: admin.id,
    },
  });

  const open = await prisma.vote.create({
    data: {
      id: uuid(),
      groupId: group.id,
      storeName: "Kedai Kopi Pagi",
      mapsUrl: "https://maps.google.com/?q=kedai+kopi+pagi",
      menuText: "Kopi Susu 22.000\nRoti Bakar 15.000",
      voteDeadline: new Date(now + 3 * HOUR),
      orderDeadline: new Date(now + 6 * HOUR),
      createdBy: members[1].id,
    },
  });

  const orderData = [
    {
      voteId: ordering.id,
      userId: members[0].id,
      items: [
        { itemType: "food" as const, name: "Nasi Goreng Spesial", qty: 1, note: "Pedas sedang" },
        { itemType: "drink" as const, name: "Es Teh Manis", qty: 2, note: null },
      ],
    },
    {
      voteId: ordering.id,
      userId: members[1].id,
      items: [
        { itemType: "food" as const, name: "Ayam Geprek", qty: 1, note: null },
        { itemType: "drink" as const, name: "Es Jeruk", qty: 1, note: "Tanpa gula" },
      ],
    },
    {
      voteId: ordering.id,
      userId: admin.id,
      items: [{ itemType: "food" as const, name: "Mie Ayam", qty: 2, note: null }],
    },
    {
      voteId: closed.id,
      userId: members[0].id,
      items: [
        { itemType: "food" as const, name: "Bakso Campur", qty: 1, note: null },
        { itemType: "drink" as const, name: "Es Teh", qty: 1, note: null },
      ],
    },
    {
      voteId: closed.id,
      userId: members[2].id,
      items: [
        { itemType: "food" as const, name: "Bakso Campur", qty: 2, note: null },
        { itemType: "drink" as const, name: "Es Teh", qty: 2, note: null },
      ],
    },
  ];

  for (const data of orderData) {
    const order = await prisma.voteOrder.create({
      data: { id: uuid(), voteId: data.voteId, userId: data.userId },
    });
    await prisma.voteOrderItem.createMany({
      data: data.items.map((item) => ({ id: uuid(), orderId: order.id, ...item })),
    });
  }

  const summary = await prisma.orderSummary.create({
    data: {
      id: uuid(),
      voteId: closed.id,
      source: "manual",
      createdBy: admin.id,
      items: {
        create: [
          { id: uuid(), itemType: "food", name: "Bakso Campur", totalQty: 3 },
          { id: uuid(), itemType: "drink", name: "Es Teh", totalQty: 3 },
        ],
      },
    },
  });

  const billId = uuid();
  const bill = await prisma.bill.create({
    data: {
      id: billId,
      voteId: closed.id,
      summaryId: summary.id,
      createdBy: admin.id,
    },
  });
  await prisma.billPrice.createMany({
    data: [
      { id: uuid(), billId: bill.id, itemType: "food", name: "Bakso Campur", price: 20000n },
      { id: uuid(), billId: bill.id, itemType: "drink", name: "Es Teh", price: 5000n },
    ],
  });

  const rows = [
    { userId: members[0].id, foodTotal: 20000, drinkTotal: 5000, foodSubsidy: 10000, drinkSubsidy: 0 },
    { userId: members[2].id, foodTotal: 40000, drinkTotal: 10000, foodSubsidy: 0, drinkSubsidy: 3000 },
  ];
  await prisma.billUserTotal.createMany({
    data: rows.map((r) => ({
      id: uuid(),
      billId: bill.id,
      userId: r.userId,
      foodTotal: BigInt(r.foodTotal),
      drinkTotal: BigInt(r.drinkTotal),
      foodSubsidy: BigInt(r.foodSubsidy),
      drinkSubsidy: BigInt(r.drinkSubsidy),
      foodPayable: BigInt(Math.max(0, r.foodTotal - r.foodSubsidy)),
      drinkPayable: BigInt(Math.max(0, r.drinkTotal - r.drinkSubsidy)),
      payable: BigInt(
        Math.max(0, r.foodTotal - r.foodSubsidy) + Math.max(0, r.drinkTotal - r.drinkSubsidy),
      ),
    })),
  });

  console.log("Seed selesai.");
  console.log({
    admin: { email: "admin@dineout.test", password: "admin12345" },
    member: { group: group.name, username: "andi / budi / citra", password: "member12345" },
    votes: { open: open.storeName, ordering: ordering.storeName, closed: closed.storeName },
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
