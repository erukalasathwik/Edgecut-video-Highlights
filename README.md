# EdgeCut — AI Auto Highlights

EdgeCut is an AI-powered video highlight generator that analyzes long-form video content and automatically identifies the most engaging moments.

Users can provide a video URL or upload a video, choose the number and type of highlights they want, and receive ranked, non-overlapping highlight segments with timestamps, transcripts, scores, and explanations.

The project is built with a TypeScript/Node.js backend and a React/Vite frontend.

## Live Demo

**Frontend:**
https://frontend-fo4wdhnyl-erukalasathwiks-projects.vercel.app/

**Backend API:**
https://edgecut-highlights.onrender.com

**GitHub:**
https://github.com/erukalasathwik/edgecut-highlights

---

## Features

* Video URL input
* Local video upload
* MP4, MOV and WebM support
* Maximum upload size of 500 MB
* Asynchronous highlight-generation jobs
* Real-time processing progress
* AI transcription with word-level timestamps
* Automatic highlight scoring
* Five content signals
* Interest-based filtering
* Top N non-overlapping highlights
* Transcript display
* Human-readable highlight reasons
* Highlight preview
* One-click Add to Timeline
* Timeline with clip durations and total duration
* Optional LLM-based reranking
* SQLite job storage
* REST API
* React + TypeScript frontend
* Docker deployment with FFmpeg

---

# How It Works

The application follows this pipeline:

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

## Processing Pipeline

### 1. Create Highlight Job

The frontend sends a request to:

```http
POST /api/highlights
```

The backend immediately creates a job in SQLite and returns a `jobId`.

Example response:

```json
{
  "jobId": "example-job-id",
  "status": "queued"
}
```

The video analysis then runs asynchronously in the background.

### 2. Extract Audio

FFmpeg extracts a mono 16 kHz WAV audio track from the source video.

This audio is used for transcription and audio-energy analysis.

### 3. Transcription

The audio is sent to **AssemblyAI** using a publicly available API key.

The transcription includes:

* Word-level timestamps
* Sentence information
* Sentiment information

### 4. Sliding Windows

The transcript is divided into overlapping **25-second windows with a 10-second step**.

Each window becomes a candidate highlight.

### 5. Highlight Scoring

Each candidate window is evaluated using five independent signals.

### 6. Ranking

The signals are normalized and combined into a weighted score.

### 7. Non-Overlapping Selection

The highest-ranked candidates are selected while preventing overlapping highlight segments.

### 8. Optional LLM Reranking

If an `OPENAI_API_KEY` is configured, OpenAI is used to semantically rerank the selected clips according to the user's selected interest.

The LLM also generates a concise human-readable reason for why the clip is interesting.

If the OpenAI key is unavailable, the application continues using the local scoring system.

### 9. Results

Results are stored in SQLite.

The frontend polls:

```http
GET /api/highlights/:jobId
```

until processing is completed.

---

# Highlight Scoring

EdgeCut uses five signals.

| Signal          | Weight | Description                                                          |
| --------------- | -----: | -------------------------------------------------------------------- |
| Audio Energy    |    30% | Detects energetic or impactful moments using FFmpeg audio statistics |
| Keyword Density |    25% | Identifies windows containing important recurring vocabulary         |
| Sentiment       |    20% | Detects strongly positive or negative emotional moments              |
| Speaking Pace   |    15% | Identifies unusually fast or energetic speech                        |
| Position Bias   |    10% | Gives a small structural preference to openings and endings          |

The final score is calculated as a weighted combination of the normalized signals.

```text
Final Score =
    0.30 × Audio Energy
  + 0.25 × Keyword Density
  + 0.20 × Sentiment
  + 0.15 × Speaking Pace
  + 0.10 × Position Bias
```

The weights are intentionally simple and interpretable.

A future version could learn these weights from a labeled dataset containing human-selected highlights.

---

# Interest Filtering

Users can select the type of content they want to prioritize.

Available interests include:

* All
* Funny
* Emotional
* Exciting
* Surprise
* Shocking
* Informative
* Dramatic
* Key Insight

