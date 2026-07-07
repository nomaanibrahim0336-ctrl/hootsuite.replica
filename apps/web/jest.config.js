/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { esModuleInterop: true, skipLibCheck: true, jsx: 'react-jsx' } }],
  },
  testTimeout: 30000,
};
