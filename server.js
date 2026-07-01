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

// ── Seed Endpoint (for Vercel/Render deploy) ──
app.get('/api/seed', async (req, res) => {
  try {
    const { execSync } = require('child_process');
    execSync('node backend/seed.js', { cwd: __dirname, timeout: 30000 });
    res.json({ success: true, message: 'Database seeded successfully! 🌱' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Manual Trigger for Auto-expire (Vercel Friendly) ──
app.get('/api/expire-check', async (req, res) => {
  try {
    const expired = await prisma.auction.updateMany({
      where: { status: 'ACTIVE', endsAt: { lt: new Date() } },
      data:  { status: 'EXPIRED' }
    });
    res.json({ success: true, message: `⏰ Expired ${expired.count} auction(s)` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── SPA fallback ──
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ── Error handler ──
app.use((err, req, res, next) => {
  console.error('❌', err.message);
  res.status(err.status || 500).json({ success: false, message: err.message });
});

// ── Vercel Support vs Local Server Implementation ──
if (process.env.NODE_ENV !== 'production') {
  const server = http.createServer(app);
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
    socket.on('join_auction', (auctionId) => { socket.join(auctionId); });
    socket.on('join_chat', (chatId) => { socket.join(chatId); });
  });

  // Local auto-expire timer (only runs locally)
  setInterval(async () => {
    try {
      await prisma.auction.updateMany({
        where: { status: 'ACTIVE', endsAt: { lt: new Date() } },
        data:  { status: 'EXPIRED' }
      });
    } catch {}
  }, 5 * 60 * 1000);

  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`\n🛒 Recycle-Digi local server running on → http://localhost:${PORT}\n`);
  });
}

// Export app for Vercel Serverless
module.exports = app;