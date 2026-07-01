const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const protect = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer '))
    return res.status(401).json({ success: false, message: 'Not authorized. Please log in.' });
  try {
    const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
    req.user = await prisma.user.findUnique({ where: { id: decoded.id }, select: { id:true, username:true, email:true, role:true, fullName:true, phone:true } });
    if (!req.user) return res.status(401).json({ success: false, message: 'User not found.' });
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token invalid or expired.' });
  }
};

const optionalAuth = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
      req.user = await prisma.user.findUnique({ where: { id: decoded.id }, select: { id:true, username:true, email:true, role:true, fullName:true } });
    } catch {}
  }
  next();
};

const adminOnly = (req, res, next) => {
  if (req.user?.role === 'ADMIN') return next();
  return res.status(403).json({ success: false, message: 'Admin access required.' });
};

const sellerOnly = (req, res, next) => {
  if (['SELLER','BOTH','ADMIN'].includes(req.user?.role)) return next();
  return res.status(403).json({ success: false, message: 'Seller account required.' });
};

module.exports = { protect, optionalAuth, adminOnly, sellerOnly };
