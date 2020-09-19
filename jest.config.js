module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  "roots": [
    "<rootDir>/test"
  ],
  setupFiles: ["<rootDir>/.jest/set-env.js"]
};