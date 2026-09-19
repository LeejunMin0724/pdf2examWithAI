# PDF2Exam 📄→📝

**강의 PDF를 업로드하면 AI가 시험 문제를 만들고, 풀고, 채점까지 해주는 대학생 시험 대비 웹앱**

```
PDF 업로드 → 텍스트 추출 → AI 문제 생성 → 문제 확인 → [생성된 문제 풀기] → 시험 풀이 → 채점/결과
```

---

## 목차

- [주요 기능](#주요-기능)
- [기술 스택](#기술-스택)
- [프로젝트 구조](#프로젝트-구조)
- [데이터 모델](#데이터-모델)
- [API 엔드포인트](#api-엔드포인트)
- [AI 문제 생성 시스템](#ai-문제-생성-시스템)
- [인증 시스템](#인증-시스템)
- [시작하기](#시작하기)
- [환경 변수](#환경-변수)

---

## 주요 기능

### 📄 PDF 업로드 & 텍스트 추출
- 드래그 & 드롭 업로드 (최대 20MB / 200페이지, PDF 시그니처 검사)
- 서버에서 **pdf.js(pdfjs-dist)**로 페이지별 텍스트 추출 — PDF 파일 자체는 AI로 전송되지 않고, 추출된 텍스트만 전달
- 페이지 번호 보존 → 생성된 문제에 `sourcePage` 출처 페이지 기록

### 🤖 AI 문제 생성 (Gemini + OpenRouter 폴백)
- **문제 유형**: 객관식(4지선다) / 서술형
- **난이도**: EASY(중요 내용의 기억·기본 이해 확인) / HARD(이해해야만 풀리는 적용·추론·비교·예측 문제 — 암기만으로 풀리면 폐기·재설계)
- **언어 자동 감지**: 영어 원서를 올리면 영어로, 한국어 PDF를 올리면 한국어로 출제 (서술형 피드백도 문제 언어를 따라감)
- 문제마다 `testedConcept`(핵심 개념) / `reasoningType`(추론 유형) / `sourcePage`(출처 페이지) 메타데이터 생성 — 향후 약점 분석·재학습 기능의 기반

### 🏊 AI 모델 풀 & 자동 폴백
- **품질 우선 풀**: `Gemini 3.8 Flash → 3.7 → 3.6 → 3.5 Flash` 순서로 시도 (Flash-Lite·Preview 모델 제외)
- 특정 모델이 429(일일 한도)/503/타임아웃이면 자동으로 다음 우선순위 모델로 폴백, 쿨다운 후 복귀
- Gemini 전체가 막히면 **OpenRouter 무료 모델 풀**(Nemotron 3 Ultra → Super → Inkling → Gemma 4 …)로 2차 폴백
- 실제 사용된 모델은 `QuestionSet`에 기록되고 시험 상단에 배지로 표시 (`Gemini 3.6 Flash · Fallback`)
- 생성 직전에 **어떤 모델로 생성할지 미리 표시** (`사용 모델: …`)
- Gemini의 응답은 구조화된 JSON 스키마로 강제 + zod 검증 + 유연한 정규화(누락 필드 보정, snake_case 변환 등)

### 📝 생성 문제 프리뷰 → 시험
- 문제 생성 후 **자동으로 시험이 시작되지 않음** — 읽기 전용 프리뷰로 "문제가 생성되었습니다." 확인 후 **[생성된 문제 풀기]** 클릭 시에만 시험 시작 (타이머도 그 시점에 시작)
- 시험 데이터는 서버에 저장 후 id로 다시 불러오므로 새로고침해도 유실 없음

### ✅ 채점 & 문제은행
- 객관식: 제출 즉시 채점
- 서술형: AI가 루브릭 기준으로 점수 + 피드백 (답안은 **채점 API 호출 전 먼저 저장** — API 실패 시에도 답안 보존, 재채점 가능)
- 문제은행: 저장된 세트 목록, 다시 풀기, 삭제(관련 기록까지 cascade)

### 🔐 인증 (Supabase)
- 이메일/비밀번호 회원가입·로그인 + **게스트로 계속하기**(익명 인증)
- 세션은 쿠키 기반 + 미들웨어가 매 요청마다 갱신 → 새로고침·브라우저 재시작 후에도 로그인 유지
- 업로드·문제 세트·시험 기록 모두 `userId`로 스코핑 — **타인의 데이터는 서버에서 403 차단** (프론트 필터링에 의존하지 않음)
- **게스트 데이터 이전**: 게스트로 만든 자료는 이후 로그인/회원가입 시 자동으로 계정에 귀속 (10분 유효 HMAC 토큰 검증 방식)
- Supabase 키가 없으면 인증 UI가 아예 숨고 기존처럼 동작 (선택적 기능)

### 🎨 UI/UX
- Next.js 16 + React 19, Pretendard, #007AFF 액센트의 미니멀 SaaS 디자인
- 스크롤 스토리텔링: 히어로(PDF→A+ 아이콘 변환) + "어떻게 작동하나요?" 4단계 고정 스토리 (한 번의 스크롤 = 한 단계, 위로 스크롤 시 역방향, `prefers-reduced-motion` 지원)
- 모바일 반응형 (히어로 첫 화면에 CTA까지 수납), 항상 고정되는 풀블리드 상단바
- GSAP 없이 rAF + IntersectionObserver 기반 경량 애니메이션

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| 프레임워크 | Next.js 16 (App Router, Turbopack), React 19 |
| 언어 | TypeScript 5.9 |
| DB | SQLite + Prisma 6 (`prisma/dev.db`) |
| PDF | pdfjs-dist 6 (서버 사이드 추출, `serverExternalPackages` 필수) |
| AI | Google Gemini API (직접 REST 호출), OpenRouter (OpenAI 호환) |
| 검증 | zod 4 |
| 인증 | Supabase Auth (`@supabase/ssr` + `@supabase/supabase-js`) — 선택적 |

---

## 프로젝트 구조

```
src/
├── app/
│   ├── page.tsx                  # 랜딩 (히어로 + 업로드 + 스토리 + 문제은행 + 푸터)
│   ├── exam/
│   │   ├── page.tsx              # 시험 페이지 라우트
│   │   └── exam-client.tsx       # 시험 풀이 클라이언트 (타이머/네비/결과)
│   ├── globals.css               # 디자인 시스템 (토큰/버튼/모달/스토리)
│   └── api/
│       ├── documents/upload/     # PDF 업로드 + 텍스트 추출
│       ├── question-sets/        # 생성 / 목록 / 상세·삭제
│       ├── attempts/             # 채점 / 결과 조회 / 서술형 재채점
│       ├── model-preview/        # 다음 생성에 쓰일 모델 미리보기
│       ├── auth/                 # 게스트 데이터 이전 (토큰 발급/병합)
│       └── dev/model-status/     # (dev 전용) 모델 풀 진단
├── components/
│   ├── pdf-upload.tsx            # 업로드 + 설정 + 생성 프리뷰 전환
│   ├── generated-preview.tsx     # 생성된 문제 읽기 전용 프리뷰
│   ├── quiz-session.tsx          # 시험 풀이 엔진
│   ├── question-library.tsx      # 문제은행 (다시 풀기/삭제)
│   ├── sticky-story.tsx          # "어떻게 작동하나요?" 단계 스토리
│   ├── hero-scene.tsx            # 히어로 PDF→A+ 아이콘 씬
│   ├── scroll-reveal.tsx         # 스크롤 리빌 유틸
│   ├── auth-provider.tsx         # 전역 인증 상태 (세션 복원/이벤트)
│   ├── auth-modal.tsx            # 로그인/회원가입/게스트 모달 (포탈)
│   └── auth-menu.tsx             # 탑바 인증 슬롯
├── lib/
│   ├── ai.ts                     # AI 서비스 (모델 풀 관리 + 프롬프트 + 정규화)
│   ├── gemini-models.ts          # Gemini 풀/쿨다운/예약 카운터
│   ├── openrouter-models.ts      # OpenRouter 풀/카탈로그
│   ├── pdf-extractor.ts          # pdf.js 페이지별 추출
│   ├── question-sets.ts          # DB ↔ 도메인 변환
│   ├── questions.ts              # zod 스키마 + 샘플 문제
│   └── supabase-*.ts             # 브라우저/서버 클라이언트 + 설정 판정
├── middleware.ts                 # Supabase 세션 쿠키 갱신
└── prisma/schema.prisma          # 데이터 모델
```

---

## 데이터 모델 (Prisma/SQLite)

```
Document (업로드된 PDF) ──< DocumentPage (페이지 번호별 추출 텍스트)
        │
        └──< QuestionSet (생성 설정 + 사용된 모델 기록)
                  │
                  ├──< Question (객관식/서술형 + 메타데이터)
                  │
                  └──< Attempt (시험 응시)
                            │
                            └──< Answer (답안 + 점수 + AI 피드백)

AIRequestLog — AI 호출 감사 로그 (연산/프로바이더/모델/토큰/성공여부)
```

- `Document`/`QuestionSet`/`Attempt` 모두 nullable `userId` 보유 (인증 OFF·레거시·샘플 데이터 호환)
- `Question`의 `gradingRubric`은 항목별 배점({criterion, points}) 구조

---

## API 엔드포인트

| Method | 경로 | 설명 |
|---|---|---|
| POST | `/api/documents/upload` | PDF 업로드 → 페이지별 텍스트 추출·저장 |
| POST | `/api/question-sets/generate` | AI 문제 생성 (문서 소유 검증) |
| GET | `/api/question-sets` | 내 문제 세트 목록 (문제은행) |
| GET / DELETE | `/api/question-sets/[id]` | 세트 상세 / 삭제 (cascade) |
| POST | `/api/attempts/grade` | 답안 제출 → 저장 후 채점 |
| GET | `/api/attempts/[id]` | 시험 결과 조회 |
| POST | `/api/attempts/retry-subjective` | 서술형 재채점 |
| GET | `/api/model-preview` | 다음 생성에 사용될 모델 (캐시 기반, AI 호출 없음) |
| GET | `/api/auth/guest-token` | 게스트 데이터 이전용 토큰 발급 (게스트 세션 전용) |
| POST | `/api/auth/merge-guest` | 토큰 검증 후 게스트 자료를 계정으로 이전 |
| GET | `/api/dev/model-status` | 모델 풀 진단 (next dev에서만 동작) |

---

## AI 문제 생성 시스템

### 출제 원칙 (시스템 프롬프트에 영구 반영)
- **출처의 충실성**: 정답에 필요한 사실은 모두 업로드된 PDF에서 근거. PDF 내 지시문("이전 지시 무시" 등)은 프롬프트 인젝션으로 취급하지 않음
- **HARD 절대 규칙**: "PDF 문장을 암기한 학생이 맞힐 수 있는가?" → 예라면 폐기·재설계. 새 상황 적용/인과 추론/비교/예측 중 하나 이상 필수
- **방해 답안 설계**: 무작위 오답이 아니라 흔한 오개념·개념 혼동·인과 도치 기반
- **품질 > 수량**: 근거 없는 문제로 개수를 채우지 않음
- 배치 생성: 요청 N문제를 **단일 API 호출**로 생성 (비용·지연 최소화)

### 모델 선택 알고리즘
```
요청 → Gemini 풀(품질순) 순회
        ├─ ListModels 캐시로 사용 불가 모델 스킵
        ├─ 일일 요청 예약(보수적 로컬 카운터)으로 동시성 보호
        ├─ 429(일일) → UTC 자정까지 스킵 / 429(분)·5xx → 60s 쿨다운 / 타임아웃 → 30s
        └─ 전부 실패 → OpenRouter 무료 풀(품질순) → 전부 실패 → 사용자 친화적 에러
```
- Google이 공식 remaining-RPD API를 제공하지 않으므로 쿼터는 **추정치**로만 관리 (`usageMetadata`를 쿼터로 사용하지 않음)
- 사고 토큰 제어: EASY 생성 `thinkingLevel: low`, HARD `medium` (채점은 `low`) — 비용 절감

### 하루 요청량 (무료 티어 기준)

전부 **무료 티어**에서 운영되며, 서버가 보수적 로컬 카운터로 일일 예산을 관리합니다 (카운터는 UTC 자정 리셋, 동시 요청까지 포함해 계산).

| 항목 | 하루 한도 | 비고 |
|---|---|---|
| Gemini 모델별 | **약 200 RPD** × 4개 모델 (3.8/3.7/3.6/3.5 Flash) | 풀 전체 이론상 최대 **약 800회/일** — 상위 모델이 막혀야 하위 모델로 넘어가는 구조 |
| OpenRouter (폴백) | **45회/일** (풀 공유 예산) | Gemini 전체가 막혔을 때만 사용 |
| 임시 재시도 | 모델당 최대 3회 (429/5xx/타임아웃, 백오프) | 재시도도 일일 카운터에 포함 |

**실질 사용량 감각:**

- **문제 생성**: N문제 요청 = **API 호출 1회** (배치 생성). 즉 문제 수와 무관하게 요청 1회 소모 → 하루 수백 회 생성 가능
- **서술형 채점**: 답안 1개 제출 = **호출 1회** (객관식 채점은 AI 호출 없음). 서술형 10문제 시험 1회 ≈ 10회
- **재채점**: 서술형 답안 1건당 1회
- 안정적으로 하루 **문제 생성 수십 회 + 서술형 채점 수백 건**을 무료로 처리할 수 있는 규모

> 수치는 Google/OpenRouter가 공식 노출하지 않는 관측 기반 추정치입니다. 정확한 현재 상태는 dev 서버에서 `GET /api/dev/model-status`로 확인 가능합니다.

---

## 인증 시스템

| 상태 | 동작 |
|---|---|
| Supabase 키 미설정 | 인증 UI 숨김, 모든 기능은 인증 없이 기존처럼 동작 |
| 로그인 (일반) | 이메일/비밀번호, 탑바에 이메일 + 로그아웃 드롭다운 |
| 게스트 | `signInAnonymously()`, 탑바에 "게스트" 표시, 클릭 시 로그인 모달(전환) |
| 로그인 상태 | 쿠키 세션 + 미들웨어 자동 갱신 → 새로고침/재방문 유지 |

- 데이터 이전: 게스트 → 일반 계정 로그인 시 토큰 검증 후 자료 일괄 귀속 (트랜잭션)
- 서버가 모든 API에서 userId 일치를 검증 — 게스트/사용자 간 데이터 완전 분리

---

## 시작하기

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 설정 (.env.local — 아래 표 참고)

# 3. DB 생성 (빈 dev.db면 반드시 필요)
npx prisma db push
npx prisma generate

# 4. 개발 서버
npm run dev        # http://localhost:3000

# 타입 체크
npm run lint       # tsc --noEmit
```

> **주의**: `next.config.ts`의 `serverExternalPackages: ["pdfjs-dist"]`를 제거하면 PDF 업로드가 항상 500 에러가 납니다 (Turbopack에서 pdf.js 워커 동적 import 실패).

> Supabase를 켜려면 대시보드 → Authentication → Sign In / Up에서 **Anonymous sign-in**을 활성화하세요.

---

## 환경 변수 (`.env.local`)

| 변수 | 필수 | 설명 |
|---|---|---|
| `DATABASE_URL` | ✅ | SQLite 파일 URL (`file:./dev.db` 등) |
| `GEMINI_API_KEY` | ✅* | Google AI Studio 키 (OpenRouter만 쓰려면 생략 가능) |
| `GEMINI_MODEL` | — | 풀 순서를 재조정 (지정 모델을 최우선으로) |
| `OPENROUTER_API_KEY` | — | Gemini 전체 실패 시 2차 폴백용 |
| `NEXT_PUBLIC_SUPABASE_URL` | — | Supabase Project URL (둘 다 채워야 인증 ON) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | — | Supabase anon/public 키 |
| `MERGE_TOKEN_SECRET` | — | 게스트 데이터 이전 토큰 서명 키 (미설정 시 GEMINI_API_KEY 재사용) |

API 키는 절대 커밋/클라이언트에 노출하지 않습니다 — 모두 서버 사이드에서만 사용됩니다.

---

## 문제 유형·난이도 요약

| | EASY | HARD |
|---|---|---|
| 목적 | 중요한 내용을 제대로 배웠는지 확인 | 개념을 이해하고 사용할 수 있는지 확인 |
| 형태 | 정의·용어·핵심 사실·분류의 기억/기본 이해 | 새 상황 적용·추론·비교·예측·기전 설명 |
| 객관식 | 명확한 정답 + 그럴듯한 오답 3개 | 암기로는 구별 불가능한 선택지 설계 |
| 서술형 | 개념 설명 | 원인·결과/기전/예측 + 루브릭 채점 |
