const express = require('express');

const taskRoutes = require('./routes/taskRoutes');
const authRoutes = require('./routes/authRoutes');
const {
  metricsMiddleware,
  metricsHandler
} = require('./monitoring/metrics');

const app = express();

app.use(express.json());
app.use(metricsMiddleware);

// Home endpoint
app.get('/', (req, res) => {
    res.status(200).json({
        name: 'Task Manager API',
        message: 'Task Manager API is running',
        version: '1.0.0'
    });
});

// Health endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

app.get('/metrics', metricsHandler);

// Authentication API
app.use('/api/auth', authRoutes);

// Task API
app.use('/api/tasks', taskRoutes);

// Unknown endpoints
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found'
    });
});

module.exports = app;