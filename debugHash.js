const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
(async () => {
  const user = await prisma.user.findUnique({ where: { email: 'rahim@example.com' } });
  if (!user) {
    console.log('User not found');
    return;
  }
  console.log('Hash from DB:', user:', user.passwordHash);
  const match = await bcrypt.compare('user123', user.passwordHash);
  console.log('Matches password \"user123\":', match);
  const hash = await bcrypt.hash('user123', 10);
  console.log('Fresh hash of \"user123\":', hash);
  console.log('Matches fresh hash:', await bcrypt.compare('user123', hash));
  await prisma.$disconnect();
})();