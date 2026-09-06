# =========================
# Stage 1: Build Frontend
# =========================
FROM node:20-slim AS frontend-build

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


# =========================
# Stage 2: Build Backend
# =========================
FROM node:20-slim AS backend-build

WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/tsconfig.json ./
COPY backend/src ./src

RUN npm run build


# =========================
# Stage 3: Production
# =========================
FROM node:20-slim

# Install FFmpeg, Python and yt-dlp
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ffmpeg \
       python3 \
       python3-pip \
    && python3 -m pip install --break-system-packages -U yt-dlp \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install production backend dependencies
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled backend
COPY --from=backend-build /app/backend/dist ./dist

# Copy compiled frontend
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Create application directories
RUN mkdir -p /app/data /app/uploads

# Environment variables
ENV NODE_ENV=production
ENV PORT=8787
ENV DB_PATH=/app/data/highlights.db
ENV FFMPEG_PATH=ffmpeg
ENV YTDLP_PATH=yt-dlp

EXPOSE 8787

CMD ["node", "dist/index.js"]