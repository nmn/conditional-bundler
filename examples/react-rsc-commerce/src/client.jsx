import React, {
  Suspense,
  startTransition,
  use,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import { createFromFetch } from "react-server-dom-webpack/client.browser";
import { CartProvider } from "./client/CartContext.jsx";
import { CommerceChrome } from "./client/CommerceChrome.jsx";

function RscView({ response }) {
  return use(response);
}

function ClientApp() {
  const [locationKey, setLocationKey] = useState(() => currentPath());
  const response = useMemo(
    () =>
      createFromFetch(
        fetch(`/rsc?path=${encodeURIComponent(locationKey)}`, {
          headers: { accept: "text/x-component" },
        }),
      ),
    [locationKey],
  );

  useEffect(() => {
    const onPopState = () => setLocationKey(currentPath());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = (to) => {
    if (to === locationKey) {
      return;
    }
    window.history.pushState(null, "", to);
    startTransition(() => setLocationKey(to));
  };

  return (
    <CartProvider>
      <CommerceChrome path={locationKey} onNavigate={navigate}>
        <Suspense
          fallback={<div className="route-loading">Preparing aisle</div>}
        >
          <RscView response={response} />
        </Suspense>
      </CommerceChrome>
    </CartProvider>
  );
}

function currentPath() {
  return `${window.location.pathname}${window.location.search}`;
}

createRoot(document.getElementById("root")).render(<ClientApp />);
