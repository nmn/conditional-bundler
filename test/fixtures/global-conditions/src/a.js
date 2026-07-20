import chrome from "./chrome.js" with { condition: "isChrome" };
import safari from "./safari.js" with { condition: "isSafari" };

export const browserA = chrome ?? safari;
