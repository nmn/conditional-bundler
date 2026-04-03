
/////##CONDITION_START##"COND_A"
const a7fe542m3_pick = value => `pick:${value}`;
/////##CONDITION_END##
const mag3x3is_shared = "shared";
/////##CONDITION_START##{"NOT":"COND_A"}
const m1lyft9j_pick = value => `alt:${value}`;
/////##CONDITION_END##
/////##CONDITION_START##"COND_A"
const a1wam17ob_pick = a7fe542m3_pick;
/////##CONDITION_END##
/////##CONDITION_START##{"NOT":"COND_A"}
const a1wam17ob_pick = m1lyft9j_pick;
/////##CONDITION_END##
function a1wam17ob_run() {
  return a1wam17ob_pick(mag3x3is_shared);
}
export { a1wam17ob_run as run };