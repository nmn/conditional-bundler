import queryUrl from "./logo.svg?url";
import directUrl from "./logo.svg" with { as: "url" };
import sized from "./logo.svg" with { as: "image-reference-with-size" };
import raw from "./data.txt?raw";
import encoded from "./data.txt" with { as: "base64" };
import styles from "./styles.module.css" with { as: "css-dependency" };
import stylesheetUrl from "./styles.module.css" with { as: "url" };

export const values = {
  queryUrl,
  directUrl,
  sameUrl: queryUrl === directUrl,
  sized,
  raw,
  encoded,
  className: styles.proof,
  stylesheetUrl,
};

export const loadFeature = () => import("./feature.js");
