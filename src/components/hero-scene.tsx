"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Hero scroll-story scene: 강의 자료(PDF 문서) → AI 처리(글로우/스파클) → 시험지(A+).
 * Desktop (≥1024px, motion allowed): a GSAP ScrollTrigger timeline scrubs the
 * whole transformation across the hero's scroll range — fully reversible.
 * Mobile / prefers-reduced-motion: pure-CSS static composition (end states),
 * no timeline is created.
 */

type SparkleSpec = {
  left: number; top: number; size: number;
  tone: "blue" | "sky" | "pale";
  inAt: number; outAt: number; staticOpacity: number;
};

const TONE: Record<SparkleSpec["tone"], string> = {
  blue: "#0A6BE8",
  sky: "#4A9EFF",
  pale: "#BBD6FF",
};

const SPARKLES: SparkleSpec[] = [
  { left: 56, top: 13, size: 22, tone: "blue", inAt: 1.6, outAt: 5.2, staticOpacity: 0.95 },
  { left: 41, top: 33, size: 13, tone: "pale", inAt: 2.2, outAt: 5.8, staticOpacity: 0 },
  { left: 69, top: 51, size: 16, tone: "sky", inAt: 2.9, outAt: 6.6, staticOpacity: 0.85 },
  { left: 28, top: 21, size: 11, tone: "pale", inAt: 1.2, outAt: 4.4, staticOpacity: 0 },
  { left: 84, top: 69, size: 19, tone: "blue", inAt: 6.2, outAt: 9.6, staticOpacity: 1 },
  { left: 21, top: 64, size: 10, tone: "pale", inAt: 3.6, outAt: 7.2, staticOpacity: 0 },
  { left: 61, top: 37, size: 12, tone: "pale", inAt: 4.6, outAt: 8.4, staticOpacity: 0.5 },
];

const DUST = [
  { left: 50, top: 62, size: 5, inAt: 3.4, outAt: 7.0, staticOpacity: 0.35 },
  { left: 64, top: 29, size: 6, inAt: 4.0, outAt: 7.6, staticOpacity: 0 },
  { left: 37, top: 49, size: 4, inAt: 4.6, outAt: 8.0, staticOpacity: 0.3 },
  { left: 76, top: 19, size: 5, inAt: 5.2, outAt: 8.8, staticOpacity: 0.4 },
  { left: 29, top: 81, size: 6, inAt: 6.0, outAt: 9.4, staticOpacity: 0 },
];

const SHEETS = [
  { left: 58, top: 1, size: 64, rotation: 14, inAt: 5.4, staticOpacity: 0.5 },
  { left: 1, top: 24, size: 46, rotation: -10, inAt: 6.0, staticOpacity: 0.32 },
];

/** Clay-style PDF file icon: light page, folded corner, red "PDF" chip. */
function PdfFileSvg() {
  return (
    <svg viewBox="0 0 220 240" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hs-pdf-page" x1="110" y1="14" x2="110" y2="226" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E7EBF4" />
        </linearGradient>
        <linearGradient id="hs-pdf-chip" x1="110" y1="128" x2="110" y2="202" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF7A6B" />
          <stop offset="1" stopColor="#E8473A" />
        </linearGradient>
      </defs>

      {/* page */}
      <rect x="30" y="14" width="160" height="212" rx="20" fill="url(#hs-pdf-page)" />
      {/* folded corner */}
      <path d="M138 14 h12 a20 20 0 0 1 20 20 v12 Z" fill="#DDE3F0" />
      {/* faint text lines */}
      <rect x="48" y="40" width="70" height="9" rx="4.5" fill="#E4E9F3" />
      <rect x="48" y="58" width="52" height="9" rx="4.5" fill="#EDF1F8" />

      {/* chip drop shadow */}
      <rect x="22" y="136" width="176" height="74" rx="18" fill="#B23A30" opacity="0.25" />
      {/* red PDF chip (overhangs the page edges like the reference) */}
      <rect x="22" y="128" width="176" height="74" rx="18" fill="url(#hs-pdf-chip)" />
      <rect x="36" y="137" width="118" height="8" rx="4" fill="#FFFFFF" opacity="0.22" />
      <text
        x="110" y="181"
        textAnchor="middle"
        fontSize="42" fontWeight="800" fill="#FFFFFF" letterSpacing="2"
        style={{ fontFamily: "inherit" }}
      >
        PDF
      </text>
    </svg>
  );
}

