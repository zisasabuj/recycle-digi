const r = require('express').Router();
const c = require('../controllers/auctionController');
const { protect, optionalAuth } = require('../middleware/auth');

r.get('/',                    optionalAuth, c.getAuctions);
r.get('/categories/list',     c.getCategories);
r.get('/seller/mine',         protect, c.getMyAuctions);
r.get('/:id',                 optionalAuth, c.getAuction);
r.post('/',                   protect, c.createAuction);
r.put('/:id',                 protect, c.updateAuction);
r.delete('/:id',              protect, c.deleteAuction);

module.exports = r;
