import { setDefaultTimeout } from '@cucumber/cucumber'

// Pass additional param to "npm run cucumber -- --require test/features/lib/cucumber-no-timeout.js"
setDefaultTimeout(3600 * 1000)