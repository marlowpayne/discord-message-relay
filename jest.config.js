export default {
  testEnvironment: "node",
  collectCoverage: true,
  collectCoverageFrom: ["app.js"],
  coverageDirectory: "coverage",
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 90,
      functions: 90,
      lines: 90,
    },
  },
};
