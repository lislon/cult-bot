import type { Config } from '@jest/types'

const config: Config.InitialOptions = {
    verbose: true,
    // moduleDirectories: [
    //   "../../node_modules",
    //   "node_modules",
    //   "../../node_modules/@types",
    //   "./node_modules/@types",
    // ],
    preset: 'ts-jest',
    testEnvironment: 'node',
    setupFiles: ['dotenv/config', '<rootDir>/.jest/test-env.js'],
    testMatch: ['<rootDir>/test/**/*.test.ts']
}
export default config