The selected interest is passed to the backend and can be used by the optional LLM reranking stage to improve semantic relevance.

---

# Highlight Output

Each generated highlight contains:

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

The frontend displays:

* Timestamp
* Score
* Transcript
* Reason
* Preview button
* Add to Timeline button

---

# REST API

## Health Check

```http
GET /health
```

Returns the backend health status.

---

## Upload Video

```http
POST /api/upload
```

Accepts a video file using multipart form data.

Supported formats:

* MP4
* MOV
* WebM

Maximum upload size:

```text
500 MB
```

---

## Generate Highlights

```http
POST /api/highlights
```

Creates an asynchronous highlight-generation job.

The request can contain:

* Video URL
* Maximum number of highlights
* Target highlight duration
* Interest category

Example:

```json
{
  "videoUrl": "https://example.com/video.mp4",
  "maxHighlights": 5,
  "targetDurationSeconds": 60,
  "interest": "Funny"
}
```

Example response:

```json
{
  "jobId": "abc123",
  "status": "queued"
}
```

---

## Get Highlight Job Status

```http
GET /api/highlights/:jobId
```

While processing, the API returns job status and progress.

After completion, it returns the generated highlights.

Possible statuses include:

```text
queued
processing
completed
failed
```

---

# Technology Stack

## Frontend

* React
* TypeScript
* Vite
* HTML5 Video
* CSS

## Backend

* Node.js 20+
* Express
* TypeScript
* SQLite
* Multer
* FFmpeg

## AI / Processing

* AssemblyAI — speech transcription and sentiment analysis
* OpenAI — optional semantic reranking
* FFmpeg — audio extraction and audio-energy analysis

## Deployment

* Vercel — frontend
* Render — backend

---

# Project Structure

```text
edgecut-highlights/
│
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── highlights.ts
│   │   │   └── upload.ts
│   │   │
│   │   ├── services/
│   │   │   ├── audioEnergy.ts
│   │   │   ├── jobProcessor.ts
│   │   │   ├── llmRerank.ts
│   │   │   ├── media.ts
│   │   │   ├── scoring.ts
│   │   │   └── transcribe.ts
│   │   │
│   │   ├── db.ts
│   │   ├── index.ts
│   │   └── types.ts
│   │
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
│   │   │
│   │   ├── App.tsx
│   │   ├── api.ts
│   │   ├── styles.css
│   │   └── types.ts
│   │
│   ├── package.json
│   └── vite.config.ts
│
├── render.yaml
├── README.md
└── .gitignore
```

---

# Local Setup

## Prerequisites

Install:

* Node.js 20+
* FFmpeg
* AssemblyAI API key

Optional:

* OpenAI API key

---

## 1. Clone Repository

```bash
git clone https://github.com/erukalasathwik/edgecut-highlights.git

cd edgecut-highlights
```

---

## 2. Backend Setup

```bash
cd backend
npm install
```

Create the environment file:

```bash
cp .env.example .env
```

Add your AssemblyAI API key:

```env
ASSEMBLYAI_API_KEY=your_assemblyai_api_key
```

Optional OpenAI configuration:

```env
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
```

Start the backend:

```bash
npm run dev
```

Backend:

```text
http://localhost:8787
```

---

## 3. Frontend Setup

Open another terminal:

```bash
cd frontend
npm install
```

Start the frontend:

```bash
npm run dev
```

Frontend:

```text
http://localhost:5173
```

---

# Validation

Run backend type checking:

```bash
cd backend
npm run typecheck
```

Run backend tests:

```bash
npm test
```

Run frontend type checking:

```bash
cd frontend
npm run typecheck
```

The project should compile without TypeScript errors.

---

# Deployment

## Backend — Render

The backend is deployed as a Docker service because it requires:

* Node.js
* FFmpeg
* Long-running asynchronous video processing

The Dockerfile installs FFmpeg and builds the TypeScript backend.

Configure the following environment variables on Render:

