module.exports = {
    roots: [
        '<rootDir>/test'
    ],
    setupFiles: ['dotenv/config', '<rootDir>/.jest/set-env.js'],
    projects: [
        {
            displayName: 'unit',
            preset: 'ts-jest',
            testEnvironment: 'node',
            testPathIgnorePatterns: ['<rootDir>/test/functional/']
        },
        {
            displayName: 'it',
            preset: 'ts-jest',
            runner: 'jest-serial-runner',
            testEnvironment: 'node',
            testMatch: ['<rootDir>/test/functional/**/*.test.[tj]s']
        }
    ]
};