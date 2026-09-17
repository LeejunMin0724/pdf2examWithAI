"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Discrete step-based storytelling (premium SaaS pattern).
 *
 * One source of truth: `activeStep` (0..3). A tall scroll track pins the scene
 * while a rAF scroll controller rounds continuous progress onto whole steps —
 * one comfortable scroll gesture advances ~one step, scrolling up goes back,
 * and the user never has to park at an exact scroll position.
 *
 * Each step is ONE scene (text + visual) that transitions together with a
 * layered cross-fade: the outgoing scene drifts up/back with blur while the
 * incoming scene rises into place simultaneously (never display:none).
 */

type StoryStep = {
  id: string;
  number: string;
  title: string;
  copy: string;
  visual: ReactNode;
};

const FILE_NAME = "Chapter_2_세포막생리.pdf";

const storySteps: StoryStep[] = [
  {
    id: "upload",
    number: "01",
    title: "강의 PDF를 올립니다.",
    copy: "텍스트 기반 강의 자료를 업로드하면 앱이 내용을 읽어냅니다. 페이지 정보는 그대로 보존되어, 나중에 문제의 출처 페이지까지 확인할 수 있습니다.",
    visual: (
      <div className="story-doc">
        <div className="story-doc-head">
          <span className="story-doc-dot" />
          <span className="story-doc-name">{FILE_NAME}</span>
          <span className="story-doc-pages">34페이지</span>
        </div>
        <div className="story-doc-lines">
          <span style={{ width: "90%" }} />
          <span style={{ width: "76%" }} />
          <span style={{ width: "84%" }} />
          <span style={{ width: "62%" }} />
          <span style={{ width: "80%" }} />
        </div>
        <span className="story-chip story-chip-ok">텍스트 추출 완료 · 6,338자</span>
      </div>
    ),
  },
  {
    id: "generate",
    number: "02",
    title: "AI가 시험 문제를 만듭니다.",
    copy: "중요 개념을 뽑아 객관식과 서술형 문제로 변환합니다. EASY는 핵심 내용을 정확히 학습했는지 확인하고, HARD는 개념을 새 상황에 적용하는 추론 문제로 나옵니다.",
    visual: (
      <div className="story-quiz">
        <div className="story-quiz-head">
          <span className="type type-multiple_choice">객관식</span>
          <span className="story-chip">EASY · 5개 생성 완료</span>
        </div>
        <p className="story-quiz-question">세포막의 주요 구조에 대한 설명으로 가장 적절한 것은?</p>
        <ul className="story-quiz-options">
          <li><span className="choice-number">1</span>단일 인지질 층</li>
          <li className="is-correct"><span className="choice-number">2</span>인지질 이중층</li>
          <li><span className="choice-number">3</span>세포벽의 다당류 층</li>
          <li><span className="choice-number">4</span>세포골격의 미세소관</li>
        </ul>
      </div>
    ),
  },
  {
    id: "exam",
    number: "03",
    title: "실제 시험처럼 풉니다.",
    copy: "문제 → 답안 → 이동. 실전 시험과 같은 흐름의 전용 시험 페이지에서 방해 없이 집중합니다.",
    visual: (
      <div className="story-exam">
        <div className="story-exam-head">
          <span className="story-exam-count">문제 3 / 5</span>
          <span className="story-exam-track"><span style={{ width: "60%" }} /></span>
        </div>
        <p className="story-quiz-question">외부 용액의 삼투압이 세포 내부보다 높을 때, 물은 어느 방향으로 이동하는가?</p>
        <ul className="story-quiz-options">
          <li><span className="choice-number">1</span>세포 안으로 이동한다</li>
          <li className="is-selected"><span className="choice-number">2</span>세포 밖으로 이동한다</li>
          <li><span className="choice-number">3</span>이동하지 않는다</li>
          <li><span className="choice-number">4</span>방향을 예측할 수 없다</li>
        </ul>
        <div className="story-exam-actions">
          <span className="story-btn">이전</span>
          <span className="story-btn primary">다음</span>
        </div>
      </div>
    ),
  },
  {
    id: "result",
    number: "04",
    title: "채점 결과로 복습합니다.",
    copy: "객관식은 즉시 채점되고, 서술형은 AI가 루브릭 기준으로 점수를 매기고 한국어 피드백을 남깁니다. 틀린 문제는 문제은행에서 언제든 다시 풀 수 있습니다.",
    visual: (
      <div className="story-result">
        <div className="story-result-score"><b>6<i> / 7점</i></b><span>AI 채점 완료</span></div>
        <ul className="story-result-rows">
          <li className="ok"><span>1</span>객관식 · 정답</li>
          <li className="ok"><span>2</span>객관식 · 정답</li>
          <li className="bad"><span>3</span>서술형 · 4/5 — 농도 차 계산 근거 보완</li>
        </ul>
        <p className="story-result-feedback">&quot;삼투 방향 설명은 정확합니다. effective osmole과 총 용질 농도의 차이를 한 문장으로 덧붙이면 만점입니다.&quot;</p>
      </div>
    ),
  },
];