```env
ASSEMBLYAI_API_KEY=your_key
OPENAI_API_KEY=your_optional_key
OPENAI_MODEL=gpt-4o-mini
PORT=8787
DB_PATH=/app/data/highlights.db
FFMPEG_PATH=ffmpeg
```

Live backend:

https://edgecut-highlights.onrender.com

---

## Frontend — Vercel

The React/Vite frontend is deployed separately on Vercel.

The frontend communicates with the Render backend API.

Live frontend:

https://frontend-fo4wdhnyl-erukalasathwiks-projects.vercel.app/

---

# Design Decisions and Trade-offs

### Asynchronous Processing

Video processing can take significant time, so the API creates a job and immediately returns a `jobId`.

The frontend polls the status endpoint rather than keeping a request open for the entire analysis.

### SQLite

SQLite keeps the project simple and requires no external database service.

For production scale, PostgreSQL or another managed database would be more appropriate.

### In-Process Job Processing

Jobs currently run in the backend process.

For a larger production system, a queue such as BullMQ with Redis would allow:

* Distributed workers
* Better reliability
* Retry handling
* Persistent job queues

### Local File Storage

Uploaded files are temporarily stored on the server during processing.

For production, object storage such as S3-compatible storage would be preferable.

### Scoring Weights

The scoring weights are hand-tuned and interpretable.

A future version could train a ranking model using a dataset of human-selected highlights.

### Video URLs

The application currently expects a directly accessible video/media URL rather than automatically downloading videos from arbitrary YouTube pages.

Supporting YouTube and other platforms would require an additional media acquisition layer and must respect the platform's terms and access policies.

### Authentication

Authentication and rate limiting are not included because this is a standalone mini-project.

They would be required for a production multi-user application.

---

# Assignment Requirement Checklist

| Requirement                  | Implementation         |
| ---------------------------- | ---------------------- |
| REST API                     | Express + TypeScript   |
| POST `/api/highlights`       | Implemented            |
| GET `/api/highlights/:jobId` | Implemented            |
| Async job processing         | Implemented            |
| Speech transcription         | AssemblyAI             |
| Sliding windows              | 25s windows / 10s step |
| At least 2 scoring signals   | 5 signals implemented  |
| Audio energy                 | Implemented            |
| Keyword density              | Implemented            |
| Sentiment                    | Implemented            |
| Speaking pace                | Implemented            |
| Position bias                | Implemented            |
| Top N highlights             | Implemented            |
| Non-overlapping clips        | Implemented            |
| Human-readable reason        | Implemented            |
| Optional LLM reranking       | Implemented            |
| React frontend               | Implemented            |
| Progress polling             | Implemented            |
| Highlights panel             | Implemented            |
| Preview                      | Implemented            |
| Add to Timeline              | Implemented            |
| Timeline total duration      | Implemented            |
| SQLite storage               | Implemented            |
| TypeScript                   | Frontend + Backend     |
| Unit tests                   | Scoring tests included |
| Docker + FFmpeg              | Implemented            |
| Vercel deployment            | Implemented            |
| Render deployment            | Implemented            |

---

# Future Improvements

* Support additional video platforms
* Improve highlight duration targeting
* Train scoring weights using labeled data
* Add persistent object storage
* Add Redis/BullMQ job queues
* Add authentication
* Add rate limiting
* Add video clip export/download
* Add subtitle generation
* Improve multilingual transcription
* Add more advanced semantic ranking

---

# License

This project was created as a standalone AI video-processing mini-project for demonstration and evaluation purposes.


## URL sources

- Paste a public YouTube URL and the preview loads automatically using the YouTube player.
- Paste a direct MP4, MOV, or WebM URL and the browser video preview loads automatically.
- YouTube highlight generation/export uses `yt-dlp` on the backend. Install it and make sure `yt-dlp` is available on PATH, or set `YTDLP_PATH` in `backend/.env`.

Windows install:

```powershell
py -m pip install -U yt-dlp
yt-dlp --version
```

If `yt-dlp` is installed elsewhere, set for example:

```env
YTDLP_PATH=C:\path\to\yt-dlp.exe
```
