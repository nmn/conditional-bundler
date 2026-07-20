"use client";

import React from "react";

export function Router({ children }) {
  function navigate(event) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const anchor = event.target.closest("a[href]");
    if (
      !anchor ||
      anchor.hasAttribute("download") ||
      (anchor.target && anchor.target !== "_self")
    ) {
      return;
    }

    const destination = new URL(anchor.href);
    if (destination.origin !== window.location.origin) {
      return;
    }
    if (
      destination.hash &&
      destination.pathname === window.location.pathname &&
      destination.search === window.location.search
    ) {
      return;
    }

    event.preventDefault();
    window.dispatchEvent(
      new CustomEvent("bundler:rsc-navigate", {
        cancelable: true,
        detail: {
          path: `${destination.pathname}${destination.search}`,
        },
      }),
    );
  }

  return (
    <div data-router="client" onClick={navigate}>
      {children}
    </div>
  );
}
