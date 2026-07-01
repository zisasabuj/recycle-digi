const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ── BIDS ─────────────────────────────────────

// POST /api/bids
exports.placeBid = async (req, res) => {
  const { auctionId, amount } = req.body;
  if (!auctionId || !amount) return res.status(400).json({ success:false, message:'auctionId and amount required.' });

  try {
    const auction = await prisma.auction.findUnique({ where:{ id:auctionId } });
    if (!auction)              return res.status(404).json({ success:false, message:'Auction not found.' });
    if (auction.status !== 'ACTIVE') return res.status(400).json({ success:false, message:'Auction is not active.' });
    if (new Date() > auction.endsAt)  return res.status(400).json({ success:false, message:'Auction has ended.' });
    if (auction.sellerId === req.user.id) return res.status(400).json({ success:false, message:'You cannot bid on your own auction.' });

    const minBid = (auction.currentMaxBid || auction.basePrice) + auction.bidIncrement;
    if (parseFloat(amount) < minBid)
      return res.status(400).json({ success:false, message:`Minimum bid is ৳${minBid.toLocaleString('en-BD')}` });

    // Check if outbid
    const prevHighBidder = await prisma.bid.findFirst({
      where: { auctionId, amount: auction.currentMaxBid },
      include: { user:{ select:{ id:true } } },
      orderBy: { createdAt:'desc' }
    });

    const bid = await prisma.bid.create({
      data: { auctionId, userId: req.user.id, amount: parseFloat(amount), isSealed: true }
    });

    await prisma.auction.update({ where:{ id:auctionId }, data:{ currentMaxBid: parseFloat(amount) } });

    // Notify outbid user
    if (prevHighBidder && prevHighBidder.user.id !== req.user.id) {
      await prisma.notification.create({ data: {
        userId: prevHighBidder.user.id, type:'OUTBID', auctionId,
        message:`You have been outbid on "${auction.title}". New highest bid: ৳${parseFloat(amount).toLocaleString('en-BD')}`
      }});
    }
    // Notify bidder
    await prisma.notification.create({ data: {
      userId: req.user.id, type:'BID_PLACED', auctionId,
      message:`Your sealed bid of ৳${parseFloat(amount).toLocaleString('en-BD')} on "${auction.title}" was placed.`
    }});

    // Emit via socket if available
    if (global.io) {
      global.io.to(auctionId).emit('bid_update', { auctionId, newMax: parseFloat(amount), bidCount: await prisma.bid.count({ where:{ auctionId } }) });
    }

    return res.status(201).json({ success:true, bid, message:'Sealed bid placed successfully.' });
  } catch (err) { return res.status(500).json({ success:false, message:err.message }); }
};

// GET /api/bids/my
exports.getMyBids = async (req, res) => {
  try {
    const bids = await prisma.bid.findMany({
      where: { userId: req.user.id },
      include: { auction:{ select:{ id:true, title:true, images:true, endsAt:true, status:true, currentMaxBid:true, category:true } } },
      orderBy: { createdAt:'desc' }
    });
    // Mark winning bids & parse images
    const enriched = bids.map(b => ({
      ...b,
      auction: { ...b.auction, images: JSON.parse(b.auction.images || '[]') },
      isWinning: b.amount === b.auction.currentMaxBid && b.auction.status !== 'ACTIVE'
    }));
    return res.json({ success:true, bids: enriched });
  } catch (err) { return res.status(500).json({ success:false, message:err.message }); }
};

// ── WATCHLIST ─────────────────────────────────

// POST /api/watchlist/toggle
exports.toggleWatchlist = async (req, res) => {
  const { auctionId } = req.body;
  if (!auctionId) return res.status(400).json({ success:false, message:'auctionId required.' });
  try {
    const exists = await prisma.watchlist.findUnique({ where:{ userId_auctionId:{ userId:req.user.id, auctionId } } });
    if (exists) {
      await prisma.watchlist.delete({ where:{ userId_auctionId:{ userId:req.user.id, auctionId } } });
      return res.json({ success:true, action:'removed', message:'Removed from watchlist.' });
    } else {
      await prisma.watchlist.create({ data:{ userId:req.user.id, auctionId } });
      return res.json({ success:true, action:'added', message:'Added to watchlist.' });
    }
  } catch (err) { return res.status(500).json({ success:false, message:err.message }); }
};

// GET /api/watchlist
exports.getWatchlist = async (req, res) => {
  try {
    const items = await prisma.watchlist.findMany({
      where: { userId: req.user.id },
      include: {
        auction: { include:{ seller:{ select:{ username:true } }, _count:{ select:{ bids:true } } } }
      },
      orderBy: { createdAt:'desc' }
    });
    const parsed = items.map(i => ({ ...i.auction, images: JSON.parse(i.auction.images || '[]') }));
    return res.json({ success:true, watchlist: parsed });
  } catch (err) { return res.status(500).json({ success:false, message:err.message }); }
};

// ── CHAT ──────────────────────────────────────

