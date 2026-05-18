import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { createFromFetch } from "react-server-dom-webpack/client.browser";

const root = createRoot(document.getElementById("root"));
const content = createFromFetch(fetch("/rsc"));

root.render(createElement(content));
