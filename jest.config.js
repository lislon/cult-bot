module.exports = {
    roots: [
        '<rootDir>/test'
    ],
    preset: 'ts-jest',
    testEnvironment: 'node',
    runner: 'jest-serial-runner',
    setupFiles: ['dotenv/config', '<rootDir>/.jest/set-env.js'],

    // projects: [
    //     {
    //         displayName: 'unit',
    //         preset: 'ts-jest',
    //         testEnvironment: 'node',
    //         testPathIgnorePatterns: ['<rootDir>/test/functional/'],
    //         setupFiles: ['dotenv/config', '<rootDir>/.jest/set-env.js'],
    //     },
    //     {
    //         displayName: 'it',
    //         preset: 'ts-jest',
    //         runner: 'jest-serial-runner',
    //         testEnvironment: 'node',
    //         testMatch: ['<rootDir>/test/functional/**/*.test.[tj]s'],
    //         setupFiles: ['dotenv/config', '<rootDir>/.jest/set-env.js'],
    //     }
    // ]
};