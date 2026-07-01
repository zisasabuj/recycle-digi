const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ── CART ─────────────────────────────────────

// POST /api/cart/add
exports.addToCart = async (req, res) => {
  const { auctionId } = req.body;
  if (!auctionId) return res.status(400).json({ success:false, message:'auctionId required.' });

  try {
    const auction = await prisma.auction.findUnique({ where:{ id:auctionId } });
    if (!auction) return res.status(404).json({ success:false, message:'Item not found.' });
    if (auction.status !== 'ACTIVE') return res.status(400).json({ success:false, message:'Item not available.' });
    if (auction.sellType !== 'DIRECT') return res.status(400).json({ success:false, message:'This item is auction-only.' });
    if (auction.sellerId === req.user.id) return res.status(400).json({ success:false, message:'Cannot buy your own item.' });

    const existing = await prisma.cartItem.findUnique({
      where:{ userId_auctionId:{ userId:req.user.id, auctionId } }
    });

    if (existing) {
      await prisma.cartItem.update({
        where:{ id:existing.id },
        data:{ quantity:{ increment:1 } }
      });
    } else {
      await prisma.cartItem.create({
        data:{ userId:req.user.id, auctionId, quantity:1 }
      });
    }

    return res.json({ success:true, message:'Added to cart.' });
  } catch (err) { return res.status(500).json({ success:false, message:err.message }); }
};

// GET /api/cart
exports.getCart = async (req, res) => {
  try {
    const items = await prisma.cartItem.findMany({
      where:{ userId:req.user.id },
      include:{ auction:{ include:{ seller:{ select:{ username:true } } } } },
      orderBy:{ createdAt:'desc' }
    });
    const parsed = items.map(i => ({
      ...i,
      auction:{ ...i.auction, images: JSON.parse(i.auction.images || '[]') }
    }));
    const total = parsed.reduce((s, i) => s + (i.auction.basePrice * i.quantity), 0);
    return res.json({ success:true, items:parsed, total });
  } catch (err) { return res.status(500).json({ success:false, message:err.message }); }
};

// PUT /api/cart/:id  (update quantity)
exports.updateCartQty = async (req, res) => {
  const { quantity } = req.body;
  if (!quantity || quantity < 1) return res.status(400).json({ success:false, message:'Quantity must be >= 1.' });

  try {
    const item = await prisma.cartItem.findUnique({ where:{ id:req.params.id } });
    if (!item || item.userId !== req.user.id) return res.status(404).json({ success:false, message:'Cart item not found.' });

    await prisma.cartItem.update({ where:{ id:req.params.id }, data:{ quantity: parseInt(quantity) } });
    return res.json({ success:true, message:'Quantity updated.' });
  } catch (err) { return res.status(500).json({ success:false, message:err.message }); }
};

// DELETE /api/cart/:id
exports.removeFromCart = async (req, res) => {
  try {
    const item = await prisma.cartItem.findUnique({ where:{ id:req.params.id } });
    if (!item || item.userId !== req.user.id) return res.status(404).json({ success:false, message:'Cart item not found.' });

    await prisma.cartItem.delete({ where:{ id:req.params.id } });
    return res.json({ success:true, message:'Removed from cart.' });
  } catch (err) { return res.status(500).json({ success:false, message:err.message }); }
};

// DELETE /api/cart/clear
exports.clearCart = async (req, res) => {
  try {
    await prisma.cartItem.deleteMany({ where:{ userId:req.user.id } });
    return res.json({ success:true, message:'Cart cleared.' });
  } catch (err) { return res.status(500).json({ success:false, message:err.message }); }
};

// ── ORDERS ───────────────────────────────────

