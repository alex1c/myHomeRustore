/**
 * Jest configuration for unit / repository tests.
 * sql.js powers in-memory SQLite in Node for migration and integrity tests.
 */

/** @type {import('jest').Config} */
const config = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|sql\\.js)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testTimeout: 30000,
};

module.exports = config;
