import katex from "katex";
import "katex/contrib/mhchem";
import { formatNotation, latexToPlain, splitNotationParts } from "@/lib/notation";

/**
 * Renders a stored text field with its formulas typeset.
 *
 * Prose stays a text node, and every `$…$` / `$$…$$` run is rendered by KaTeX with
 * the mhchem extension loaded, so `$\ce{CH3-CH=CH2}$`, `$\ce{2H2 + O2 -> 2H2O}$`,
 * `$\frac{1}{2}$` and `$6.02\times10^{23}$` reach the student as formulas rather
 * than as source code. KaTeX renders to a string on the server as well, so the
 * markup is already in the HTML — no flash of raw TeX, no client-only path.
 *
 * Nothing is ever shown as raw TeX: a formula KaTeX rejects is relaxed
 * (unknown commands dropped, braces balanced) and, failing that, flattened to
 * plain Unicode by `latexToPlain`.
 */
export function MathText({ text, className }: { text?: string | null; className?: string }) {
  if (!text) return null;

  const parts = splitNotationParts(formatNotation(text));
  return (
    <>
      {parts.map((part, index) => {
        if (part.kind === "text") return part.value;
        const html = renderMath(part.value, part.display);
        if (!html) return latexToPlain(part.value);
        return (
          <span
            className={[part.display ? "math-display" : "math-inline", className].filter(Boolean).join(" ")}
            key={index}
            // KaTeX output is generated from the formula text, never from HTML input.
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </>
  );
}

/** Commands the prompts are allowed to use; anything else is dropped as a last resort. */
const ALLOWED_COMMANDS = new Set([
  "frac", "dfrac", "tfrac", "sqrt", "cdot", "times", "div", "pm", "mp", "ast", "star", "bullet", "circ", "degree", "deg",
  "leq", "le", "geq", "ge", "neq", "ne", "approx", "sim", "simeq", "ncong", "equiv", "propto", "infty", "partial", "nabla",
  "sum", "prod", "int", "oint", "lim", "log", "ln", "exp", "sin", "cos", "tan", "sec", "csc", "cot", "arcsin", "arccos", "arctan",
  "sinh", "cosh", "tanh", "max", "min", "bmod", "pmod", "not", "oplus", "ominus", "otimes", "odot", "dagger", "ddagger",
  "angle", "perp", "parallel", "triangle", "because", "therefore", "rightarrow", "leftarrow", "leftrightarrow", "longrightarrow",
  "longleftarrow", "Rightarrow", "Leftarrow", "Leftrightarrow", "rightleftharpoons", "leftrightharpoons", "uparrow", "downarrow",
  "implies", "iff", "mapsto", "to", "gets", "langle", "rangle", "lceil", "rceil", "lfloor", "rfloor", "lvert", "rvert", "vert", "Vert",
  "lVert", "rVert", "overline", "underline", "bar", "vec", "hat", "tilde", "dot", "ddot", "overbrace", "underbrace", "overrightarrow",
  "overset", "underset", "stackrel", "substack", "boxed", "cancel", "binom", "choose", "displaystyle", "textstyle", "scriptstyle",
  "limits", "nolimits", "space", "quad", "qquad", "text", "textrm", "textbf", "textit", "textnormal", "textdegree",
  "mathrm", "mathit", "mathbf", "mathsf", "mathtt", "mathbb", "mathcal", "mathfrak", "mathnormal", "operatorname", "mbox", "hbox",
  "left", "right", "big", "Big", "bigg", "Bigg", "dots", "ldots", "cdots", "vdots", "ddots", "aleph", "hbar", "ell", "Re", "Im", "wp",
  "prime", "flat", "sharp", "natural", "forall", "exists", "nexists", "neg", "land", "lor", "wedge", "vee", "models", "vdash", "top", "bot",
  "subset", "supset", "subseteq", "supseteq", "in", "notin", "ni", "cup", "cap", "setminus", "emptyset", "varnothing",
  "alpha", "beta", "gamma", "delta", "epsilon", "varepsilon", "zeta", "eta", "theta", "vartheta", "iota", "kappa", "lambda", "mu", "nu",
  "xi", "omicron", "pi", "varpi", "rho", "varrho", "sigma", "varsigma", "tau", "upsilon", "phi", "varphi", "chi", "psi", "omega",
  "Gamma", "Delta", "Theta", "Lambda", "Xi", "Pi", "Sigma", "Upsilon", "Phi", "Psi", "Omega",
  "ce", "pu", "bond", "iso", "xspace", "hyphen",
]);

const KATEX_BASE = { strict: "ignore" as const, trust: false, output: "html" as const };

/**
 * Renders one formula. `throwOnError` keeps a malformed formula from painting red
 * error text into the question — the caller falls back to plain text instead.
 */
export function renderMath(tex: string, displayMode: boolean): string | null {
  const options = { ...KATEX_BASE, displayMode, throwOnError: true };
  try {
    return katex.renderToString(tex, options);
  } catch {
    const relaxed = relaxTex(tex);
    if (relaxed && relaxed !== tex) {
      try {
        return katex.renderToString(relaxed, options);
      } catch {
        /* fall through to the plain-text fallback */
      }
    }
    return null;
  }
}

/** Drops unknown commands and balances braces so a near-miss formula still renders. */
function relaxTex(tex: string): string {
  const relaxed = balanceBraces(
    tex
      .replace(/\\([A-Za-z]+)/g, (match, name: string) => (ALLOWED_COMMANDS.has(name) ? match : ""))
      .replace(/(^|[^\\])([%&#])/g, "$1\\$2"),
  );
  return relaxed.trim();
}

function balanceBraces(text: string): string {
  let depth = 0;
  let escaped = false;
  let result = "";
  for (const char of text) {
    if (escaped) { result += char; escaped = false; continue; }
    if (char === "\\") { result += char; escaped = true; continue; }
    if (char === "{") { depth += 1; result += char; continue; }
    if (char === "}") { if (depth === 0) continue; depth -= 1; result += char; continue; }
    result += char;
  }
  return result + "}".repeat(depth);
}