function PaperSvg() {
  return (
    <svg viewBox="0 0 190 240" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hs-paper" x1="95" y1="16" x2="95" y2="220" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#EFF2F9" />
        </linearGradient>
      </defs>

      <rect x="20" y="16" width="150" height="204" rx="18" fill="url(#hs-paper)" />
      {/* folded corner */}
      <path d="M130 16 h22 a18 18 0 0 1 18 18 v22 Z" fill="#E2E7F3" />
      <path d="M130 16 v14 a8 8 0 0 0 8 8 h32" fill="none" stroke="#D3DAEA" strokeWidth="2" />

      {/* A+ */}
      <text
        x="112" y="88"
        fontSize="44" fontWeight="800" fill="#0A6BE8"
        transform="rotate(6 130 74)"
        style={{ fontFamily: "inherit" }}
      >
        A+
      </text>

      {/* embossed text lines */}
      <rect x="42" y="118" width="104" height="10" rx="5" fill="#DDE2EE" />
      <rect x="42" y="140" width="86" height="10" rx="5" fill="#DDE2EE" />
      <rect x="42" y="162" width="96" height="10" rx="5" fill="#DDE2EE" />
      <rect x="42" y="184" width="44" height="10" rx="5" fill="#8FB9FF" />
      <rect x="94" y="184" width="34" height="10" rx="5" fill="#DDE2EE" />
    </svg>
  );
}

function SheetSvg() {
  return (
    <svg viewBox="0 0 80 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="6" width="68" height="88" rx="10" fill="#FFFFFF" />
      <rect x="18" y="26" width="44" height="7" rx="3.5" fill="#DDE2EE" />
      <rect x="18" y="42" width="32" height="7" rx="3.5" fill="#DDE2EE" />
    </svg>
  );
}

function SparkleSvg() {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 0C12.9 7.2 16.8 11.1 24 12c-7.2.9-11.1 4.8-12 12-.9-7.2-4.8-11.1-12-12C7.2 11.1 11.1 7.2 12 0Z" />
    </svg>
  );
}

