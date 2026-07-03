const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { sendEmail } = require('./email.controller');

exports.register = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = await db.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const result = await db.query(
      'INSERT INTO users (username, password_hash, is_approved) VALUES ($1, $2, $3) RETURNING id, username',
      [username, password_hash, false]
    );

    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      await sendEmail({
        to: adminEmail,
        subject: 'New User Registration Pending Approval',
        text: `User ${username} has registered and is waiting for approval.`
      });
    }

    res.status(201).json({
      message: 'User registered successfully. Pending admin approval.',
      user: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    if (!user.is_approved) {
      return res.status(403).json({ error: 'Account pending admin approval.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      message: 'Login successful.',
      token,
      user: { id: user.id, username: user.username },
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username is required.' });
    }

    const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(200).json({ message: 'If an account exists, a recovery link has been sent.' });
    }

    res.status(200).json({ message: 'If an account exists, a recovery link has been sent.' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};

exports.approveUser = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('UPDATE users SET is_approved = true WHERE id = $1', [id]);
    res.status(200).json({ message: 'User approved.' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
};