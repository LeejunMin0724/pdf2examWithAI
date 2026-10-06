/**
 * Does the instruction the app now sends actually produce LaTeX/mhchem?
 *
 * The notation section is EXTRACTED from src/lib/ai.ts (not retyped), so this
 * probe measures the shipped prompt. Question generation itself is stubbed: the
 * model only has to write chemistry questions in the required JSON shape.
 */
import { readFileSync } from "node:fs";

const source = readFileSync("src/lib/ai.ts", "utf8");
const start = source.indexOf("【수식·화학식 표기 규칙 — KaTeX/mhchem】");
const end = source.indexOf("【해설 작성 규칙");
if (start === -1 || end === -1) throw new Error("notation rule not found in ai.ts");
const notationRule = source.slice(start, end).trim().replace(/\\n/g, "\n");
console.log(`extracted rule: ${notationRule.length} chars\n`);

const systemPrompt = `당신은 대학 시험 대비 문제를 작성하는 전문 출제 교수입니다.\n\n${notationRule}\n\n【출력】\nJSON만 반환: {"questions":[{"question":string,"options":[string,string,string,string],"correctAnswer":"0"|"1"|"2"|"3","explanation":string}]}`;

const userPrompt = `아래 강의 자료로 화학식·구조식이 드러나는 객관식 2문제를 만드세요. 반드시 위 표기 규칙을 따릅니다.\n\n[Page 1] 알켄은 탄소-탄소 이중 결합(C=C)을 가진 탄화수소다. 에텐 CH2=CH2의 두 탄소는 sp2 혼성이며, 이중 결합은 1개의 시그마 결합과 1개의 파이 결합으로 이루어진다. 에텐 1몰을 완전 연소시키면 2몰의 이산화 탄소가 생성된다.\n[Page 2] 알코올은 하이드록시기(-OH)를 가진 화합물로, 에탄올 CH3CH2OH가 대표적이다. 카복실산은 -COOH를 가지며 아세트산 CH3COOH가 예이다.`;

const models = ["nvidia/nemotron-3-super-120b-a12b:free", "google/gemma-4-31b-it:free"];
const apiKey = process.env.OPENROUTER_API_KEY;

for (const model of models) {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], temperature: 0.2, max_tokens: 1200 }),
    });
    const payload = await response.json();
    if (!response.ok) { console.log(`${model}: HTTP ${response.status} — ${payload?.error?.message?.slice(0, 120)}`); continue; }
    const text = payload.choices?.[0]?.message?.content ?? "";
    const dollar = (text.match(/\$[^$\n]+\$/g) ?? []).length;
    const ce = (text.match(/\\ce\{[^}]*\}/g) ?? []).length;
    const unicode = (text.match(/[₀-₉⁰-⁹]/g) ?? []).length;
    console.log(`${model}: $…$ runs=${dollar}  \\ce{} runs=${ce}  unicode sub/superscripts=${unicode}`);
    console.log(`  sample: ${text.replace(/\s+/g, " ").slice(0, 320)}\n`);
  } catch (error) {
    console.log(`${model}: FAILED — ${error.message}`);
  }
}
