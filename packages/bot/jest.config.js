module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    runner: 'jest-serial-runner',
    setupFiles: ['dotenv/config', '<rootDir>/.jest/test-env.js']
};