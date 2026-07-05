/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  setupFiles: ['<rootDir>/test/env.ts'],
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { esModuleInterop: true, skipLibCheck: true, strict: false } }],
  },
  testTimeout: 600000,
};