// GET /api/chat  — list chats for current user
exports.getChats = async (req, res) => {
  try {
    const chats = await prisma.chat.findMany({
      where: { OR:[{ sellerId:req.user.id }, { winnerId:req.user.id }] },
      include: {
        auction: { select:{ id:true, title:true, images:true, currentMaxBid:true } },
        seller:  { select:{ id:true, username:true, fullName:true } },
        winner:  { select:{ id:true, username:true, fullName:true } },
        messages:{ orderBy:{ createdAt:'desc' }, take:1 }
      },
      orderBy: { createdAt:'desc' }
    });
    return res.json({ success:true, chats });
  } catch (err) { return res.status(500).json({ success:false, message:err.message }); }
};

// GET /api/chat/:id  — single chat thread
exports.getChatThread = async (req, res) => {
  try {
    const chat = await prisma.chat.findUnique({
      where: { id: req.params.id },
      include: {
        auction: { select:{ id:true, title:true, images:true, currentMaxBid:true } },
        seller:  { select:{ id:true, username:true, fullName:true } },
        winner:  { select:{ id:true, username:true, fullName:true } },
        messages:{ include:{ sender:{ select:{ id:true, username:true } } }, orderBy:{ createdAt:'asc' } }
      }
    });
    if (!chat) return res.status(404).json({ success:false, message:'Chat not found.' });
    if (chat.sellerId !== req.user.id && chat.winnerId !== req.user.id)
      return res.status(403).json({ success:false, message:'Access denied.' });
    return res.json({ success:true, chat });
  } catch (err) { return res.status(500).json({ success:false, message:err.message }); }
};

// POST /api/chat/:id/message
exports.sendMessage = async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ success:false, message:'Message text required.' });
  try {
    const chat = await prisma.chat.findUnique({ where:{ id:req.params.id } });
    if (!chat) return res.status(404).json({ success:false, message:'Chat not found.' });
    if (chat.sellerId !== req.user.id && chat.winnerId !== req.user.id)
      return res.status(403).json({ success:false, message:'Access denied.' });

    const msg = await prisma.chatMessage.create({
      data: { chatId:req.params.id, senderId:req.user.id, text:text.trim() },
      include: { sender:{ select:{ id:true, username:true } } }
    });

    // Notify other party
    const otherId = chat.sellerId === req.user.id ? chat.winnerId : chat.sellerId;
    await prisma.notification.create({ data: {
      userId: otherId, type:'CHAT_MESSAGE', auctionId: chat.auctionId,
      message:`New message from ${req.user.username} regarding auction.`
    }});

    if (global.io) global.io.to(req.params.id).emit('new_message', msg);

    return res.status(201).json({ success:true, message: msg });
  } catch (err) { return res.status(500).json({ success:false, message:err.message }); }
};

// POST /api/chat/open  — open chat after auction won (called by seller)
exports.openChat = async (req, res) => {
  const { auctionId } = req.body;
  if (!auctionId) return res.status(400).json({ success:false, message:'auctionId required.' });
  try {
    const auction = await prisma.auction.findUnique({ where:{ id:auctionId } });
    if (!auction) return res.status(404).json({ success:false, message:'Auction not found.' });
    if (auction.sellerId !== req.user.id) return res.status(403).json({ success:false, message:'Not your auction.' });
    if (auction.status === 'ACTIVE') return res.status(400).json({ success:false, message:'Auction is still active.' });

    // Find highest bidder
    const winBid = await prisma.bid.findFirst({ where:{ auctionId }, orderBy:{ amount:'desc' } });
    if (!winBid) return res.status(400).json({ success:false, message:'No bids on this auction.' });

    // Create or return existing chat
    const existing = await prisma.chat.findUnique({ where:{ auctionId } });
    if (existing) return res.json({ success:true, chat:existing });

    const chat = await prisma.chat.create({ data:{ auctionId, sellerId:req.user.id, winnerId:winBid.userId } });

    await prisma.auction.update({ where:{ id:auctionId }, data:{ status:'SOLD' } });

    await prisma.notification.create({ data: {
      userId: winBid.userId, type:'AUCTION_WON', auctionId,
      message:`Congratulations! You won the auction "${auction.title}" with a bid of ৳${winBid.amount.toLocaleString('en-BD')}. The seller wants to chat with you.`
    }});

    return res.status(201).json({ success:true, chat });
  } catch (err) { return res.status(500).json({ success:false, message:err.message }); }
};

// ── NOTIFICATIONS ─────────────────────────────

// GET /api/notifications
exports.getNotifications = async (req, res) => {
  try {
    const notes = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt:'desc' },
      take: 20
    });
    return res.json({ success:true, notifications:notes });
  } catch (err) { return res.status(500).json({ success:false, message:err.message }); }
};

// PUT /api/notifications/read-all
exports.markAllRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({ where:{ userId:req.user.id, read:false }, data:{ read:true } });
    return res.json({ success:true, message:'All notifications marked read.' });
  } catch (err) { return res.status(500).json({ success:false, message:err.message }); }
};
