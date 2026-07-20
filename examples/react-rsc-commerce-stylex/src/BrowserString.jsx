"use client";

import React, { useEffect, useState } from "react";
import BrowserStringChrome from "./StringForChrome.jsx" with {
  condition: "isChrome",
};
import BrowserStringFirefox from "./StringForFirefox.jsx" with {
  condition: "isFirefox",
};
import BrowserStringSafari from "./StringForSafari.jsx" with {
  condition: "isSafari",
  else: "./StringForUnknown.jsx",
};

const BrowserString =
  BrowserStringChrome ?? BrowserStringFirefox ?? BrowserStringSafari;

export function BrowserConditionProof() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <p data-browser-condition-proof="">
      Conditional import:{" "}
      {mounted ? (
        <BrowserString />
      ) : (
        <span>resolving browser after hydration</span>
      )}
    </p>
  );
}
