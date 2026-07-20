import chrome from "./chrome.js" with { condition: "isChrome" };
import firefox from "./firefox.js" with { condition: "isFirefox" };

export const browserB = chrome ?? firefox;
