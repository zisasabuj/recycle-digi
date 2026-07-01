require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const http       = require('http');
const { Server } = require('socket.io');
const jwt        = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app    = express();
const server = http.createServer(app);

// ── Socket.IO (real-time bids + chat) ──
const io = new Server(server, { cors: { origin: '*' } });
global.io = io;

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (token) {
    try {
      const d = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = d.id;
    } catch {}
  }
  next();
});

io.on('connection', (socket) => {
  // Join auction room (for live bid updates)
  socket.on('join_auction', (auctionId) => {
    socket.join(auctionId);
  });
  // Join chat room
  socket.on('join_chat', (chatId) => {
    socket.join(chatId);
  });
  socket.on('disconnect', () => {});
});

// ── Middleware ──
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Static Files ──
const frontendPath = path.join(__dirname, 'frontend');
app.use(express.static(frontendPath));
app.use('/uploads', express.static(path.join(frontendPath, 'uploads')));

// ── API Routes ──
app.use('/api/auth',      require('./backend/routes/auth'));
app.use('/api/auctions',  require('./backend/routes/auctions'));
app.use('/api',           require('./backend/routes/features'));   // bids, watchlist, chat, notifications
app.use('/api',           require('./backend/routes/cartOrders')); // cart, orders
app.use('/api/upload',    require('./backend/routes/upload'));

// ── Health Check ──
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ success:true, message:'Recycle-Digi running ✅', db:'connected' });
  } catch {
    res.json({ success:true, message:'Recycle-Digi running ✅', db:'disconnected' });
  }
});

// ── Seed Endpoint (for Render deploy) ──
app.get('/api/seed', async (req, res) => {
  try {
    const { execSync } = require('child_process');
    execSync('node backend/seed.js', { cwd: __dirname, timeout: 30000 });
    res.json({ success: true, message: 'Database seeded successfully! 🌱' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Auto-expire auctions (runs every 5 min) ──
setInterval(async () => {
  try {
    const expired = await prisma.auction.updateMany({
      where: { status: 'ACTIVE', endsAt: { lt: new Date() } },
      data:  { status: 'EXPIRED' }
    });
    if (expired.count > 0) {
      console.log(`⏰ Auto-expired ${expired.count} auction(s)`);
    }
  } catch {}
}, 5 * 60 * 1000);

// ── SPA fallback ──
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ── Error handler ──
app.use((err, req, res, next) => {
  console.error('❌', err.message);
  res.status(err.status || 500).json({ success: false, message: err.message });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log(`║  🛒  Recycle-Digi  →  http://localhost:${PORT}   ║`);
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  Admin   admin@recycledigi.com / admin123    ║');
  console.log('║  Seller  rahim@example.com     / seller123   ║');
  console.log('║  Buyer   sumon@example.com     / buyer123    ║');
  console.log('╚══════════════════════════════════════════════╝\n');
});
