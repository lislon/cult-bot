module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  "roots": [
    "<rootDir>/test"
  ],
  setupFiles: ["dotenv/config", "<rootDir>/.jest/set-env.js"]
};