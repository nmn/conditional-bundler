import data from "./data.json" with { type: "json" };
import raw from "./data.json" with { type: "raw" };

export const result = {
  data,
  hasOwnProto: Object.prototype.hasOwnProperty.call(data, "__proto__"),
  negativeZero: Object.is(data.offset, -0),
  raw,
};
