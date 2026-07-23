module.exports = {
    testEnvironment: 'node',

    clearMocks: true,

    collectCoverageFrom: [
        'src/**/*.js',
        '!src/server.js'
    ],

    coverageDirectory: 'coverage',

    coverageReporters: [
        'text',
        'lcov'
    ],

    coverageThreshold: {
        global: {
            statements: 80,
            branches: 70,
            functions: 80,
            lines: 80
        }
    }
};