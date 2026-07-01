const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/auctions
exports.getAuctions = async (req, res) => {
  const { page=1, limit=12, search, category, condition, city, area, endingSoon, sellType, sort='endsAt', order='asc' } = req.query;
  const skip = (parseInt(page)-1)*parseInt(limit);

  const where = { status: 'ACTIVE' };
  if (search)      where.OR = [{ title:{ contains:search } }, { description:{ contains:search } }];
  if (category)    where.category  = category;
  if (condition)   where.condition = condition;
  if (city)        where.city      = city;
  if (area)        where.area      = area;
  if (sellType)    where.sellType  = sellType;
  if (endingSoon === 'true') where.endsAt = { lte: new Date(Date.now() + 48*3600*1000) };

  const allowedSorts = ['endsAt','createdAt','basePrice','currentMaxBid','viewCount'];
  const safeSort  = allowedSorts.includes(sort) ? sort : 'endsAt';
  const safeOrder = order === 'desc' ? 'desc' : 'asc';

  try {
    // Auto-expire
    await prisma.auction.updateMany({ where: { status:'ACTIVE', endsAt:{ lt: new Date() } }, data:{ status:'EXPIRED' } });

    const [total, auctions] = await Promise.all([
      prisma.auction.count({ where }),
      prisma.auction.findMany({
        where, skip, take: parseInt(limit),
        orderBy: { [safeSort]: safeOrder },
        include: { seller:{ select:{ username:true, fullName:true } }, _count:{ select:{ bids:true, watchlist:true } } }
      })
    ]);
    // Parse images JSON for each auction
    const parsed = auctions.map(a => ({ ...a, images: JSON.parse(a.images || '[]') }));
    return res.json({ success:true, total, page:parseInt(page), pages:Math.ceil(total/parseInt(limit)), auctions: parsed });
  } catch (err) { return res.status(500).json({ success:false, message:err.message }); }
};

// GET /api/auctions/:id
exports.getAuction = async (req, res) => {
  try {
    const auction = await prisma.auction.findUnique({
      where: { id: req.params.id },
      include: {
        seller: { select:{ id:true, username:true, fullName:true, phone:true } },
        _count: { select:{ bids:true, watchlist:true } }
      }
    });
    if (!auction) return res.status(404).json({ success:false, message:'Auction not found.' });

    // Increment view count
    await prisma.auction.update({ where:{ id:req.params.id }, data:{ viewCount:{ increment:1 } } });

    // Parse images
    auction.images = JSON.parse(auction.images || '[]');

    // Bids — sealed: only reveal amounts if auction ended OR if user is seller
    const isSellerOrAdmin = req.user && (req.user.id === auction.sellerId || req.user.role === 'ADMIN');
    const isExpired = auction.status !== 'ACTIVE';

    const bids = await prisma.bid.findMany({
      where: { auctionId: req.params.id },
      include: { user:{ select:{ username:true } } },
      orderBy: { createdAt:'desc' }
    });

    const safeBids = bids.map(b => ({
      id: b.id, createdAt: b.createdAt,
      username: b.user.username,
      amount: (isSellerOrAdmin || isExpired) ? b.amount : null,
      isSealed: !isExpired && !isSellerOrAdmin
    }));

    // Check if current user has bid or watchlisted
    let userBid = null, inWatchlist = false;
    if (req.user) {
      const ub = await prisma.bid.findFirst({ where:{ auctionId:req.params.id, userId:req.user.id }, orderBy:{ createdAt:'desc' } });
      userBid = ub ? { amount: ub.amount, createdAt: ub.createdAt } : null;
      const wl = await prisma.watchlist.findUnique({ where:{ userId_auctionId:{ userId:req.user.id, auctionId:req.params.id } } });
      inWatchlist = !!wl;
    }

    return res.json({ success:true, auction:{ ...auction, viewCount: auction.viewCount+1 }, bids: safeBids, userBid, inWatchlist });
  } catch (err) { return res.status(500).json({ success:false, message:err.message }); }
};

