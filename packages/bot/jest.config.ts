// jest.config.ts
import type {Config} from '@jest/types';

// Sync object
const config: Config.InitialOptions = {
  verbose: false,
  moduleDirectories: [
    "../../node_modules",
    "node_modules",
    "../../node_modules/@types",
    "./node_modules/@types",
  ],
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['dotenv/config', '<rootDir>/.jest/test-env.js']
};
export default config;