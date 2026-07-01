require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const CITIES = ['Dhaka', 'Chittagong', 'Rajshahi', 'Khulna', 'Sylhet'];
const AREAS  = {
  Dhaka: ['Gulshan','Dhanmondi','Mirpur','Uttara','Banani','Bashundhara'],
  Chittagong: ['Agrabad','Nasirabad','Halishahar'],
  Rajshahi: ['Shaheb Bazar','Boalia'],
  Khulna: ['KDA Avenue','Sonadanga'],
  Sylhet: ['Zindabazar','Amberkhana'],
};

async function main() {
  console.log('🌱 Seeding database...\n');

  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.chat.deleteMany();
  await prisma.bid.deleteMany();
  await prisma.watchlist.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auction.deleteMany();
  await prisma.user.deleteMany();

  // ── Users (all USER role, one ADMIN) ──
  const adminHash = await bcrypt.hash('admin123', 10);
  const userHash  = await bcrypt.hash('user123', 10);

  const admin = await prisma.user.create({ data: {
    username: 'admin', email: 'admin@recycledigi.com',
    passwordHash: adminHash, role: 'ADMIN',
    fullName: 'Admin User', phone: '01700000000'
  }});

  const user1 = await prisma.user.create({ data: {
    username: 'rahim', email: 'rahim@example.com',
    passwordHash: userHash, role: 'USER',
    fullName: 'Rahim Ahmed', phone: '01712345678'
  }});

  const user2 = await prisma.user.create({ data: {
    username: 'karim', email: 'karim@example.com',
    passwordHash: userHash, role: 'USER',
    fullName: 'Karim Hossain', phone: '01898765432'
  }});

  const user3 = await prisma.user.create({ data: {
    username: 'sumon', email: 'sumon@example.com',
    passwordHash: userHash, role: 'USER',
    fullName: 'Sumon Islam', phone: '01611112222'
  }});

  const user4 = await prisma.user.create({ data: {
    username: 'nadia', email: 'nadia@example.com',
    passwordHash: userHash, role: 'USER',
    fullName: 'Nadia Akter', phone: '01933334444'
  }});

  console.log('👥 Users created: 5');

  // ── Auctions (mix of NEW/DIRECT and USED/AUCTION) ──
  const now = new Date();
  const h = (hrs) => new Date(now.getTime() + hrs * 3600000);

  const auctions = await Promise.all([
    // USED + AUCTION (bidding enabled)
    prisma.auction.create({ data: {
      sellerId: user1.id, title: 'Samsung Galaxy S22 Ultra — Excellent Condition',
      description: 'Used for 6 months. No scratches. Original box + charger. Battery 96%. 256GB.',
      images: JSON.stringify(['/uploads/phone-samsung.jpg']),
      category: 'Phones', condition: 'USED', sellType: 'AUCTION',
      basePrice: 45000, bidIncrement: 500, currentMaxBid: 48500,
      city: 'Dhaka', area: 'Gulshan', endsAt: h(18), viewCount: 142, status: 'ACTIVE'
    }}),
    // NEW + DIRECT (buy now, no bidding)
    prisma.auction.create({ data: {
      sellerId: user1.id, title: 'MacBook Pro M1 14" — Brand New Sealed',
      description: 'Factory sealed. 16GB RAM, 512GB SSD. Full Apple warranty.',
      images: JSON.stringify(['/uploads/laptop-macbook.jpg']),
      category: 'Laptops', condition: 'NEW', sellType: 'DIRECT',
      basePrice: 185000, bidIncrement: 0, currentMaxBid: 0,
      city: 'Dhaka', area: 'Dhanmondi', endsAt: h(720), viewCount: 89, status: 'ACTIVE'
    }}),
    // USED + AUCTION
    prisma.auction.create({ data: {
      sellerId: user2.id, title: 'Canon EOS R50 Camera Kit',
      description: 'Used for one photoshoot. 18-45mm + 50mm prime. Extra battery + 128GB card.',
      images: JSON.stringify(['/uploads/camera-canon.jpg']),
      category: 'Cameras', condition: 'USED', sellType: 'AUCTION',
      basePrice: 65000, bidIncrement: 1000, currentMaxBid: 67000,
      city: 'Chittagong', area: 'Agrabad', endsAt: h(6), viewCount: 203, status: 'ACTIVE'
    }}),
    // NEW + DIRECT
    prisma.auction.create({ data: {
      sellerId: user2.id, title: 'Apple Watch Series 9 — 45mm GPS New',
      description: 'Brand new, sealed box. Midnight aluminum. Full warranty.',
      images: JSON.stringify(['/uploads/watch-apple.jpg']),
      category: 'Watches', condition: 'NEW', sellType: 'DIRECT',
      basePrice: 42000, bidIncrement: 0, currentMaxBid: 0,
      city: 'Dhaka', area: 'Uttara', endsAt: h(720), viewCount: 67, status: 'ACTIVE'
    }}),
    // USED + DIRECT (used but seller doesn't want auction)
    prisma.auction.create({ data: {
      sellerId: user1.id, title: 'Sony WH-1000XM5 Headphones — Like New',
      description: 'Used 2 weeks. Perfect condition. Noise cancelling. Box included.',
      images: JSON.stringify(['/uploads/headphone-sony.jpg']),
      category: 'Electronics', condition: 'USED', sellType: 'DIRECT',
      basePrice: 22000, bidIncrement: 0, currentMaxBid: 0,
      city: 'Dhaka', area: 'Banani', endsAt: h(720), viewCount: 55, status: 'ACTIVE'
    }}),
    // USED + AUCTION
    prisma.auction.create({ data: {
      sellerId: user2.id, title: 'Dell XPS 15 — i7 12th Gen, 32GB RAM',
      description: 'Used 1 year. Excellent. 1TB NVMe, RTX 3050Ti. Great for devs.',
      images: JSON.stringify(['/uploads/laptop-dell.jpg']),
      category: 'Laptops', condition: 'USED', sellType: 'AUCTION',
      basePrice: 95000, bidIncrement: 1000, currentMaxBid: 99000,
      city: 'Sylhet', area: 'Zindabazar', endsAt: h(24), viewCount: 110, status: 'ACTIVE'
    }}),
    // NEW + DIRECT
    prisma.auction.create({ data: {
      sellerId: user1.id, title: 'iPhone 15 Pro — 256GB Natural Titanium',
      description: 'Brand new, sealed. AppleCare+ included. USB-C cable + clear case.',
      images: JSON.stringify(['/uploads/phone-iphone.jpg']),
      category: 'Phones', condition: 'NEW', sellType: 'DIRECT',
      basePrice: 145000, bidIncrement: 0, currentMaxBid: 0,
      city: 'Dhaka', area: 'Bashundhara', endsAt: h(720), viewCount: 318, status: 'ACTIVE'
    }}),
    // USED + AUCTION
    prisma.auction.create({ data: {
      sellerId: user2.id, title: 'DJI Mini 4 Pro Drone — Fly More Combo',
      description: 'Flown 3 times. Extra batteries. No damage. 47 min total flight.',
      images: JSON.stringify(['/uploads/drone-dji.jpg']),
      category: 'Electronics', condition: 'USED', sellType: 'AUCTION',
      basePrice: 55000, bidIncrement: 1000, currentMaxBid: 58000,
      city: 'Rajshahi', area: 'Boalia', endsAt: h(30), viewCount: 77, status: 'ACTIVE'
    }}),
  ]);

  console.log('🏷  Auctions created:', auctions.length, '(4 AUCTION, 4 DIRECT)');

  // ── Bids (only on AUCTION items) ──
  await prisma.bid.createMany({ data: [
    { auctionId: auctions[0].id, userId: user3.id, amount: 46000, isSealed: true },
    { auctionId: auctions[0].id, userId: user4.id, amount: 47500, isSealed: true },
    { auctionId: auctions[0].id, userId: user3.id, amount: 48500, isSealed: true },
    { auctionId: auctions[2].id, userId: user3.id, amount: 67000, isSealed: true },
    { auctionId: auctions[5].id, userId: user4.id, amount: 97000, isSealed: true },
    { auctionId: auctions[5].id, userId: user3.id, amount: 99000, isSealed: true },
    { auctionId: auctions[7].id, userId: user4.id, amount: 56000, isSealed: true },
    { auctionId: auctions[7].id, userId: user3.id, amount: 58000, isSealed: true },
  ]});

  console.log('💰 Bids created: 8');

  // ── Watchlist ──
  await prisma.watchlist.createMany({ data: [
    { userId: user3.id, auctionId: auctions[1].id },
    { userId: user3.id, auctionId: auctions[3].id },
    { userId: user4.id, auctionId: auctions[0].id },
  ]});

  console.log('❤️  Watchlist entries: 3');

  console.log('\n✅ ═══════════════════════════════════════════');
  console.log('   Seed complete!');
  console.log('   ─────────────────────────────────────────');
  console.log('   Admin → admin@recycledigi.com / admin123');
  console.log('   User  → rahim@example.com    / user123');
  console.log('   User  → karim@example.com    / user123');
  console.log('   User  → sumon@example.com    / user123');
  console.log('   User  → nadia@example.com    / user123');
  console.log('═══════════════════════════════════════════\n');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
