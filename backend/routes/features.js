const r = require('express').Router();
const c = require('../controllers/bidChatController');
const { protect } = require('../middleware/auth');

// Bids
r.post('/bids',                      protect, c.placeBid);
r.get('/bids/my',                    protect, c.getMyBids);

// Watchlist
r.post('/watchlist/toggle',          protect, c.toggleWatchlist);
r.get('/watchlist',                  protect, c.getWatchlist);

// Chat
r.get('/chat',                       protect, c.getChats);
r.get('/chat/:id',                   protect, c.getChatThread);
r.post('/chat/:id/message',          protect, c.sendMessage);
r.post('/chat/open',                 protect, c.openChat);

// Notifications
r.get('/notifications',              protect, c.getNotifications);
r.put('/notifications/read-all',     protect, c.markAllRead);

module.exports = r;
