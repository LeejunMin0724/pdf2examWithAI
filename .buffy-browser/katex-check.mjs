import katex from "katex";
import "katex/contrib/mhchem";

const samples = [
  "\\ce{H2O}",
  "\\ce{SO4^2-}",
  "\\ce{Fe^3+}",
  "\\ce{2H2 + O2 -> 2H2O}",
  "\\ce{CH3-CH2-OH}",
  "\\ce{CH3-CH=CH-CH3}",
  "\\ce{C6H5-OH}",
  "\\ce{^{14}_{6}C}",
  "\\ce{N2(g) <=> 2N(g)}",
  "\\frac{1}{2}",
  "\\sqrt{2}",
  "6.02\\times10^{23}",
  "K_{sp}",
  "\\Delta H",
  "\\pu{25 °C}",
  "\\ce{CH3CH2OH + 3O2 -> 2CO2 + 3H2O}",
  "\\mathrm{sp}^2",
];

for (const tex of samples) {
  try {
    const html = katex.renderToString(tex, { throwOnError: true, strict: "ignore", output: "html" });
    const text = html.replace(/<[^>]*>/g, "");
    console.log("OK  ", JSON.stringify(tex), "→", text.slice(0, 90));
  } catch (error) {
    console.log("FAIL", JSON.stringify(tex), "→", error.message.slice(0, 120));
  }
}
