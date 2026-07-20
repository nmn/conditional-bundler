import selected from "./development.js" with {
  NODE_ENV: "development",
  else: "./production.js",
};

export { selected };
