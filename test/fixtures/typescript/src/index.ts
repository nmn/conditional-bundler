import { Badge } from "./Badge.tsx";
import type { BadgeModel } from "./Badge.tsx";

const model: BadgeModel = {
  label: "ready",
};

export const result = Badge(model);
