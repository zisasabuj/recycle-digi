// routes/auth.js
const r = require('express').Router();
const c = require('../controllers/authController');
const { protect } = require('../middleware/auth');
r.post('/register', c.register);
r.post('/login',    c.login);
r.get('/me',        protect, c.getMe);
r.put('/me',        protect, c.updateMe);
r.put('/change-password', protect, c.changePassword);
module.exports = r;
