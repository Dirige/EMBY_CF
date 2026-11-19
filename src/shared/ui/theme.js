import PALETTE_RUNTIME from "../../../web/shared/palette.js?text";
import PAGE_STYLE_SOURCE from "./../../../web/shared/glass.css?text";
import THEME_INIT_SOURCE from "./../../../web/shared/theme-init.js?text";
import THEME_LOGIC_SOURCE from "./../../../web/shared/theme.js?text";
import PALETTE_MATH_SOURCE from "./../../../web/shared/palette-math.js?text";
// Baseline: 4e0357e. Edition-specific behavior is intentionally retained.


var PAGE_STYLE = PAGE_STYLE_SOURCE;

var THEME_INIT = THEME_INIT_SOURCE;

var THEME_LOGIC = THEME_LOGIC_SOURCE;

var PALETTE_MATH = PALETTE_MATH_SOURCE;

var DYN_PALETTE = PALETTE_MATH + PALETTE_RUNTIME;

export { PAGE_STYLE, THEME_INIT, THEME_LOGIC, PALETTE_MATH, DYN_PALETTE };
