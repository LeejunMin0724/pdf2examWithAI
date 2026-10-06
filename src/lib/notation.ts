/**
 * Plain-text notation for questions, answers and explanations.
 *
 * The app renders every field as a text node — there is no MathJax/KaTeX and no
 * markdown renderer — so notation has to BE text, not markup. Two problems follow:
 *
 * 1. A model that emits LaTeX or markdown (`$x^2$`, `\ce{H2O}`, `\frac{1}{2}`,
 *    `**bold**`) shows those characters literally to the student.
 * 2. Even plain ASCII formulas read badly: "H2O", "sp2", "Fe3+" lose the
 *    subscripts/superscripts a chemistry or math question needs.
 *
 * `formatNotation` fixes both deterministically at write time: strip markup,
 * then typeset the result with Unicode sub/superscripts and symbols. It stays
 * deliberately conservative — it never invents notation for text it does not
 * recognize, and chemistry subscripts are only applied to tokens that parse as a
 * real sequence of element symbols (see `subscriptChemicalToken`).
 */

const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";
const SUPERSCRIPTS: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "−": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ",
};

/** Element symbols a chemical token may consist of. */
const ELEMENTS = new Set([
  "H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne", "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar",
  "K", "Ca", "Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn", "Ga", "Ge", "As", "Se", "Br", "Kr",
  "Rb", "Sr", "Y", "Zr", "Nb", "Mo", "Tc", "Ru", "Rh", "Pd", "Ag", "Cd", "In", "Sn", "Sb", "Te", "I", "Xe",
  "Cs", "Ba", "La", "Ce", "Pr", "Nd", "Pm", "Sm", "Eu", "Gd", "Tb", "Dy", "Ho", "Er", "Tm", "Yb", "Lu",
  "Hf", "Ta", "W", "Re", "Os", "Ir", "Pt", "Au", "Hg", "Tl", "Pb", "Bi", "Po", "At", "Rn",
  "Fr", "Ra", "Ac", "Th", "Pa", "U", "Np", "Pu", "Am", "Cm", "Bk", "Cf", "Es", "Fm", "Md", "No", "Lr",
  "Rf", "Db", "Sg", "Bh", "Hs", "Mt", "Ds", "Rg", "Cn", "Nh", "Fl", "Mc", "Lv", "Ts", "Og",
]);

/** LaTeX commands that appear most often in chemistry/physics/math prose. */
const LATEX_SYMBOLS: Array<[RegExp, string]> = [
  [/\\rightleftharpoons\b/g, "⇌"],
  [/\\leftrightarrow\b|\\leftrightharpoons\b/g, "↔"],
  [/\\rightarrow\b|\\longrightarrow\b|\\to\b/g, "→"],
  [/\\leftarrow\b|\\longleftarrow\b/g, "←"],
  [/\\Rightarrow\b/g, "⇒"],
  [/\\times\b/g, "×"],
  [/\\cdot\b/g, "·"],
  [/\\pm\b/g, "±"],
  [/\\mp\b/g, "∓"],
  [/\\leq\b|\\le\b/g, "≤"],
  [/\\geq\b|\\ge\b/g, "≥"],
  [/\\neq\b|\\ne\b/g, "≠"],
  [/\\approx\b/g, "≈"],
  [/\\propto\b/g, "∝"],
  [/\\infty\b/g, "∞"],
  [/\\degree\b|\\deg\b/g, "°"],
  [/\\Delta\b/g, "Δ"],
  [/\\delta\b/g, "δ"],
  [/\\alpha\b/g, "α"],
  [/\\beta\b/g, "β"],
  [/\\gamma\b/g, "γ"],
  [/\\lambda\b/g, "λ"],
  [/\\mu\b/g, "μ"],
  [/\\nu\b/g, "ν"],
  [/\\pi\b/g, "π"],
  [/\\rho\b/g, "ρ"],
  [/\\sigma\b/g, "σ"],
  [/\\tau\b/g, "τ"],
  [/\\phi\b/g, "φ"],
  [/\\omega\b/g, "ω"],
  [/\\Omega\b/g, "Ω"],
  [/\\angle\b/g, "∠"],
  [/\\perp\b/g, "⊥"],
  [/\\equiv\b/g, "≡"],
  [/\\sum\b/g, "Σ"],
  [/\\partial\b/g, "∂"],
  [/\\micro\b/g, "μ"],
  [/\\textdegree\b/g, "°"],
  [/\\%|\s?\\%/g, "%"],
  [/\\&/g, "&"],
  [/\\(?:,|;|!|quad|qquad)\b/g, " "],
];

/**
 * Parses `token` as a chemical formula (element symbols + optional counts and a
 * trailing charge) and returns it with Unicode sub/superscripts, or null when it
 * is not a formula. Requiring real element symbols is what keeps "ATP2",
 * "COVID19", "óra" and "Figure2" untouched while `H2O`, `CH3CH2OH`, `Fe3+` and
 * `SO42-` typeset correctly.
 */
