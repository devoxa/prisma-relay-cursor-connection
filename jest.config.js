module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['<rootDir>/dist'],
  snapshotFormat: {
    printBasicPrototype: false
  }
}
