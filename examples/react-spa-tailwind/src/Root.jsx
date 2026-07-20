import React from "react";
import { applyConditionIdToUrl } from "@bundler/assets/runtime";
import clientEntryUrl from "./client.client.jsx" with {
  as: "url",
  environment: "javascript",
  target: "client",
};

export function Root({
  children,
  conditionId = "0",
  conditionNames = [],
  styles = [],
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="dark" />
        <meta
          name="description"
          content="An operations dashboard example styled with Tailwind CSS utilities."
        />
        <title>Signal House · Tailwind</title>
        {styles.map((style) => (
          <link
            key={style.fileName}
            rel="stylesheet"
            href={`/${style.fileName}`}
            data-bundler-style={style.bundleKey}
          />
        ))}
      </head>
      <body className="m-0 min-w-80">
        <div id="root">{children}</div>
        <script
          type="module"
          src={applyConditionIdToUrl(
            clientEntryUrl,
            { conditions: conditionNames },
            conditionId,
          )}
        />
      </body>
    </html>
  );
}