export function HeroScene() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    gsap.registerPlugin(ScrollTrigger);

    const mm = gsap.matchMedia();
    mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
      const hero = root.closest<HTMLElement>(".hero");
      if (!hero) return;

      const q = gsap.utils.selector(root);
      const copy = hero.querySelector(".hero-copy-col");
      const hint = hero.querySelector(".hero-scroll-hint");
      const stars = q(".hs-sparkle");
      const dust = q(".hs-dust");
      const sheets = q(".hs-sheet");

      // Timeline of 10 units, scrubbed across the hero's full scroll range.
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: { trigger: hero, start: "top top", end: "bottom bottom", scrub: 0.6 },
      });

      // Copy recedes subtly; scroll hint fades as the story starts.
      if (copy) tl.to(copy, { y: -26, opacity: 0.75, duration: 10 }, 0);
      if (hint) tl.to(hint, { opacity: 0, duration: 1.2 }, 0.2);

      // Book drifts, then dissolves as the transformation completes.
      tl.to(q(".hs-pdf"), { x: 30, y: -22, rotation: 7, duration: 4.5, ease: "sine.inOut" }, 0);
      tl.to(q(".hs-pdf"), { scale: 0.5, y: -64, rotation: 13, opacity: 0, duration: 2.1, ease: "power2.in" }, 4.5);

      // Curved transformation path draws itself between book and paper.
      tl.fromTo(
        q(".hs-path"),
        { strokeDashoffset: 1 },
        { strokeDashoffset: 0, duration: 6.2, ease: "power1.inOut" },
        0.9,
      );
      tl.fromTo(q(".hs-path"), { opacity: 0 }, { opacity: 0.85, duration: 0.8 }, 0.9);
      tl.to(q(".hs-path"), { opacity: 0.55, duration: 1.4 }, 8.4);

      // AI processing: soft light burst around the middle of the story.
      tl.fromTo(
        q(".hs-glow"),
        { opacity: 0, scale: 0.55 },
        { opacity: 0.9, scale: 1, duration: 2.4, ease: "sine.out" },
        3.1,
      );
      tl.to(q(".hs-glow"), { opacity: 0, scale: 1.4, duration: 2.6, ease: "sine.in" }, 5.7);

      // Sparkles pop in and out along the transformation.
      SPARKLES.forEach((s, i) => {
        const el = stars[i];
        tl.fromTo(
          el,
          { opacity: 0, scale: 0.2, rotation: -45 },
          { opacity: 1, scale: 1, rotation: 0, duration: 1.0, ease: "back.out(2.2)" },
          s.inAt,
        );
        tl.to(
          el,
          { opacity: 0, scale: 0.55, duration: 0.9, ease: "sine.in" },
          Math.max(s.outAt - 0.9, s.inAt + 1.05),
        );
      });

      // Dust particles drift through.
      DUST.forEach((d, i) => {
        const el = dust[i];
        tl.fromTo(el, { opacity: 0, y: 10 }, { opacity: 0.8, y: -6, duration: 1.4 }, d.inAt);
        tl.to(el, { opacity: 0, y: -16, duration: 1.2 }, Math.max(d.outAt - 1.2, d.inAt + 1.45));
      });

      // Faint floating page fragments for depth.
      SHEETS.forEach((sh, i) => {
        const el = sheets[i];
        tl.fromTo(
          el,
          { opacity: 0, y: 22, rotation: sh.rotation + 5 },
          { opacity: 1, y: 0, rotation: sh.rotation, duration: 1.8, ease: "sine.out" },
          sh.inAt,
        );
      });

      // Exam paper becomes the primary object.
      tl.fromTo(
        q(".hs-paper"),
        { opacity: 0, scale: 0.55, y: 52, rotation: 9 },
        { opacity: 1, scale: 1, y: 0, rotation: -6, duration: 3.4, ease: "power2.out" },
        4.7,
      );
    });

    return () => mm.revert();
  }, []);

  return (
    <div className="hero-scene" ref={rootRef} aria-hidden="true">
      <svg className="hs-path-svg" viewBox="0 0 560 520" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="hs-path-grad" x1="262" y1="232" x2="308" y2="152" gradientUnits="userSpaceOnUse">
            <stop stopColor="#9CC4FF" stopOpacity="0.25" />
            <stop offset="0.5" stopColor="#5CA0FF" />
            <stop offset="1" stopColor="#0A6BE8" />
          </linearGradient>
        </defs>
        <path
          className="hs-path"
          d="M 262 232 C 292 214, 300 184, 308 152"
          pathLength={1}
          strokeDasharray={1}
          stroke="url(#hs-path-grad)"
          strokeWidth={2}
          strokeLinecap="round"
        />
      </svg>

      {SHEETS.map((sh, i) => (
        <span
          key={`sheet-${i}`}
          className="hs-sheet hs-fade"
          style={{
            left: `${sh.left}%`, top: `${sh.top}%`, width: sh.size,
            "--s": sh.staticOpacity, "--r": `${sh.rotation}deg`,
          } as React.CSSProperties}
        >
          <SheetSvg />
        </span>
      ))}

      <div className="hs-glow" />

      <div className="hs-object hs-pdf">
        <div className="hs-float">
          <PdfFileSvg />
        </div>
      </div>

      <div className="hs-object hs-paper hs-fade">
        <div className="hs-float hs-float-paper">
          <PaperSvg />
        </div>
      </div>

      {DUST.map((d, i) => (
        <span
          key={`dust-${i}`}
          className="hs-dust hs-fade"
          style={{
            left: `${d.left}%`, top: `${d.top}%`, width: d.size, height: d.size,
            "--s": d.staticOpacity,
          } as React.CSSProperties}
        />
      ))}

      {SPARKLES.map((s, i) => (
        <span
          key={`sparkle-${i}`}
          className="hs-sparkle hs-fade"
          style={{
            left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size,
            color: TONE[s.tone], "--s": s.staticOpacity,
          } as React.CSSProperties}
        >
          <SparkleSvg />
        </span>
      ))}
    </div>
  );
}
