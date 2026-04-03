function helper() {
  return "used";
}

export function used() {
  return helper();
}

export function unused() {
  return "unused";
}
