module.exports = {
  verbose: true,
  moduleDirectories: [
    "node_modules",
    "packages/bot"
  ],
  preset: 'ts-jest',
  testEnvironment: 'node',
  runner: 'jest-serial-runner',
  setupFiles: ['dotenv/config', '<rootDir>/.jest/test-env.js']
};