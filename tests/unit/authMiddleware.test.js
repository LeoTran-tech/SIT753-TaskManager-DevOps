const jwt = require('jsonwebtoken');
const authenticateToken = require(
    '../../src/middleware/authMiddleware'
);

describe('Authentication Middleware - Unit Tests', () => {
    beforeAll(() => {
        process.env.JWT_SECRET = 'unit-test-secret';
    });

    test('should reject request when authorization header is missing', () => {
        const req = {
            headers: {}
        };

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        const next = jest.fn();

        authenticateToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Authentication token is required'
        });
        expect(next).not.toHaveBeenCalled();
    });

    test('should reject invalid authorization format', () => {
        const req = {
            headers: {
                authorization: 'invalid-format'
            }
        };

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        const next = jest.fn();

        authenticateToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Invalid authorization format'
        });
        expect(next).not.toHaveBeenCalled();
    });

    test('should reject an invalid JWT', () => {
        const req = {
            headers: {
                authorization: 'Bearer invalid-token'
            }
        };

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        const next = jest.fn();

        authenticateToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Invalid or expired token'
        });
        expect(next).not.toHaveBeenCalled();
    });

    test('should accept a valid JWT', () => {
        const token = jwt.sign(
            {
                userId: 'test-user-id',
                email: 'test@example.com'
            },
            process.env.JWT_SECRET
        );

        const req = {
            headers: {
                authorization: `Bearer ${token}`
            }
        };

        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        const next = jest.fn();

        authenticateToken(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);

        expect(req.user).toEqual(
            expect.objectContaining({
                userId: 'test-user-id',
                email: 'test@example.com'
            })
        );
    });
});