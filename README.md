# 🎬 EdgeCut — AI Auto Highlights

**AI-powered video highlight generator** that analyzes long-form video and automatically finds the most engaging moments — with timestamps, transcripts, scores, and human‑readable explanations.

[![Frontend](https://img.shields.io/badge/demo-frontend-blue)](https://frontend-fo4wdhnyl-erukalasathwiks-projects.vercel.app/)
[![Backend](https://img.shields.io/badge/api-backend-green)](https://edgecut-highlights.onrender.com)
[![License](https://img.shields.io/badge/license-demo%20project-lightgrey)](#license)

---

<!-- 📸 Add a screenshot or short GIF of the app here, e.g.: -->
<!-- ![EdgeCut demo](docs/demo.gif) -->

## ⚡ Quick Start

```bash
git clone https://github.com/erukalasathwik/edgecut-highlights.git
cd edgecut-highlights/backend && npm install && cp .env.example .env
# add your ASSEMBLYAI_API_KEY to .env, then:
npm run dev &
cd ../frontend && npm install && npm run dev
```
Frontend → `http://localhost:5173` · Backend → `http://localhost:8787`

---

## 🔗 Live Links

| | |
|---|---|
| **Frontend** | https://frontend-fo4wdhnyl-erukalasathwiks-projects.vercel.app/ |
| **Backend API** | https://edgecut-highlights.onrender.com |
| **Repository** | https://github.com/erukalasathwik/edgecut-highlights |

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [How It Works](#-how-it-works)
- [Highlight Scoring](#-highlight-scoring)
- [Interest Filtering](#-interest-filtering)
- [Highlight Output Format](#-highlight-output-format)
- [REST API](#-rest-api)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Local Setup](#-local-setup)
- [URL Sources & YouTube Support](#-url-sources--youtube-support)
- [Validation](#-validation)
- [Deployment](#-deployment)
- [Design Decisions & Trade-offs](#-design-decisions--trade-offs)
- [Requirement Checklist](#-requirement-checklist)
- [Future Improvements](#-future-improvements)
- [License](#-license)

---

## 🧠 Overview

EdgeCut takes a video URL or upload, transcribes and analyzes it, and returns **ranked, non-overlapping highlight clips** — complete with timestamps, transcripts, confidence scores, and plain-English reasons for why each clip was chosen.

Built with a **TypeScript/Node.js backend** and a **React + Vite frontend**.

---

## ✨ Features

- Video URL input or local upload (MP4, MOV, WebM — up to 500 MB)
- Asynchronous highlight-generation jobs with real-time progress
- AI transcription with word-level timestamps (AssemblyAI)
- Five-signal highlight scoring engine
- Interest-based filtering (Funny, Emotional, Exciting, etc.)
- Top‑N, non-overlapping highlight selection
- Optional LLM re-ranking with human-readable reasons (OpenAI)
- Transcript display, highlight preview, one-click **Add to Timeline**
- Timeline view with clip durations and total runtime
- SQLite job storage + REST API
- Dockerized backend with FFmpeg for audio processing

---

## ⚙️ How It Works

```text
Video URL / Upload
        ↓
Create asynchronous job
        ↓
Download / store video
        ↓
Extract audio using FFmpeg
        ↓
Transcribe audio using AssemblyAI
        ↓
Create sliding transcript windows
        ↓
Calculate highlight signals
        ↓
Combine signals into a ranking score
        ↓
Select top non-overlapping clips
        ↓
Optional OpenAI LLM reranking
        ↓
Save results to SQLite
        ↓
Frontend polls job status
        ↓
Display AI-generated highlights
        ↓
Preview / Add to Timeline
```

**Processing pipeline in short:**

1. **Create job** — `POST /api/highlights` returns a `jobId` immediately; analysis runs in the background.
2. **Extract audio** — FFmpeg pulls a mono 16 kHz WAV track for transcription and audio-energy analysis.
3. **Transcribe** — AssemblyAI returns word-level timestamps, sentence data, and sentiment.
4. **Sliding windows** — transcript is split into overlapping **25‑second windows, 10‑second step**.
5. **Score** — each window is scored with five independent signals.
6. **Rank** — signals are normalized and combined into a weighted score.
7. **Select** — top candidates are chosen while preventing overlap.
8. **(Optional) LLM rerank** — if `OPENAI_API_KEY` is set, OpenAI semantically reranks clips against the selected interest and writes a short reason for each.
9. **Results** — saved to SQLite; the frontend polls `GET /api/highlights/:jobId` until complete.

---

## 📊 Highlight Scoring

| Signal | Weight | Description |
|---|---:|---|
| Audio Energy | 30% | Detects energetic or impactful moments via FFmpeg audio stats |
| Keyword Density | 25% | Identifies windows with important recurring vocabulary |
| Sentiment | 20% | Detects strongly positive or negative emotional moments |
| Speaking Pace | 15% | Identifies unusually fast or energetic speech |
| Position Bias | 10% | Small structural preference toward openings/endings |

```text
Final Score =
    0.30 × Audio Energy
  + 0.25 × Keyword Density
  + 0.20 × Sentiment
  + 0.15 × Speaking Pace
  + 0.10 × Position Bias
```

Weights are intentionally simple and interpretable — a future version could learn them from labeled, human-selected highlight data.

---

## 🎯 Interest Filtering

Users can prioritize the type of moment they want:

`All` · `Funny` · `Emotional` · `Exciting` · `Surprise` · `Shocking` · `Informative` · `Dramatic` · `Key Insight`

The selected interest is passed to the backend and used by the optional LLM re-ranking stage for better semantic relevance.

---

## 📦 Highlight Output Format

```json
{
  "start": 120,
  "end": 145,
  "score": 0.87,
  "transcript": "Example transcript...",
  "reason": "A strong and informative moment...",
  "signals": {
    "audioEnergy": 0.91,
    "keywordDensity": 0.82,
    "sentiment": 0.75,
    "speakingPace": 0.68,
    "positionBias": 0.10,
    "interestScore": 0.86
  }
}
```

The frontend displays the timestamp, score, transcript, reason, a preview button, and an **Add to Timeline** button for each highlight.

---

## 🔌 REST API

### Health Check
```http
GET /health
```

### Upload Video
```http
POST /api/upload
```
Multipart form data. Supports MP4, MOV, WebM. Max size: **500 MB**.

### Generate Highlights
```http
POST /api/highlights
```
```json
{
  "videoUrl": "https://example.com/video.mp4",
  "maxHighlights": 5,
  "targetDurationSeconds": 60,
  "interest": "Funny"
}
```
```json
{ "jobId": "abc123", "status": "queued" }
```

### Get Job Status / Results
```http
GET /api/highlights/:jobId
```
Statuses: `queued` → `processing` → `completed` / `failed`. Returns highlights once completed.

---

## 🛠 Tech Stack

**Frontend:** React · TypeScript · Vite · HTML5 Video · CSS
**Backend:** Node.js 20+ · Express · TypeScript · SQLite · Multer · FFmpeg
**AI / Processing:** AssemblyAI (transcription + sentiment) · OpenAI (optional reranking) · FFmpeg (audio analysis)
**Deployment:** Vercel (frontend) · Render (backend, Docker)

---

## 📁 Project Structure

```text
edgecut-highlights/
│
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── highlights.ts
│   │   │   └── upload.ts
│   │   ├── services/
│   │   │   ├── audioEnergy.ts
│   │   │   ├── jobProcessor.ts
│   │   │   ├── llmRerank.ts
│   │   │   ├── media.ts
│   │   │   ├── scoring.ts
│   │   │   └── transcribe.ts
│   │   ├── db.ts
│   │   ├── index.ts
│   │   └── types.ts
│   ├── Dockerfile
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── HighlightsPanel.tsx
│   │   │   ├── InterestFilter.tsx
│   │   │   ├── ProcessingChecklist.tsx
│   │   │   └── Timeline.tsx
│   │   ├── App.tsx
│   │   ├── api.ts
│   │   ├── styles.css
│   │   └── types.ts
│   ├── package.json
│   └── vite.config.ts
│
├── render.yaml
├── README.md
└── .gitignore
```

---

## 🚀 Local Setup

### Prerequisites
- Node.js 20+
- FFmpeg
- AssemblyAI API key ([free tier signup](https://www.assemblyai.com/dashboard/signup))
- *(Optional)* OpenAI API key
- *(Optional, for YouTube)* `yt-dlp`

### 1. Clone the repo
```bash
git clone https://github.com/erukalasathwik/edgecut-highlights.git
cd edgecut-highlights
```

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env
```
Edit `.env`:
```env
ASSEMBLYAI_API_KEY=your_assemblyai_api_key

# Optional
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
```
Run it:
```bash
npm run dev
```
Backend → `http://localhost:8787`

### 3. Frontend
In a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Frontend → `http://localhost:5173`

> ⚠️ **Security note:** `.env` is git-ignored — never commit real API keys. Rotate any key that was ever committed to version control.

---

## 🎥 URL Sources & YouTube Support

- Paste a **public YouTube URL** → preview loads automatically via the YouTube player.
- Paste a **direct MP4 / MOV / WebM URL** → the browser video preview loads automatically.
- YouTube highlight generation/export uses **`yt-dlp`** on the backend.

Install `yt-dlp` and ensure it's on your `PATH`, or set `YTDLP_PATH` in `backend/.env`.

**Windows install:**
```powershell
py -m pip install -U yt-dlp
yt-dlp --version
```
If installed elsewhere:
```env
YTDLP_PATH=C:\path\to\yt-dlp.exe
```

---

## ✅ Validation

```bash
# Backend type checking
cd backend && npm run typecheck

# Backend tests
npm test

# Frontend type checking
cd frontend && npm run typecheck
```
The project should compile without TypeScript errors.

---

## ☁️ Deployment

### Backend — Render
Deployed as a **Docker** service (needs Node.js + FFmpeg for long-running async processing). `render.yaml` and `backend/Dockerfile` handle build/deploy.

Environment variables to configure on Render:
```env
ASSEMBLYAI_API_KEY=your_key
OPENAI_API_KEY=your_optional_key
OPENAI_MODEL=gpt-4o-mini
PORT=8787
DB_PATH=/app/data/highlights.db
FFMPEG_PATH=ffmpeg
YTDLP_PATH=yt-dlp
```

### Frontend — Vercel
The React/Vite frontend deploys separately and talks to the Render backend API.

---

## 💡 Design Decisions & Trade-offs

- **Asynchronous processing** — jobs return immediately with a `jobId`; the frontend polls status instead of holding a long-lived request open.
- **SQLite** — keeps the project simple with no external DB service; a managed database (e.g. PostgreSQL) would suit production scale better.
- **In-process job processing** — jobs run inside the backend process; a queue like **BullMQ + Redis** would add distributed workers, retries, and durability at scale.
- **Local file storage** — uploads are stored temporarily on the server; object storage (e.g. S3-compatible) would be preferable in production.
- **Hand-tuned scoring weights** — simple and interpretable; a future version could train a ranking model on labeled, human-selected highlights.
- **Direct media URLs** — the app expects an accessible video/media URL rather than scraping arbitrary pages; broader platform support would need a dedicated media-acquisition layer respecting each platform's terms.
- **No auth / rate limiting** — out of scope for this standalone demo project; required for a production multi-user system.

---

## 📋 Requirement Checklist

| Requirement | Status |
|---|---|
| REST API (Express + TypeScript) | ✅ |
| `POST /api/highlights` | ✅ |
| `GET /api/highlights/:jobId` | ✅ |
| Async job processing | ✅ |
| Speech transcription (AssemblyAI) | ✅ |
| Sliding windows (25s / 10s step) | ✅ |
| ≥2 scoring signals (5 implemented) | ✅ |
| Audio energy | ✅ |
| Keyword density | ✅ |
| Sentiment | ✅ |
| Speaking pace | ✅ |
| Position bias | ✅ |
| Top‑N, non-overlapping highlights | ✅ |
| Human-readable reasons | ✅ |
| Optional LLM re-ranking | ✅ |
| React frontend + progress polling | ✅ |
| Highlights panel, preview, Add to Timeline | ✅ |
| Timeline total duration | ✅ |
| SQLite storage | ✅ |
| TypeScript (frontend + backend) | ✅ |
| Unit tests (scoring) | ✅ |
| Docker + FFmpeg | ✅ |
| Vercel + Render deployment | ✅ |

---

## 🔮 Future Improvements

- Support additional video platforms
- Improve highlight duration targeting
- Train scoring weights on labeled data
- Persistent object storage
- Redis/BullMQ job queues
- Authentication & rate limiting
- Video clip export/download
- Subtitle generation
- Improved multilingual transcription
- More advanced semantic ranking

---

## 📄 License

This project was built as a standalone AI video-processing demo/evaluation project.
