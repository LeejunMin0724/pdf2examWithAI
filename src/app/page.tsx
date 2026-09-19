"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PdfUpload } from "@/components/pdf-upload";
import { QuestionLibrary } from "@/components/question-library";
import { ScrollReveal } from "@/components/scroll-reveal";
import { HeroScene } from "@/components/hero-scene";
import { StickyStory } from "@/components/sticky-story";
import { type PreviewState } from "@/components/pdf-upload";
import { GeneratedPreview } from "@/components/generated-preview";
import { AuthMenu } from "@/components/auth-menu";

export default function Home() {
  const [libraryRefreshToken, setLibraryRefreshToken] = useState(0);
  // After 문제 생성 succeeds the homepage swaps to the read-only generated-question
  // preview (문제가 생성되었습니다 → [생성된 문제 풀기]). No auto-navigation to the
  // exam; the questions stay in React state and, durably, on the server by set id.
  const [generatedPreview, setGeneratedPreview] = useState<PreviewState | null>(null);
  const router = useRouter();

  if (generatedPreview) {
    return <GeneratedPreview
      set={generatedPreview}
      backHref="/#upload"
      onBack={() => {
        setGeneratedPreview(null);
        router.push("/#upload");
      }}
    />;
  }

  return (
    <main>
      <ScrollReveal />

      <header className="topbar">
        <Link className="brand" href="/#top" aria-label="PDF2Exam 홈">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pdf2exam-logo.png" alt="PDF2Exam" className="brand-logo" />
        </Link>
        <nav className="topbar-nav" aria-label="주요 메뉴">
          <a href="#story">이용 방법</a>
          <a href="#library">문제은행</a>
        </nav>
        <AuthMenu />
      </header>

      {/* Scroll-story hero: the section is tall, its content stays pinned (sticky)
          while GSAP scrubs the PDF→exam transformation in the right-side scene. */}
      <section id="top" className="hero">
        <div className="hero-sticky">
          <div className="hero-inner">
            <div className="hero-copy-col">
              <p className="eyebrow" data-reveal style={{ "--reveal-delay": "0ms" } as React.CSSProperties}>PDF 기반 개인 학습 도구</p>
              <h1 data-reveal style={{ "--reveal-delay": "90ms" } as React.CSSProperties}>
                강의 자료를 올리면<br /><em>시험이 만들어집니다.</em>
              </h1>
              <p className="hero-copy" data-reveal style={{ "--reveal-delay": "180ms" } as React.CSSProperties}>
                직접 문제를 만들 필요 없습니다. 강의 PDF를 올리고, 시험에 나올 법한 질문으로 실력을 확인하세요.
              </p>
              <div className="hero-cta-row" data-reveal style={{ "--reveal-delay": "270ms" } as React.CSSProperties}>
                <Link className="btn btn-primary btn-large" href="#upload">PDF로 시험 시작하기</Link>
                <Link className="btn btn-secondary btn-large" href="#story">이용 방법 보기</Link>
              </div>
            </div>

            <div className="hero-scene-col" data-reveal style={{ "--reveal-delay": "320ms" } as React.CSSProperties}>
              <HeroScene />
            </div>
          </div>

          <div className="hero-scroll-hint" aria-hidden="true">
            <span className="hs-hint-mouse" />
            <span>Scroll</span>
          </div>
        </div>
      </section>

      <section id="upload" className="upload-section" data-reveal-exit>
        <div className="section-container" data-reveal>
          <div className="section-heading">
            <div>
              <p className="eyebrow">STEP 1–2</p>
              <h2>PDF를 올리고 시험을 설정하세요.</h2>
            </div>
            <p className="stats">텍스트 기반 PDF · 최대 20MB · 200페이지</p>
          </div>
          <div className="upload-panel"><PdfUpload onQuestionsGenerated={() => setLibraryRefreshToken((token) => token + 1)} onGenerated={(preview) => {
            setLibraryRefreshToken((token) => token + 1);
            setGeneratedPreview(preview);
          }} /></div>
        </div>
      </section>

      <section id="story" className="story-section">
        <div className="section-container">
          <div className="section-heading" data-reveal>
            <div>
              <p className="eyebrow">HOW IT WORKS</p>
              <h2>자료 넣기부터 복습까지, 한 번의 흐름.</h2>
            </div>
            <p className="stats">스크롤하며 각 단계를 확인해보세요.</p>
          </div>
          <StickyStory />
        </div>
      </section>

      <section className="library">
        <div className="section-container" data-reveal>
          <div className="section-heading" id="library">
            <div>
              <p className="eyebrow">QUESTION LIBRARY</p>
              <h2>문제은행</h2>
            </div>
            <p className="stats">생성된 문제 세트가 저장되고, 언제든 다시 풀 수 있습니다.</p>
          </div>
          <QuestionLibrary refreshToken={libraryRefreshToken} />
        </div>
      </section>

      {/* Brand footer — pure-black luxury wordmark section (replaces the old final CTA). */}
      <footer className="site-footer" aria-label="브랜드">
        <p className="site-footer-wordmark">@ZMLEEZWE</p>
      </footer>
    </main>
  );
}
