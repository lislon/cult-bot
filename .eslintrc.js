module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: [
        '@typescript-eslint',
        'jest'
    ],
    ignorePatterns: [
        '/packages/*/dist/',
        '/packages/*/docs/',
        '/packages/*/typings/',
        '/packages/*/migrations/',
        '/packages/*/**/*.js',
        '/packages/bot/test/',
    ],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:jest/recommended',
        // 'prettier',
        // 'prettier/@typescript-eslint'
    ],
    "env": {
        "browser": true,
        "es6": true,
        "node": true
    }
};