const STEP_COUNT = storySteps.length;

export function StickyStory() {
  const [activeStep, setActiveStep] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let frame = 0;
    // Continuous progress (0..STEP_COUNT-1) → round to the nearest whole step.
    // The user never needs a precise scroll position; any resting point resolves
    // to a clean scene.
    const update = () => {
      frame = 0;
      const rect = track.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) return;
      const progress = Math.min(1, Math.max(0, -rect.top / scrollable));
      setActiveStep(Math.round(progress * (STEP_COUNT - 1)));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  // Keyboard navigation (desktop storytelling aid; buttons remain for all users).
  useEffect(() => {
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const story = document.querySelector(".story-section");
      if (!story) return;
      const { top } = story.getBoundingClientRect();
      const visible = top < window.innerHeight * 0.5 && top > -window.innerHeight;
      if (!visible) return;
      if (event.key === "ArrowDown" || event.key === "PageDown") {
        setActiveStep((current) => {
          if (current >= STEP_COUNT - 1) return current;
          event.preventDefault();
          scrollToStep(current + 1);
          return current + 1;
        });
      }
      if (event.key === "ArrowUp" || event.key === "PageUp") {
        setActiveStep((current) => {
          if (current <= 0) return current;
          event.preventDefault();
          scrollToStep(current - 1);
          return current - 1;
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const scrollToStep = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const scrollable = rect.height - window.innerHeight;
    if (scrollable <= 0) return;
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const top = window.scrollY + rect.top + (index / (STEP_COUNT - 1)) * scrollable;
    window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <div className="story-track" ref={trackRef}>
      <div className="story-layout">
        {/* RIGHT visual — one pinned stage; scenes cross-transition together with the text */}
        <div className="story-visual" aria-hidden="true">
          <div className="story-stage">
            {storySteps.map((step, index) => (
              <div
                key={step.id}
                className={`story-scene${activeStep === index ? " is-active" : activeStep > index ? " is-before" : " is-after"}`}
              >
                {step.visual}
              </div>
            ))}
          </div>
          <div className="story-dots">
            {storySteps.map((step, index) => (
              <button
                key={step.id}
                type="button"
                className={`story-dot${activeStep === index ? " is-active" : ""}`}
                aria-label={`${step.number}단계: ${step.title}`}
                aria-pressed={activeStep === index}
                onClick={() => scrollToStep(index)}
              />
            ))}
          </div>
        </div>

        {/* LEFT text — the active scene's text is full opacity; others step aside */}
        <div className="story-steps">
          {storySteps.map((step, index) => (
            <article
              key={step.id}
              className={`story-step${activeStep === index ? " is-active" : activeStep > index ? " is-before" : " is-after"}`}
              aria-hidden={activeStep !== index}
            >
              <span className="story-step-number">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
