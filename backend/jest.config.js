module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\.spec\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  coveragePathIgnorePatterns: ['\.module\.ts$', 'main\.ts'],
  testEnvironment: 'node',
  coverageThresholds: {
    global: { branches: 60, functions: 70, lines: 70, statements: 70 }
  }
};