// POST /api/auctions  (seller only)
exports.createAuction = async (req, res) => {
  const { title, description, images, category, condition, sellType, basePrice, bidIncrement, city, area, endsAt } = req.body;
  if (!title || !description || !category || !basePrice || !endsAt)
    return res.status(400).json({ success:false, message:'Title, description, category, basePrice and endsAt are required.' });

  // Auto-determine sellType: NEW items are always DIRECT, USED can be AUCTION or DIRECT
  const finalSellType = (condition === 'NEW' || !sellType) ? 'DIRECT' : sellType;

  try {
    const auction = await prisma.auction.create({
      data: {
        sellerId: req.user.id, title, description,
        images: JSON.stringify(Array.isArray(images) ? images : (images ? [images] : [])),
        category, condition: condition || 'USED',
        sellType: finalSellType,
        basePrice: parseFloat(basePrice),
        bidIncrement: parseFloat(bidIncrement) || 50,
        currentMaxBid: 0,
        city: city || 'Dhaka', area: area || '',
        endsAt: new Date(endsAt), status: 'ACTIVE'
      }
    });
    auction.images = JSON.parse(auction.images || '[]');
    return res.status(201).json({ success:true, auction });
  } catch (err) { return res.status(500).json({ success:false, message:err.message }); }
};

// PUT /api/auctions/:id  (seller only, own auction)
exports.updateAuction = async (req, res) => {
  try {
    const auction = await prisma.auction.findUnique({ where:{ id:req.params.id } });
    if (!auction) return res.status(404).json({ success:false, message:'Auction not found.' });
    if (auction.sellerId !== req.user.id && req.user.role !== 'ADMIN')
      return res.status(403).json({ success:false, message:'Not your auction.' });
    if (auction.status !== 'ACTIVE' && auction.status !== 'DRAFT')
      return res.status(400).json({ success:false, message:'Cannot edit an ended auction.' });

    const { title, description, images, category, condition, basePrice, bidIncrement, city, area, endsAt, status } = req.body;
    const updated = await prisma.auction.update({
      where: { id:req.params.id },
      data: {
        ...(title       && { title }),
        ...(description && { description }),
        ...(images      && { images: JSON.stringify(Array.isArray(images) ? images : [images]) }),
        ...(category    && { category }),
        ...(condition   && { condition }),
        ...(basePrice   && { basePrice: parseFloat(basePrice) }),
        ...(bidIncrement&& { bidIncrement: parseFloat(bidIncrement) }),
        ...(city        && { city }),
        ...(area !== undefined && { area }),
        ...(endsAt      && { endsAt: new Date(endsAt) }),
        ...(status && ['DRAFT','ACTIVE'].includes(status) && { status }),
      }
    });
    return res.json({ success:true, auction:updated });
  } catch (err) { return res.status(500).json({ success:false, message:err.message }); }
};

// DELETE /api/auctions/:id  (seller/admin)
exports.deleteAuction = async (req, res) => {
  try {
    const auction = await prisma.auction.findUnique({ where:{ id:req.params.id } });
    if (!auction) return res.status(404).json({ success:false, message:'Auction not found.' });
    if (auction.sellerId !== req.user.id && req.user.role !== 'ADMIN')
      return res.status(403).json({ success:false, message:'Not your auction.' });
    await prisma.auction.delete({ where:{ id:req.params.id } });
    return res.json({ success:true, message:'Auction deleted.' });
  } catch (err) { return res.status(500).json({ success:false, message:err.message }); }
};

// GET /api/auctions/seller/mine  (seller dashboard)
exports.getMyAuctions = async (req, res) => {
  try {
    // Auto-expire first
    await prisma.auction.updateMany({ where:{ sellerId:req.user.id, status:'ACTIVE', endsAt:{ lt:new Date() } }, data:{ status:'EXPIRED' } });

    const auctions = await prisma.auction.findMany({
      where: { sellerId: req.user.id },
      include: { _count:{ select:{ bids:true, watchlist:true } } },
      orderBy: { createdAt:'desc' }
    });

    // Parse images for all auctions
    const parsed = auctions.map(a => ({ ...a, images: JSON.parse(a.images || '[]') }));

    const stats = {
      total:     auctions.length,
      active:    auctions.filter(a => a.status==='ACTIVE').length,
      expired:   auctions.filter(a => a.status==='EXPIRED').length,
      sold:      auctions.filter(a => a.status==='SOLD').length,
      totalBids: auctions.reduce((s,a) => s + a._count.bids, 0),
      totalViews:auctions.reduce((s,a) => s + a.viewCount, 0),
      earnings:  auctions.filter(a => a.status==='SOLD').reduce((s,a) => s + a.currentMaxBid, 0),
    };

    return res.json({ success:true, auctions: parsed, stats });
  } catch (err) { return res.status(500).json({ success:false, message:err.message }); }
};

// GET /api/auctions/categories/list
exports.getCategories = async (req, res) => {
  try {
    const cats = await prisma.auction.groupBy({ by:['category'], _count:{ category:true }, where:{ status:'ACTIVE' } });
    return res.json({ success:true, categories: cats.map(c => ({ name:c.category, count:c._count.category })) });
  } catch (err) { return res.status(500).json({ success:false, message:err.message }); }
};
