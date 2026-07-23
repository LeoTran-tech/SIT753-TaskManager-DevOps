const { randomUUID } = require('crypto');
const { getDb } = require('../database/db');

// GET /api/tasks
const getAllTasks = async (req, res) => {
    const db = getDb();

    const tasks = await db.all(
        `
        SELECT
            id,
            title,
            description,
            completed,
            created_at
        FROM tasks
        WHERE user_id = ?
        ORDER BY created_at DESC
        `,
        req.user.userId
    );

    const formattedTasks = tasks.map((task) => ({
        ...task,
        completed: Boolean(task.completed)
    }));

    res.status(200).json(formattedTasks);
};

// GET /api/tasks/:id
const getTaskById = async (req, res) => {
    const db = getDb();

    const task = await db.get(
        `
        SELECT
            id,
            title,
            description,
            completed,
            created_at
        FROM tasks
        WHERE id = ? AND user_id = ?
        `,
        req.params.id,
        req.user.userId
    );

    if (!task) {
        return res.status(404).json({
            error: 'Task not found'
        });
    }

    task.completed = Boolean(task.completed);

    res.status(200).json(task);
};

// POST /api/tasks
const createTask = async (req, res) => {
    const { title, description } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({
            error: 'A valid title is required'
        });
    }

    const db = getDb();
    const id = randomUUID();

    await db.run(
        `
        INSERT INTO tasks (
            id,
            user_id,
            title,
            description,
            completed
        )
        VALUES (?, ?, ?, ?, ?)
        `,
        id,
        req.user.userId,
        title.trim(),
        typeof description === 'string'
            ? description.trim()
            : '',
        0
    );

    const newTask = await db.get(
        `
        SELECT
            id,
            title,
            description,
            completed,
            created_at
        FROM tasks
        WHERE id = ? AND user_id = ?
        `,
        id,
        req.user.userId
    );

    newTask.completed = Boolean(newTask.completed);

    res.status(201).json(newTask);
};

// PUT /api/tasks/:id
const updateTask = async (req, res) => {
    const db = getDb();

    const existingTask = await db.get(
        `
        SELECT *
        FROM tasks
        WHERE id = ? AND user_id = ?
        `,
        req.params.id,
        req.user.userId
    );

    if (!existingTask) {
        return res.status(404).json({
            error: 'Task not found'
        });
    }

    const { title, description, completed } = req.body;

    if (
        title !== undefined &&
        (typeof title !== 'string' || title.trim() === '')
    ) {
        return res.status(400).json({
            error: 'Title must be a non-empty string'
        });
    }

    if (
        description !== undefined &&
        typeof description !== 'string'
    ) {
        return res.status(400).json({
            error: 'Description must be a string'
        });
    }

    if (
        completed !== undefined &&
        typeof completed !== 'boolean'
    ) {
        return res.status(400).json({
            error: 'Completed must be true or false'
        });
    }

    const updatedTitle =
        title !== undefined
            ? title.trim()
            : existingTask.title;

    const updatedDescription =
        description !== undefined
            ? description.trim()
            : existingTask.description;

    const updatedCompleted =
        completed !== undefined
            ? (completed ? 1 : 0)
            : existingTask.completed;

    await db.run(
        `
        UPDATE tasks
        SET title = ?, description = ?, completed = ?
        WHERE id = ? AND user_id = ?
        `,
        updatedTitle,
        updatedDescription,
        updatedCompleted,
        req.params.id,
        req.user.userId
    );

    const updatedTask = await db.get(
        `
        SELECT
            id,
            title,
            description,
            completed,
            created_at
        FROM tasks
        WHERE id = ? AND user_id = ?
        `,
        req.params.id,
        req.user.userId
    );

    updatedTask.completed = Boolean(updatedTask.completed);

    res.status(200).json(updatedTask);
};

// DELETE /api/tasks/:id
const deleteTask = async (req, res) => {
    const db = getDb();

    const task = await db.get(
        `
        SELECT *
        FROM tasks
        WHERE id = ? AND user_id = ?
        `,
        req.params.id,
        req.user.userId
    );

    if (!task) {
        return res.status(404).json({
            error: 'Task not found'
        });
    }

    await db.run(
        `
        DELETE FROM tasks
        WHERE id = ? AND user_id = ?
        `,
        req.params.id,
        req.user.userId
    );

    task.completed = Boolean(task.completed);
    delete task.user_id;

    res.status(200).json({
        message: 'Task deleted successfully',
        task
    });
};

module.exports = {
    getAllTasks,
    getTaskById,
    createTask,
    updateTask,
    deleteTask
};