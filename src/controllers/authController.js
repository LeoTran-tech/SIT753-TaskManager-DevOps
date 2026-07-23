const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { getDb } = require('../database/db');

// POST /api/auth/register
const register = async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({
            error: 'A valid name is required'
        });
    }

    if (!email || typeof email !== 'string' || email.trim() === '') {
        return res.status(400).json({
            error: 'A valid email is required'
        });
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({
            error: 'Password must contain at least 8 characters'
        });
    }

    const db = getDb();

    const normalisedEmail = email.trim().toLowerCase();

    const existingUser = await db.get(
        'SELECT id FROM users WHERE email = ?',
        normalisedEmail
    );

    if (existingUser) {
        return res.status(409).json({
            error: 'An account with this email already exists'
        });
    }

    const id = randomUUID();

    const hashedPassword = await bcrypt.hash(password, 12);

    await db.run(
        `
        INSERT INTO users (id, name, email, password)
        VALUES (?, ?, ?, ?)
        `,
        id,
        name.trim(),
        normalisedEmail,
        hashedPassword
    );

    res.status(201).json({
        message: 'User registered successfully',
        user: {
            id,
            name: name.trim(),
            email: normalisedEmail
        }
    });
};

// POST /api/auth/login
const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            error: 'Email and password are required'
        });
    }

    const db = getDb();

    const normalisedEmail = email.trim().toLowerCase();

    const user = await db.get(
        'SELECT * FROM users WHERE email = ?',
        normalisedEmail
    );

    if (!user) {
        return res.status(401).json({
            error: 'Invalid email or password'
        });
    }

    const passwordMatches = await bcrypt.compare(
        password,
        user.password
    );

    if (!passwordMatches) {
        return res.status(401).json({
            error: 'Invalid email or password'
        });
    }

    const token = jwt.sign(
        {
            userId: user.id,
            email: user.email
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || '1h'
        }
    );

    res.status(200).json({
        message: 'Login successful',
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email
        }
    });
};

module.exports = {
    register,
    login
};