/**
 * Notation: how formulas, equations and chemistry reach the student.
 *
 * Fields are stored as text and rendered by KaTeX (+ mhchem) in
 * `components/math-text.tsx`. This module is the layer between the two:
 *
 * - `formatNotation` normalizes a model's answer ONCE at write time into a form
 *   the renderer understands. Delimited math (`$x^2$`, `$$\frac{1}{2}$$`) and
 *   chemistry (`$\ce{H2O}$`) are KEPT — and a bare `\ce{...}` is delimited for the
 *   model — while prose is still typeset with Unicode sub/superscripts so it reads
 *   correctly in places with no renderer (plain-text fallbacks, copied answers).
 * - `latexToPlain` flattens the same text back to plain Unicode. Short answers are
 *   compared through it (a student typing "H2O" must match `$\ce{H2O}$`), and it
 *   is the renderer's last resort, so a formula KaTeX rejects still appears as
 *   readable text instead of raw TeX.
 * - `splitNotationParts` does the split the renderer needs.
 *
 * Everything here is deterministic and idempotent: running it twice changes
 * nothing, so it is safe to apply both when storing and when reading.
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

/**
 * LaTeX commands that appear most often in chemistry/physics/math prose. Each
 * pattern ends with `(?![A-Za-z])` rather than `\b`: inside math a command is
 * regularly glued to its argument (`\times10^{23}`), and `\b` would not match
 * there — `\le` must still not swallow `\left`.
 */
const LATEX_SYMBOLS: Array<[RegExp, string]> = [
  [/\\rightleftharpoons(?![A-Za-z])/g, "⇌"],
  [/\\leftrightarrow(?![A-Za-z])|\\leftrightharpoons(?![A-Za-z])/g, "↔"],
  [/\\rightarrow(?![A-Za-z])|\\longrightarrow(?![A-Za-z])|\\to(?![A-Za-z])/g, "→"],
  [/\\leftarrow(?![A-Za-z])|\\longleftarrow(?![A-Za-z])/g, "←"],
  [/\\Rightarrow(?![A-Za-z])/g, "⇒"],
  [/\\times(?![A-Za-z])/g, "×"],
  [/\\cdot(?![A-Za-z])/g, "·"],
  [/\\pm(?![A-Za-z])/g, "±"],
  [/\\mp(?![A-Za-z])/g, "∓"],
  [/\\leq(?![A-Za-z])|\\le(?![A-Za-z])/g, "≤"],
  [/\\geq(?![A-Za-z])|\\ge(?![A-Za-z])/g, "≥"],
  [/\\neq(?![A-Za-z])|\\ne(?![A-Za-z])/g, "≠"],
  [/\\approx(?![A-Za-z])/g, "≈"],
  [/\\propto(?![A-Za-z])/g, "∝"],
  [/\\infty(?![A-Za-z])/g, "∞"],
  [/\\degree(?![A-Za-z])|\\deg(?![A-Za-z])/g, "°"],
  [/\\Delta(?![A-Za-z])/g, "Δ"],
  [/\\delta(?![A-Za-z])/g, "δ"],
  [/\\alpha(?![A-Za-z])/g, "α"],
  [/\\beta(?![A-Za-z])/g, "β"],
  [/\\gamma(?![A-Za-z])/g, "γ"],
  [/\\lambda(?![A-Za-z])/g, "λ"],
  [/\\mu(?![A-Za-z])/g, "μ"],
  [/\\nu(?![A-Za-z])/g, "ν"],
  [/\\pi(?![A-Za-z])/g, "π"],
  [/\\rho(?![A-Za-z])/g, "ρ"],
  [/\\sigma(?![A-Za-z])/g, "σ"],
  [/\\tau(?![A-Za-z])/g, "τ"],
  [/\\phi(?![A-Za-z])/g, "φ"],
  [/\\omega(?![A-Za-z])/g, "ω"],
  [/\\Omega(?![A-Za-z])/g, "Ω"],
  [/\\angle(?![A-Za-z])/g, "∠"],
  [/\\perp(?![A-Za-z])/g, "⊥"],
  [/\\equiv(?![A-Za-z])/g, "≡"],
  [/\\sum(?![A-Za-z])/g, "Σ"],
  [/\\partial(?![A-Za-z])/g, "∂"],
  [/\\micro(?![A-Za-z])/g, "μ"],
  [/\\textdegree(?![A-Za-z])/g, "°"],
  [/\\%|\s?\\%/g, "%"],
  [/\\&/g, "&"],
  [/\\\s/g, " "],
  [/\\(?:,|;|!|quad|qquad)(?![A-Za-z])/g, " "],
];

