const jwt    = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const sign = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
const safe = (u)  => ({ id: u.id, username: u.username, email: u.email, role: u.role, fullName: u.fullName, phone: u.phone, createdAt: u.createdAt });

// POST /api/auth/register
exports.register = async (req, res) => {
  const { username, email, password, fullName, phone } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ success: false, message: 'Username, email and password are required.' });

  try {
    if (await prisma.user.findUnique({ where: { email } }))
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    if (await prisma.user.findUnique({ where: { username } }))
      return res.status(409).json({ success: false, message: 'Username already taken.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, email, passwordHash, role: 'USER', fullName: fullName || '', phone: phone || '' }
    });
    return res.status(201).json({ success: true, token: sign(user.id), user: safe(user) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash)))
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    return res.json({ success: true, token: sign(user.id), user: safe(user) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  return res.json({ success: true, user: req.user });
};

// PUT /api/auth/me
exports.updateMe = async (req, res) => {
  const { fullName, phone } = req.body;
  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data:  { fullName: fullName || '', phone: phone || '' }
    });
    return res.json({ success: true, user: safe(user) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/auth/change-password
exports.changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword || newPassword.length < 6)
    return res.status(400).json({ success: false, message: 'Old password and new password (min 6 chars) required.' });
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!(await bcrypt.compare(oldPassword, user.passwordHash)))
      return res.status(400).json({ success: false, message: 'Current password incorrect.' });
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });
    return res.json({ success: true, message: 'Password updated.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
