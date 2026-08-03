import type { Config } from 'jest';

const config: Config = {
  extensionsToTreatAsEsm: ['.ts'],
  moduleFileExtensions: ['js', 'json', 'ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  rootDir: '.',
  setupFiles: ['<rootDir>/setup-env.ts'],
  testEnvironment: 'node',
  testRegex: '.integration-spec.ts$',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/../tsconfig.json',
        useESM: true,
      },
    ],
  },
};

export default config;