/** mhchem bond commands (`\bond{...}`) and the bond they draw. */
const BOND_PLAIN: Record<string, string> = {
  "1": "-", "2": "=", "3": "≡", "1,2": "=", "1,3": "≡", "2,3": "=",
  "-": "-", "=": "=", "#": "≡", "~": "~", "~-": "~", "~=": "~", "~#": "~",
  "": "",
};

// ---------------------------------------------------------------------------
// Scanning: where is the math?
// ---------------------------------------------------------------------------

export type NotationPart = { kind: "text"; value: string } | { kind: "math"; value: string; display: boolean };

/** Longest run treated as one formula; beyond this it is prose that happens to contain `$`. */
const MAX_MATH_LENGTH = 2000;

/** Index of the `}` matching the `{` at `open`, honouring nesting and escapes. */
function matchBraces(text: string, open: number): number {
  let depth = 0;
  let escaped = false;
  for (let index = open; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) { escaped = false; continue; }
    if (char === "\\") { escaped = true; continue; }
    if (char === "{") depth += 1;
    else if (char === "}") { depth -= 1; if (depth === 0) return index; }
  }
  return -1;
}

/**
 * Finds the closing `$` of a math run. A single `$` only closes when the character
 * before it is not whitespace and the character after it is not a digit — the rule
 * GFM-style math uses, and what keeps prices ("$5 에서 $10") from swallowing the
 * sentence between them.
 */
function findMathClose(input: string, from: number, double: boolean): number {
  const limit = Math.min(input.length, from + MAX_MATH_LENGTH);
  for (let index = from; index < limit; index += 1) {
    if (input[index] !== "$") continue;
    if (/\s/.test(input[index - 1] ?? "")) continue;
    if (double) {
      if (input[index + 1] === "$") return index;
      continue;
    }
    const next = input[index + 1] ?? "";
    if (next === "$" || /\d/.test(next)) continue;
    return index;
  }
  return -1;
}

/** Splits text into prose and math runs (`$…$`, `$$…$$`, `\(…\)`, `\[…\]`). */
export function splitNotationParts(input: string): NotationPart[] {
  const parts: NotationPart[] = [];
  let text = "";
  const flush = () => { if (text) { parts.push({ kind: "text", value: text }); text = ""; } };

  let index = 0;
  while (index < input.length) {
    const char = input[index];
    if (char === "\\" && (input[index + 1] === "(" || input[index + 1] === "[")) {
      const closer = input[index + 1] === "(" ? "\\)" : "\\]";
      const end = input.indexOf(closer, index + 2);
      if (end !== -1 && end - index <= MAX_MATH_LENGTH) {
        flush();
        parts.push({ kind: "math", value: input.slice(index + 2, end).trim(), display: input[index + 1] === "[" });
        index = end + 2;
        continue;
      }
    }
    if (char === "$") {
      const double = input[index + 1] === "$";
      const bodyStart = index + (double ? 2 : 1);
      // `$5` (a price) and a lone `$$` never open math.
      if (input[bodyStart] && !/\s/.test(input[bodyStart])) {
        const close = findMathClose(input, bodyStart, double);
        if (close !== -1) {
          flush();
          parts.push({ kind: "math", value: input.slice(bodyStart, close).trim(), display: double });
          index = close + (double ? 2 : 1);
          continue;
        }
      }
    }
    text += char;
    index += 1;
  }

  flush();
  return parts;
}

