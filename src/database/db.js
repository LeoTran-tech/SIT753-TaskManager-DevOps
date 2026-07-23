const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

let db;

async function initDatabase() {
    if (db) {
        return db;
    }

    const databaseFile =
        process.env.NODE_ENV === 'test'
            ? ':memory:'
            : process.env.DB_PATH ||
              path.join(__dirname, '../../taskmanager.db');

    db = await open({
        filename: databaseFile,
        driver: sqlite3.Database
    });

    await db.exec(`
        PRAGMA foreign_keys = ON;
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            completed INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // Upgrade old local databases that do not yet contain user_id.
    if (process.env.NODE_ENV !== 'test') {
        const columns = await db.all(`PRAGMA table_info(tasks)`);

        const hasUserId = columns.some(
            (column) => column.name === 'user_id'
        );

        if (!hasUserId) {
            await db.exec(`
                ALTER TABLE tasks
                ADD COLUMN user_id TEXT
            `);

            console.log(
                'Database upgraded: user_id added to tasks'
            );
        }
    }

    if (process.env.NODE_ENV !== 'test') {
        console.log('SQLite database connected successfully');
    }

    return db;
}

function getDb() {
    if (!db) {
        throw new Error('Database has not been initialised');
    }

    return db;
}

async function closeDatabase() {
    if (db) {
        await db.close();
        db = null;
    }
}

module.exports = {
    initDatabase,
    getDb,
    closeDatabase
};