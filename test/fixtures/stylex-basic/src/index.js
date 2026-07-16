import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  root: {
    color: "rgb(190, 40, 60)",
    padding: 12,
  },
});

export const className = stylex.props(styles.root).className;