// POST /api/orders/checkout  (place order from cart)
exports.checkout = async (req, res) => {
  const { address, phone, note } = req.body;

  try {
    const cartItems = await prisma.cartItem.findMany({
      where:{ userId:req.user.id },
      include:{ auction:true }
    });

    if (!cartItems.length) return res.status(400).json({ success:false, message:'Cart is empty.' });

    // Validate all items still active & direct
    for (const ci of cartItems) {
      if (ci.auction.status !== 'ACTIVE') return res.status(400).json({ success:false, message:`"${ci.auction.title}" is no longer available.` });
      if (ci.auction.sellType !== 'DIRECT') return res.status(400).json({ success:false, message:`"${ci.auction.title}" is auction-only.` });
    }

    // Create orders
    const orders = [];
    for (const ci of cartItems) {
      const order = await prisma.order.create({
        data:{
          buyerId: req.user.id,
          sellerId: ci.auction.sellerId,
          auctionId: ci.auctionId,
          amount: ci.auction.basePrice * ci.quantity,
          address: address || req.user.address || '',
          phone: phone || req.user.phone || '',
          note: note || '',
          status: 'PENDING'
        }
      });

      // Mark auction as sold
      await prisma.auction.update({
        where:{ id:ci.auctionId },
        data:{ status:'SOLD' }
      });

      // Notify seller
      await prisma.notification.create({
        data:{
          userId: ci.auction.sellerId,
          type:'NEW_ORDER',
          auctionId: ci.auctionId,
          message:`New order for "${ci.auction.title}" — ৳${(ci.auction.basePrice * ci.quantity).toLocaleString('en-BD')}`
        }
      });

      orders.push(order);
    }

    // Clear cart
    await prisma.cartItem.deleteMany({ where:{ userId:req.user.id } });

    return res.status(201).json({ success:true, orders, message:`${orders.length} order(s) placed!` });
  } catch (err) { return res.status(500).json({ success:false, message:err.message }); }
};

// GET /api/orders  (my orders — as buyer)
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where:{ buyerId:req.user.id },
      include:{
        auction:{ select:{ id:true, title:true, images:true, sellerId:true, condition:true } },
        seller:{ select:{ username:true, fullName:true, phone:true } }
      },
      orderBy:{ createdAt:'desc' }
    });
    const parsed = orders.map(o => ({
      ...o,
      auction:{ ...o.auction, images: JSON.parse(o.auction.images || '[]') }
    }));
    return res.json({ success:true, orders:parsed });
  } catch (err) { return res.status(500).json({ success:false, message:err.message }); }
};

// GET /api/orders/seller  (orders received — as seller)
exports.getSellerOrders = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where:{ sellerId:req.user.id },
      include:{
        auction:{ select:{ id:true, title:true, images:true, condition:true } },
        buyer:{ select:{ username:true, fullName:true, phone:true } }
      },
      orderBy:{ createdAt:'desc' }
    });
    const parsed = orders.map(o => ({
      ...o,
      auction:{ ...o.auction, images: JSON.parse(o.auction.images || '[]') }
    }));
    return res.json({ success:true, orders:parsed });
  } catch (err) { return res.status(500).json({ success:false, message:err.message }); }
};

// PUT /api/orders/:id/status  (seller updates order status)
exports.updateOrderStatus = async (req, res) => {
  const { status } = req.body;
  const valid = ['PENDING','CONFIRMED','SHIPPED','DELIVERED','CANCELLED'];
  if (!valid.includes(status)) return res.status(400).json({ success:false, message:'Invalid status.' });

  try {
    const order = await prisma.order.findUnique({ where:{ id:req.params.id } });
    if (!order) return res.status(404).json({ success:false, message:'Order not found.' });
    if (order.sellerId !== req.user.id) return res.status(403).json({ success:false, message:'Not your order.' });

    const updated = await prisma.order.update({
      where:{ id:req.params.id },
      data:{ status }
    });

    // Notify buyer
    await prisma.notification.create({
      data:{
        userId: order.buyerId,
        type:'ORDER_UPDATE',
        message:`Your order status updated to "${status}"`
      }
    });

    return res.json({ success:true, order:updated });
  } catch (err) { return res.status(500).json({ success:false, message:err.message }); }
};
