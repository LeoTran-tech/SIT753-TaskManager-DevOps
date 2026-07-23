const express = require('express');

const {
    getAllTasks,
    getTaskById,
    createTask,
    updateTask,
    deleteTask
} = require('../controllers/taskController');

const authenticateToken = require('../middleware/authMiddleware');

const router = express.Router();

// Every task endpoint requires a valid JWT
router.use(authenticateToken);

router.get('/', getAllTasks);
router.get('/:id', getTaskById);
router.post('/', createTask);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);

module.exports = router;