/** Wraps `\ce{...}` / `\pu{...}` written outside math delimiters into `$...$`. */
function wrapBareChemistry(text: string): string {
  let result = "";
  let last = 0;
  let index = text.indexOf("\\");
  while (index !== -1) {
    const name = /^\\(?:ce|pu)\{/.exec(text.slice(index));
    if (!name) { index = text.indexOf("\\", index + 1); continue; }
    const open = index + name[0].length - 1;
    const close = matchBraces(text, open);
    if (close === -1) { index = text.indexOf("\\", index + 1); continue; }
    result += `${text.slice(last, index)}$${text.slice(index, close + 1)}$`;
    last = close + 1;
    index = text.indexOf("\\", last);
  }
  return result + text.slice(last);
}

/**
 * Splits text into prose and math, delimiting bare chemistry first. Chemistry is
 * only searched for INSIDE prose parts: a `\ce{}` that already sits in `$...$`
 * must not be wrapped a second time (`$$\ce{...}$$` renders as an empty display
 * block with the source in it).
 */
function notationParts(input: string): NotationPart[] {
  const parts: NotationPart[] = [];
  for (const part of splitNotationParts(input)) {
    if (part.kind === "math") { parts.push(part); continue; }
    const wrapped = wrapBareChemistry(part.value);
    if (wrapped === part.value) { parts.push(part); continue; }
    parts.push(...splitNotationParts(wrapped));
  }
  return parts;
}

// ---------------------------------------------------------------------------
// Plain text (prose) — Unicode typesetting, no renderer required
// ---------------------------------------------------------------------------

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
    // A `$...$` pair that survived the math scan is usually a price, not a formula,
    // so it is only unwrapped when its content is unmistakably TeX.
    .replace(/\$([^$]{1,200})\$/g, (match, inner: string) => (/[\\^_{}]/.test(inner) ? inner : match))
    .replace(/\\\(|\\\)|\\\[|\\\]/g, "")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/(^|[\s(])\*([^*\s](?:[^*\n]*[^*\s])?)\*(?=[\s).,:;!?]|$)/gm, "$1$2")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "");
}

/** Chemistry in prose: only tokens that parse as real formulas get subscripts. */
function typesetChemistry(text: string) {
  // A trailing `+`/`-` is a charge only when nothing follows it: in `CH3-CH2-OH`
  // the dash is a bond, and consuming it into the token would read as CH⁻.
  return text.replace(/\b\d*[A-Z][A-Za-z0-9]*[+-]?(?![A-Za-z])/g, (token) => subscriptChemicalToken(token) ?? token);
}

/** Unicode typesetting for prose that carries no formula markup. */
function formatPlainText(input: string): string {
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

  text = typesetChemistry(text);
  return text.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n");
}

// ---------------------------------------------------------------------------
// Math bodies — what the renderer gets
// ---------------------------------------------------------------------------

const BOND_CHARACTERS = "+-=#<>.,·^_";
const STATE_LABELS = /\((?:g|l|s|aq|gas|liquid|solid|solution|conc|dil)\)/g;

/**
 * True when `species` reads as one chemical species — element symbols with counts,
 * parenthesised groups, a charge, a hydrate dot. This is what lets `$H2O$` be
 * recognised as chemistry the model forgot to wrap in `\ce{}` while `$x^2$`,
 * `$pV = nRT$` and `$2x + 3 = 9$` stay math.
 */
function parseSpecies(species: string): boolean {
  const trimmed = species.replace(STATE_LABELS, "").replace(/\s+/g, "");
  if (!trimmed) return false;

  let index = 0;
  let depth = 0;
  let sawElement = false;
  const coefficient = /^\d+/.exec(trimmed);
  if (coefficient) index = coefficient[0].length;

  while (index < trimmed.length) {
    const char = trimmed[index];
    if (char === "(" || char === "[") { depth += 1; index += 1; continue; }
    if (char === ")" || char === "]") { depth -= 1; if (depth < 0) return false; index += 1; continue; }
    if (/[A-Z]/.test(char)) {
      let symbol = char;
      if (/^[a-z]$/.test(trimmed[index + 1] ?? "")) symbol += trimmed[index + 1];
      if (!ELEMENTS.has(symbol)) return false;
      index += symbol.length;
      sawElement = true;
      while (/\d/.test(trimmed[index] ?? "")) index += 1;
      continue;
    }
    if (BOND_CHARACTERS.includes(char) || char === "." || char === "·") { index += 1; continue; }
    // Anything else — an operator, a lowercase variable, a Greek letter — is not chemistry.
    return false;
  }
  return sawElement && depth === 0;
}

