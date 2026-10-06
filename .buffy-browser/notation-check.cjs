const { formatNotation, latexToPlain, splitNotationParts } = require("./notation-build/notation.js");

let failures = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : `\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`}`);
}

// --- legacy plain-text typesetting still works --------------------------------
check("ascii chemistry", formatNotation("물은 H2O이고 Fe3+ 이온, SO42- 음이온이다"), "물은 H₂O이고 Fe³⁺ 이온, SO₄²⁻ 음이온이다");
check("hybridisation + degrees", formatNotation("sp2 혼성, 결합각 109.5 degrees, CO2"), "sp² 혼성, 결합각 109.5°, CO₂");
check("undelimited latex flattens", formatNotation("비율 \\frac{1}{2} 와 \\alpha 입자"), "비율 1/2 와 α 입자");
check("markdown stripped", formatNotation("**정답**은 `H2O` 입니다"), "정답은 H₂O 입니다");

// --- math markup is preserved for the renderer --------------------------------
check("inline math kept", formatNotation("정답은 $x^2$이다"), "정답은 $x^2$이다");
check("display math kept", formatNotation("$$\\frac{1}{2}$$"), "$$\\frac{1}{2}$$");
check("bare \\ce delimited", formatNotation("분자는 \\ce{H2O} 이다"), "분자는 $\\ce{H2O}$ 이다");
check("math symbols untouched inside $", formatNotation("$6.02\\times10^{23}$ 개"), "$6.02\\times10^{23}$ 개");
check("ascii formula in math becomes \\ce", formatNotation("$H2O$ 분자"), "$\\ce{H2O}$ 분자");
check("chemistry equation in math becomes \\ce", formatNotation("$2H2 + O2 -> 2H2O$"), "$\\ce{2H2 + O2 -> 2H2O}$");
check("plain math body stays math", formatNotation("$x^2 + 3x$"), "$x^2 + 3x$");
check("algebra is not chemistry", formatNotation("$pV = nRT$"), "$pV = nRT$");
check("prose around math still typeset", formatNotation("분자식 $\\ce{CH3-CH2-OH}$ 은 CH3CH2OH 이다"), "분자식 $\\ce{CH3-CH2-OH}$ 은 CH₃CH₂OH 이다");
check("currency is not math", formatNotation("가격은 $5 에서 $10 이다"), "가격은 $5 에서 $10 이다");
check("cjk-safe: \\( \\) delimiters", formatNotation("각도는 \\(109.5^\\circ\\)"), "각도는 $109.5^\\circ$");

// --- idempotency --------------------------------------------------------------
const samples = [
  "물은 H2O이고 Fe3+ 이온이다",
  "정답은 $x^2$이다",
  "분자식 $\\ce{CH3-CH2-OH}$ 은 CH3CH2OH 이다",
  "$$\\ce{2H2 + O2 -> 2H2O}$$",
  "가격은 $5 에서 $10 이다",
  "비율 \\frac{1}{2} 와 \\alpha 입자",
  "SO42- 와 Cr2O72- 의 전하",
  "6.02x10^23 개, sp3 혼성 궤도함수",
];
for (const sample of samples) {
  const once = formatNotation(sample);
  const twice = formatNotation(once);
  check(`idempotent: ${sample.slice(0, 28)}`, twice, once);
}

// --- plain fallback -----------------------------------------------------------
check("plain: \\ce{H2O}", latexToPlain("$\\ce{H2O}$"), "H₂O");
check("plain: sulfate", latexToPlain("$\\ce{SO4^2-}$"), "SO₄²⁻");
check("plain: iron(III)", latexToPlain("$\\ce{Fe^3+}$"), "Fe³⁺");
check("plain: ester", latexToPlain("$\\ce{CH3-CH2-OH}$"), "CH₃-CH₂-OH");
check("plain: double bond", latexToPlain("$\\ce{CH3-CH=CH-CH3}$"), "CH₃-CH=CH-CH₃");
check("plain: triple bond", latexToPlain("$\\ce{CH3-C#CH}$"), "CH₃-C≡CH");
check("plain: complex ion", latexToPlain("$\\ce{[Cu(NH3)4]^2+}$"), "[Cu(NH₃)₄]²⁺");
check("plain: hydrate", latexToPlain("$\\ce{CuSO4.5H2O}$"), "CuSO₄.5H₂O");
check("plain: equilibrium", latexToPlain("$\\ce{N2(g) + 3H2(g) <=> 2NH3(g)}$"), "N₂(g) + 3H₂(g) ⇌ 2NH₃(g)");
check("plain: reaction", latexToPlain("$\\ce{2H2 + O2 -> 2H2O}$"), "2H₂ + O₂ → 2H₂O");
check("plain: isotope", latexToPlain("$\\ce{^{14}_{6}C}$"), "¹⁴₆C");
check("plain: fraction", latexToPlain("$\\frac{1}{2}$"), "1/2");
check("plain: root", latexToPlain("$\\sqrt{2}$"), "√2");
check("plain: avogadro", latexToPlain("$6.02\\times10^{23}$"), "6.02×10²³");
check("plain: Ksp", latexToPlain("$K_{sp}$"), "Ksp");
check("plain: delta H", latexToPlain("$\\Delta H$"), "Δ H");
check("plain: units", latexToPlain("$\\mathrm{sp}^2$ 혼성"), "sp² 혼성");
check("plain: prose kept", latexToPlain("그냥 문장 H2O 포함"), "그냥 문장 H₂O 포함");

// --- short-answer matching (same folding as lib/grading.server) ---------------
const IGNORED = /[.,;:!?"'“”‘’·。、「」]/g;
function normalize(value) {
  return latexToPlain(value)
    .normalize("NFKC")
    .replace(/[×✕✖]/g, "x")
    .replace(/[·⋅∙]/g, ".")
    .replace(/[→➔➜]/g, "->")
    .replace(/[⇌⇋⇄]/g, "=")
    .replace(/[−–—]/g, "-")
    .replace(/[()[\]{}]/g, "")
    .replace(/[°^~`'""””]/g, "")
    .replace(IGNORED, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}
check("match: \\ce{H2O} vs H2O", normalize("$\\ce{H2O}$") === normalize("H2O"), true);
check("match: avogadro", normalize("$6.02\\times10^{23}$") === normalize("6.02x10^23"), true);
check("match: sulfate", normalize("$\\ce{SO4^2-}$") === normalize("SO42-"), true);
check("match: iron", normalize("$\\ce{Fe^3+}$") === normalize("Fe3+"), true);

// --- parts --------------------------------------------------------------------
check("parts: prose/math/prose", JSON.stringify(splitNotationParts("a $x^2$ b")), JSON.stringify([
  { kind: "text", value: "a " }, { kind: "math", value: "x^2", display: false }, { kind: "text", value: " b" },
]));

console.log(failures ? `\n${failures} FAILURE(S)` : "\nall checks passed");
process.exit(failures ? 1 : 0);
