const fs = require("node:fs");
const path = require("node:path");
const { fileURLToPath, pathToFileURL } = require("node:url");
const sourceMapSupport = require("source-map-support");

sourceMapSupport.install({
  environment: "node",
  retrieveSourceMap(source) {
    const filePath = toFilePath(source);
    if (!filePath) {
      return null;
    }

    let code;
    try {
      code = fs.readFileSync(filePath, "utf8");
    } catch {
      return null;
    }

    const sourceMappingUrl = findSourceMappingUrl(code);
    if (!sourceMappingUrl) {
      return null;
    }
    if (sourceMappingUrl.startsWith("data:application/json")) {
      const comma = sourceMappingUrl.indexOf(",");
      const encoded = sourceMappingUrl.slice(comma + 1);
      return {
        url: source,
        map: sourceMappingUrl.includes(";base64")
          ? Buffer.from(encoded, "base64").toString("utf8")
          : decodeURIComponent(encoded),
      };
    }

    const mapPath = path.resolve(path.dirname(filePath), sourceMappingUrl);
    try {
      return {
        url: pathToFileURL(mapPath).href,
        map: fs.readFileSync(mapPath, "utf8"),
      };
    } catch {
      return null;
    }
  },
});

function toFilePath(source) {
  try {
    if (source.startsWith("file:")) {
      const url = new URL(source);
      url.search = "";
      url.hash = "";
      return fileURLToPath(url);
    }
    return path.isAbsolute(source) ? source.split(/[?#]/, 1)[0] : null;
  } catch {
    return null;
  }
}

function findSourceMappingUrl(code) {
  const expression =
    /(?:\/\/[#@]\s*sourceMappingURL=([^\s'"]+)\s*$)|(?:\/\*[#@]\s*sourceMappingURL=([^\s*'"]+)\s*\*\/\s*$)/gm;
  let found = null;
  for (const match of code.matchAll(expression)) {
    found = match[1] ?? match[2] ?? found;
  }
  return found;
}