const CHEMISTRY_LIMIT = 160;

/** Decides whether an undelimited math body is a chemical formula/equation. */
function looksLikeChemicalEquation(body: string): boolean {
  if (!body || body.length > CHEMISTRY_LIMIT) return false;
  if (!/[A-Za-z)\]][+-](?![\w])/.test(body) && !/[A-Z][a-z]?\d/.test(body)) return false;
  return body
    .split(/<-->|<->|<<=>|<=>>|<=>|->|<-|=>|\+|\s{2,}/)
    .map((species) => species.trim())
    .filter(Boolean)
    .every(parseSpecies);
}

/** `$H2O$` → `$\ce{H2O}$`; anything that is not chemistry is left for KaTeX as math. */
function normalizeMathBody(body: string): string {
  const trimmed = body.trim();
  if (trimmed.includes("\\")) return trimmed;
  return looksLikeChemicalEquation(trimmed) ? `\\ce{${trimmed}}` : trimmed;
}

// ---------------------------------------------------------------------------
// Flattening: LaTeX/mhchem → plain Unicode
// ---------------------------------------------------------------------------

/** Rewrites `\name{...}` (brace-matched argument) through `handler`. */
function replaceBracedCommands(
  text: string,
  names: string[],
  handler: (argument: string, name: string) => string,
): string {
  const pattern = new RegExp(`\\\\(${names.join("|")})\\s*\\{`, "g");
  let result = "";
  let last = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const open = match.index + match[0].length - 1;
    const close = matchBraces(text, open);
    if (close === -1) break;
    result += text.slice(last, match.index) + handler(text.slice(open + 1, close), match[1]);
    last = close + 1;
    pattern.lastIndex = close + 1;
  }
  return result + text.slice(last);
}

/** `\frac{a}{b}` → `a/b` (a stacked fraction has no plain-text equivalent). */
function flattenFractions(text: string): string {
  let result = "";
  let index = 0;
  for (;;) {
    const start = text.indexOf("\\frac", index);
    if (start === -1) break;
    let open = start + "\\frac".length;
    while (/\s/.test(text[open] ?? "")) open += 1;
    const numeratorEnd = text[open] === "{" ? matchBraces(text, open) : -1;
    if (numeratorEnd === -1) { result += text.slice(index, start + "\\frac".length); index = start + "\\frac".length; continue; }
    let second = numeratorEnd + 1;
    while (/\s/.test(text[second] ?? "")) second += 1;
    const denominatorEnd = text[second] === "{" ? matchBraces(text, second) : -1;
    if (denominatorEnd === -1) { result += text.slice(index, numeratorEnd + 1); index = numeratorEnd + 1; continue; }
    const numerator = text.slice(open + 1, numeratorEnd);
    const denominator = text.slice(second + 1, denominatorEnd);
    const simple = /^[\w.]+$/.test(numerator) && /^[\w.]+$/.test(denominator);
    result += text.slice(index, start) + (simple ? `${numerator}/${denominator}` : `(${numerator})/(${denominator})`);
    index = denominatorEnd + 1;
  }
  return result + text.slice(index);
}

const toSubscript = (digits: string) => [...digits].map((digit) => SUBSCRIPTS[Number(digit)]).join("");
const toSuperscript = (content: string) => [...content].map((char) => SUPERSCRIPTS[char] ?? char).join("");

/**
 * mhchem's `\ce{...}` body → plain text. Not a full mhchem parser: it covers what
 * an exam writes — element counts, charges, isotopes, bonds, phase labels, hydrate
 * dots, reaction arrows.
 */