function subscriptChemicalToken(token: string): string | null {
  if (token.length > 16 || !/^\d*[A-Z]/.test(token)) return null;

  // A leading integer is a stoichiometric coefficient, not a subscript (2H2O).
  const coefficient = token.match(/^\d+/)?.[0] ?? "";
  let body = token.slice(coefficient.length);

  // ASCII chemistry writes the charge last, digits-first: "SO42-" is SO4 with 2-.
  let sign = "";
  let chargeDigits = "";
  if (body.endsWith("+") || body.endsWith("-")) {
    sign = body.slice(-1);
    let start = body.length - 1;
    while (start > 0 && /\d/.test(body[start - 1])) start -= 1;
    chargeDigits = body.slice(start, body.length - 1);
    body = body.slice(0, start);
  }

  let index = 0;
  let segments = 0;
  let sawCount = false;
  let formatted = "";
  while (index < body.length && /[A-Z]/.test(body[index])) {
    let symbol = body[index];
    if (/^[a-z]$/.test(body[index + 1] ?? "")) symbol += body[index + 1];
    if (!ELEMENTS.has(symbol)) return null;
    index += symbol.length;
    segments += 1;
    let count = "";
    while (index < body.length && /\d/.test(body[index])) {
      count += body[index];
      index += 1;
    }
    if (count) sawCount = true;
    formatted += symbol + [...count].map((digit) => SUBSCRIPTS[Number(digit)]).join("");
  }
  if (index !== body.length) return null;
  if (segments === 0) return null;

  // Where did the digits belong? Conventions, in order of what the token means:
  //   Fe3+ / O2-            single element  → digits are the charge magnitude
  //   NH4+ / HCO3-          multi element   → digits count the last element
  //   SO42- / Cr2O72-       multi element   → last digit is the magnitude
  let charge = "";
  if (sign) {
    let magnitude = chargeDigits;
    if (segments === 1 && !magnitude) {
      magnitude = body.match(/\d+$/)?.[0] ?? "";
      if (magnitude) formatted = formatted.slice(0, formatted.length - magnitude.length);
    } else if (segments > 1 && magnitude.length === 1) {
      formatted += SUBSCRIPTS[Number(magnitude)];
      magnitude = "";
    } else if (segments > 1 && magnitude.length > 1) {
      formatted += [...magnitude.slice(0, -1)].map((digit) => SUBSCRIPTS[Number(digit)]).join("");
      magnitude = magnitude.slice(-1);
    }
    charge = magnitude + sign;
  }
  // A charged element with no count is a formula too (Na+, Cl-); a bare element is not.
  if (!sawCount && !charge) return null;

  const chargeText = [...charge].map((char) => SUPERSCRIPTS[char] ?? char).join("");
  return coefficient + formatted + chargeText;
}

/** `^{2-}` / `^2` / `_3` → Unicode super/subscript where the content allows it. */
function typesetScripts(text: string) {
  return text
    .replace(/\^\{\s*([^}]{1,6})\s*\}/g, (match, content: string) => convertScript(content, SUPERSCRIPTS) ?? match)
    .replace(/\^([0-9+\-=()]{1,4})/g, (match, content: string) => convertScript(content, SUPERSCRIPTS) ?? match)
    .replace(/_\{(\d{1,3})\}/g, (match, digits: string) => [...digits].map((digit) => SUBSCRIPTS[Number(digit)]).join(""));
}

function convertScript(content: string, table: Record<string, string>): string | null {
  const converted = [...content].map((char) => table[char] ?? table[char.toLowerCase()] ?? "");
  return converted.every(Boolean) ? converted.join("") : null;
}

/** Removes LaTeX/markdown wrappers so only the human-readable text remains. */
function stripMarkup(text: string) {
  return text
    .replace(/\\ce\{([^{}]*)\}/g, "$1")
    .replace(/\\(?:text|mathrm|mathit|mathbf|mathsf|pu|operatorname|mbox|hbox)\{([^{}]*)\}/g, "$1")
    .replace(/\\sqrt\{([^{}]*)\}/g, "√$1")
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1/$2")
    .replace(/\\left|\\right\b/g, "")
    .replace(/\$([^$]{1,200})\$/g, "$1")
    .replace(/\\\(|\\\)|\\\[|\\\]/g, "")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/(^|[\s(])\*([^*\s](?:[^*\n]*[^*\s])?)\*(?=[\s).,:;!?]|$)/gm, "$1$2")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "");
}

/**
 * Typeset-ready text for any user-visible field. Idempotent: running it twice
 * changes nothing, so it is safe to apply both when storing and when reading.
 */
export function formatNotation(input: string): string {
  if (!input) return input;

  let text = stripMarkup(input);
  for (const [pattern, replacement] of LATEX_SYMBOLS) text = text.replace(pattern, replacement);
  // Unknown commands (`\eta`, `\zeta`, `\oplus`, …) keep their name, drop the backslash.
  text = text.replace(/\\([A-Za-z]{2,})/g, "$1");

  // "109.5 degrees" / "25 degrees Celsius" → 109.5° / 25°C
  text = text
    .replace(/(\d(?:[\d.,]*\d)?)\s*degrees?\s*(?:Celsius|C\b)/gi, "$1°C")
    .replace(/(\d(?:[\d.,]*\d)?)\s*degrees?\b/gi, "$1°");

  text = typesetScripts(text);
  // sp2/sp3 → sp²/sp³, the organic-chemistry hybridisation names.
  text = text.replace(/\b(sp)([23])\b/gi, (match, prefix: string, digit: string) => `${prefix}${SUPERSCRIPTS[digit]}`);
  // "6.02x10^23" reads as a product, not as the letter x.
  text = text.replace(/(\d)\s?x\s?(\d)/g, "$1×$2");
  text = text
    .replace(/<?->/g, "→")
    .replace(/<=>/g, "⇌")
    .replace(/(^|[\s(])-+>(?=\s|$)/g, "$1→");

  // Chemistry: only tokens that parse as real formulas get subscripts.
  text = text.replace(/\b\d*[A-Z][A-Za-z0-9]*[+-]?/g, (token) => subscriptChemicalToken(token) ?? token);

  return text.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

/** Convenience for the array-valued fields (options, accepted answers, rubric). */
export function formatNotationList(values: string[] | undefined): string[] | undefined {
  return values?.map((value) => formatNotation(value));
}
