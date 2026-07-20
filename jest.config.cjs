module.exports = {
  testMatch: ["<rootDir>/packages/**/test/**/*.test.mjs"],
  testEnvironment: "node",
  verbose: true,
  moduleFileExtensions: ["mjs", "js", "json"],
  roots: ["<rootDir>/packages"],
  transform: {},
  watchman: false,
};
