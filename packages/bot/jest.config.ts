// jest.config.ts
import type {Config} from '@jest/types';

// Sync object
const config: Config.InitialOptions = {
  verbose: true,
  moduleDirectories: [
    "../../node_modules",
    "node_modules",
    "../../node_modules/@types",
    "./node_modules/@types",
  ],
  preset: 'ts-jest',
  testEnvironment: 'node',
  runner: 'jest-serial-runner',
  setupFiles: ['dotenv/config', '<rootDir>/.jest/test-env.js']
};
export default config;