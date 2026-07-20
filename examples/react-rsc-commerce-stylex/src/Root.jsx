import React from "react";
import * as stylex from "@stylexjs/stylex";
import { applyConditionIdToUrl } from "@bundler/assets/runtime";
import clientEntryUrl from "./client.jsx" with {
  as: "url",
  environment: "react.client",
  target: "client",
};

export function Root({
  app,
  conditionId = "0",
  conditionNames = [],
  flight,
  routePath,
  styles = [],
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light" />
        <meta
          name="description"
          content="A React Server Components storefront styled entirely with colocated StyleX."
        />
        <title>Monarch Goods · StyleX</title>
        {styles.map((style) => (
          <link
            key={style.fileName}
            rel="stylesheet"
            href={`/${style.fileName}`}
            data-bundler-style={style.bundleKey}
          />
        ))}
      </head>
      <body {...stylex.props(rootStyles.body)}>
        <div id="root">{app}</div>
        <script
          id="__BUNDLER_RSC_DATA__"
          type="application/json"
          data-path={routePath}
          dangerouslySetInnerHTML={{
            __html: serializeJsonForScript(flight),
          }}
        />
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

const rootStyles = stylex.create({
  body: {
    margin: 0,
    minWidth: 320,
  },
});

function serializeJsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
