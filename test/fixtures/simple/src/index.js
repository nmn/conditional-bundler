import { foo } from "./foo.js";
import "./side-effect.js";

export const value = foo + 1;
