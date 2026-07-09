import "./base.css";
import styles, { button } from "./button.module.css";
import * as namespaceStyles from "./button.module.css";
import { card as otherCard } from "./other.module.css";

export const className = `${styles.card}:${button}:${namespaceStyles.card}`;
export const noCollision = styles.card !== otherCard;