function mhchemToPlain(body: string): string {
  let text = body.replace(/\\bond\{([^}]*)\}/g, (match, argument: string) => BOND_PLAIN[argument] ?? "");
  // Chemistry commands (mainly \text{} labels on arrows) contribute their content.
  text = text.replace(/\\(?:text|mathrm|mathit|mathbf|mathsf)\{([^{}]*)\}/g, "$1");
  text = text.replace(/\\([A-Za-z]+)/g, (match, name: string) =>
    name.toLowerCase() === "textdegree" ? "°" : name.toLowerCase() === "circ" ? "∘" : "",
  );
  text = typesetScripts(text);
  // Charges written without a caret: H+ → H⁺, CH3COO- → CH₃COO⁻, Ca2+ → Ca²⁺.
  // The sign must touch its symbol — "(g) + 3H2" separates species with a spaced
  // `+`, and reading that as a charge would drop the plus from the equation.
  text = text.replace(/([A-Za-z]|\)|\])(\d*)([+-])(?![A-Za-z0-9])/g, (match, symbol: string, digits: string, sign: string) =>
    digits ? `${symbol}${toSuperscript(`${digits}${sign}`)}` : `${symbol}${toSuperscript(sign)}`,
  );
  text = text.replace(/([A-Z][a-z]?|\)|\])(\d+)/g, (match, symbol: string, digits: string) => symbol + toSubscript(digits));
  return text
    .replace(/#/g, "≡")
    .replace(/<-->|<->|<<=>|<=>>|<=>/g, "⇌")
    .replace(/->|-->|->>/g, "→")
    .replace(/<-|<-</g, "←")
    .replace(/=>/g, "⇒")
    .replace(/<=/g, "⇐")
    .replace(/\s*\+\s*/g, " + ")
    .replace(/[{}]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** LaTeX/mhchem → plain Unicode text. */
function flattenTex(tex: string): string {
  let text = tex;
  text = replaceBracedCommands(text, ["ce"], (body) => mhchemToPlain(body));
  text = replaceBracedCommands(text, ["pu"], (body) => body);
  text = flattenFractions(text);
  text = replaceBracedCommands(text, ["sqrt"], (body) => `√${body}`);
  text = replaceBracedCommands(text, ["text", "mathrm", "mathit", "mathbf", "mathsf", "operatorname", "mbox", "hbox"], (body) => body);
  text = text.replace(/\\left|\\right\b/g, "");
  for (const [pattern, replacement] of LATEX_SYMBOLS) text = text.replace(pattern, replacement);
  text = typesetScripts(text);
  // Scripts that Unicode cannot express keep their content, drop the markup: K_{sp} → Ksp.
  text = text.replace(/[_^]\{([^{}]*)\}/g, "$1").replace(/[_^]([A-Za-z0-9])/g, "$1");
  text = text.replace(/\\([A-Za-z]+)/g, "$1").replace(/[{}]/g, "");
  return typesetChemistry(text.replace(/[ \t]{2,}/g, " ").trim());
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Normalizes any user-visible field for storage/display. Delimited math and
 * chemistry survive (the renderer needs them); prose is typeset in Unicode.
 */
export function formatNotation(input: string): string {
  if (!input) return input;
  return notationParts(input)
    .map((part) => (part.kind === "math"
      ? `${part.display ? "$$" : "$"}${normalizeMathBody(part.value)}${part.display ? "$$" : "$"}`
      : formatPlainText(part.value)))
    .join("")
    .trim();
}

/** Convenience for the array-valued fields (options, accepted answers, rubric). */
export function formatNotationList(values: string[] | undefined): string[] | undefined {
  return values?.map((value) => formatNotation(value));
}

/**
 * Flattens every formula to plain Unicode text — for comparing short answers and
 * for showing a formula the renderer could not handle.
 */
export function latexToPlain(input: string): string {
  if (!input) return input;
  return notationParts(input)
    .map((part) => (part.kind === "math" ? flattenTex(part.value) : formatPlainText(part.value)))
    .join("")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
