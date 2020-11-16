let common = [
    'test/features/**/*.feature',
    // '--require-module ts-node/register',
    '--require .jest/test-env.js',
    '--require test/features/**/*.ts',
    '--format progress-bar',
    '--publish-quiet'
].join(' ');

require('source-map-support').install();
require('ts-node').register();
require('dotenv').config();


module.exports = {
    default: common
};