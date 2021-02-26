module.exports = {
    parser: '@typescript-eslint/parser',
    plugins: [
        '@typescript-eslint',
        'jest'
    ],
    rules: {
        "no-misleading-character-class": "warn",
        "@typescript-eslint/no-unused-vars": "off"
    },
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:jest/recommended',
        // 'prettier',
        // 'prettier/@typescript-eslint'
    ],
};