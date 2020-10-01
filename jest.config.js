module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    runner: 'jest-serial-runner',
    setupFiles: ['dotenv/config', '<rootDir>/.jest/set-env.js'],
    roots: [
        '<rootDir>/test'
    ],
};