const r = require('express').Router();
const c = require('../controllers/cartOrderController');
const { protect } = require('../middleware/auth');

// Cart
r.post('/cart/add',         protect, c.addToCart);
r.get('/cart',              protect, c.getCart);
r.put('/cart/:id',          protect, c.updateCartQty);
r.delete('/cart/:id',       protect, c.removeFromCart);
r.delete('/cart/clear',     protect, c.clearCart);

// Orders
r.post('/orders/checkout',  protect, c.checkout);
r.get('/orders',            protect, c.getMyOrders);
r.get('/orders/seller',     protect, c.getSellerOrders);
r.put('/orders/:id/status', protect, c.updateOrderStatus);

module.exports = r;
