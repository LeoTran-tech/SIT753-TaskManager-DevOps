require('dotenv').config();

const app = require('./app');
const { initDatabase } = require('./database/db');

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET is not configured');
        }

        await initDatabase();

        app.listen(PORT, () => {
            console.log(
                `Task Manager API is running on http://localhost:${PORT}`
            );
        });
    } catch (error) {
        console.error('Failed to start application:', error);
        process.exit(1);
    }
}

startServer();