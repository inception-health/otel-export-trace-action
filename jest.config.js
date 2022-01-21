module.exports = {
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  globals: {
    "ts-jest": {
      compiler: "ttypescript",
    },
  },
  setupFiles: ["<rootDir>/config.ts"],
  reporters: ["default", "jest-junit"],
};
