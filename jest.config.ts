import type { Config } from 'jest';

const config: Config = {
  collectCoverageFrom: [
    '<rootDir>/src/**/*.ts',
    '<rootDir>/scripts/**/*.ts',
    '!<rootDir>/**/*.spec.ts',
  ],
  coverageDirectory: '<rootDir>/coverage',
  extensionsToTreatAsEsm: ['.ts'],
  moduleFileExtensions: ['js', 'json', 'ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/scripts/**/*.spec.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
        useESM: true,
      },
    ],
  },
};

export default config;
