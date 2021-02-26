module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: [
        '@typescript-eslint',
        'jest'
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