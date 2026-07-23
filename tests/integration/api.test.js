const request = require('supertest');

const app = require('../../src/app');

const {
    initDatabase,
    getDb,
    closeDatabase
} = require('../../src/database/db');

describe('Task Manager API - Integration Tests', () => {
    beforeAll(async () => {
        process.env.JWT_SECRET = 'integration-test-secret';
        process.env.JWT_EXPIRES_IN = '1h';

        await initDatabase();
    });

    beforeEach(async () => {
        const db = getDb();

        await db.run('DELETE FROM tasks');
        await db.run('DELETE FROM users');
    });

    afterAll(async () => {
        await closeDatabase();
    });

    async function registerAndLogin(
        email = 'test@example.com',
        name = 'Test User'
    ) {
        const password = 'SecurePassword123!';

        await request(app)
            .post('/api/auth/register')
            .send({
                name,
                email,
                password
            })
            .expect(201);

        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({
                email,
                password
            })
            .expect(200);

        return loginResponse.body.token;
    }

    test('GET /health should return healthy status', async () => {
        const response = await request(app)
            .get('/health')
            .expect(200);

        expect(response.body.status).toBe('healthy');
    });

    test('unknown endpoint should return 404', async () => {
        const response = await request(app)
            .get('/does-not-exist')
            .expect(404);

        expect(response.body).toEqual({
            error: 'Endpoint not found'
        });
    });

    test('user should be able to register', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Test User',
                email: 'test@example.com',
                password: 'SecurePassword123!'
            })
            .expect(201);

        expect(response.body.message).toBe(
            'User registered successfully'
        );

        expect(response.body.user.email).toBe(
            'test@example.com'
        );

        expect(response.body.user.password).toBeUndefined();
    });

    test('registration should reject short passwords', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Test User',
                email: 'test@example.com',
                password: '123'
            })
            .expect(400);

        expect(response.body.error).toBe(
            'Password must contain at least 8 characters'
        );
    });

    test('duplicate registration should be rejected', async () => {
        const user = {
            name: 'Test User',
            email: 'test@example.com',
            password: 'SecurePassword123!'
        };

        await request(app)
            .post('/api/auth/register')
            .send(user)
            .expect(201);

        const response = await request(app)
            .post('/api/auth/register')
            .send(user)
            .expect(409);

        expect(response.body.error).toBe(
            'An account with this email already exists'
        );
    });

    test('registered user should be able to login', async () => {
        await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Test User',
                email: 'test@example.com',
                password: 'SecurePassword123!'
            })
            .expect(201);

        const response = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'test@example.com',
                password: 'SecurePassword123!'
            })
            .expect(200);

        expect(response.body.message).toBe('Login successful');
        expect(response.body.token).toBeDefined();
    });

    test('login should reject incorrect password', async () => {
        await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Test User',
                email: 'test@example.com',
                password: 'SecurePassword123!'
            })
            .expect(201);

        const response = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'test@example.com',
                password: 'WrongPassword123!'
            })
            .expect(401);

        expect(response.body.error).toBe(
            'Invalid email or password'
        );
    });

    test('GET /api/tasks should reject unauthenticated users', async () => {
        const response = await request(app)
            .get('/api/tasks')
            .expect(401);

        expect(response.body.error).toBe(
            'Authentication token is required'
        );
    });

    test('authenticated user should be able to create a task', async () => {
        const token = await registerAndLogin();

        const response = await request(app)
            .post('/api/tasks')
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'Build Jenkins Pipeline',
                description: 'Create CI/CD pipeline'
            })
            .expect(201);

        expect(response.body.title).toBe(
            'Build Jenkins Pipeline'
        );

        expect(response.body.completed).toBe(false);
    });

    test('task creation should reject an empty title', async () => {
        const token = await registerAndLogin();

        const response = await request(app)
            .post('/api/tasks')
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: ''
            })
            .expect(400);

        expect(response.body.error).toBe(
            'A valid title is required'
        );
    });

    test('authenticated user should be able to list tasks', async () => {
        const token = await registerAndLogin();

        await request(app)
            .post('/api/tasks')
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'Task One'
            })
            .expect(201);

        const response = await request(app)
            .get('/api/tasks')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(response.body).toHaveLength(1);
        expect(response.body[0].title).toBe('Task One');
    });

    test('authenticated user should be able to retrieve a task by id', async () => {
        const token = await registerAndLogin();

        const created = await request(app)
            .post('/api/tasks')
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'Read Me'
            })
            .expect(201);

        const response = await request(app)
            .get(`/api/tasks/${created.body.id}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(response.body.title).toBe('Read Me');
    });

    test('authenticated user should be able to update a task', async () => {
        const token = await registerAndLogin();

        const created = await request(app)
            .post('/api/tasks')
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'Original Task'
            })
            .expect(201);

        const response = await request(app)
            .put(`/api/tasks/${created.body.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'Updated Task',
                completed: true
            })
            .expect(200);

        expect(response.body.title).toBe('Updated Task');
        expect(response.body.completed).toBe(true);
    });

    test('update should reject invalid completed value', async () => {
        const token = await registerAndLogin();

        const created = await request(app)
            .post('/api/tasks')
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'Test Task'
            })
            .expect(201);

        const response = await request(app)
            .put(`/api/tasks/${created.body.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                completed: 'yes'
            })
            .expect(400);

        expect(response.body.error).toBe(
            'Completed must be true or false'
        );
    });

    test('authenticated user should be able to delete a task', async () => {
        const token = await registerAndLogin();

        const created = await request(app)
            .post('/api/tasks')
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'Delete Me'
            })
            .expect(201);

        const response = await request(app)
            .delete(`/api/tasks/${created.body.id}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(response.body.message).toBe(
            'Task deleted successfully'
        );

        const tasks = await request(app)
            .get('/api/tasks')
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(tasks.body).toHaveLength(0);
    });

    test('users should not be able to access another users task', async () => {
        const leoToken = await registerAndLogin(
            'leo@example.com',
            'Leo'
        );

        const aliceToken = await registerAndLogin(
            'alice@example.com',
            'Alice'
        );

        const leoTask = await request(app)
            .post('/api/tasks')
            .set('Authorization', `Bearer ${leoToken}`)
            .send({
                title: 'Leo Private Task'
            })
            .expect(201);

        await request(app)
            .get(`/api/tasks/${leoTask.body.id}`)
            .set('Authorization', `Bearer ${aliceToken}`)
            .expect(404);

        const aliceTasks = await request(app)
            .get('/api/tasks')
            .set('Authorization', `Bearer ${aliceToken}`)
            .expect(200);

        expect(aliceTasks.body).toHaveLength(0);
    });
});