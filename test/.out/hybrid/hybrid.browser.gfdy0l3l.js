const __IMPORT_kh774klk = () => import("./hybrid.browser.n3gd2izo.js").then((mod) => Object.freeze({ "default": mod["kh774klk_default"] }));
const kbgjp98n_label = "base";
const a7c4iu3zz_label = kbgjp98n_label;
/////##CONDITION_START##"FLAG_A"
const e68ec7o1_feature = "alpha";
/////##CONDITION_END##
/////##CONDITION_START##{"NOT":"FLAG_A"}
const dvxo7bsl_feature = "beta";
/////##CONDITION_END##
/////##CONDITION_START##"FLAG_A"
const a54u0cy4f_feature = e68ec7o1_feature;
/////##CONDITION_END##
/////##CONDITION_START##{"NOT":"FLAG_A"}
const a54u0cy4f_feature = dvxo7bsl_feature;
/////##CONDITION_END##
async function a54u0cy4f_run(key) {
  const mod = await __IMPORT_kh774klk();
  return mod.default(`${a7c4iu3zz_label}:${a54u0cy4f_feature}:${key}`);
}
export { a54u0cy4f_run as run };