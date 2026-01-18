module.exports = {
  testMatch: ["<rootDir>/packages/**/test/**/*.test.mjs"],
  testEnvironment: "node",
  verbose: true,
  moduleFileExtensions: ["js", "mjs", "json"],
  roots: ["<rootDir>/packages"],
  transform: {}
};
