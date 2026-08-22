/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "tests/hello-world.devnet.test.ts"],
  collectCoverageFrom: [
    "contracts/*/src/**/*.ts",
    "!dist/**"
  ]
};
