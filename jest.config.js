module.exports = {
    moduleDirectories: [
        "node_modules",
        "packages/bot",
    ],
    globals: {
        'ts-jest': {
            tsConfigFile: "packages/bot/tsconfig.json"
        }
    },
    preset: 'ts-jest',
    testEnvironment: 'node',
    runner: 'jest-serial-runner',
    setupFiles: ['dotenv/config', '<rootDir>/.jest/test-env.js']
};