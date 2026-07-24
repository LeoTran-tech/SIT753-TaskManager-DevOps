const client = require('prom-client');

const register = new client.Registry();

register.setDefaultLabels({
  service: 'task-manager-api'
});

// Node.js/runtime metrics:
// CPU, memory, event loop, garbage collection, etc.
client.collectDefaultMetrics({
  register,
  prefix: 'task_manager_'
});

const httpRequestsTotal = new client.Counter({
  name: 'task_manager_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'status_code'],
  registers: [register]
});

const httpRequestDurationSeconds = new client.Histogram({
  name: 'task_manager_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register]
});

function metricsMiddleware(req, res, next) {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const finishedAt = process.hrtime.bigint();

    const durationSeconds =
      Number(finishedAt - startedAt) / 1_000_000_000;

    const labels = {
      method: req.method,
      status_code: String(res.statusCode)
    };

    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, durationSeconds);
  });

  next();
}

async function metricsHandler(req, res) {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}

module.exports = {
  register,
  metricsMiddleware,
  metricsHandler
};