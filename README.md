# Video Generation Studio Frontend

An interactive Next.js and Remotion-powered video studio frontend for creating, reviewing, and editing AI-generated short and long-form videos with human-in-the-loop (HITL) checkpoints.

---

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (v14.2.15, App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (v5.x)
- **UI & Styling**: [React](https://react.dev/) (v18.x), [Tailwind CSS](https://tailwindcss.com/) (v3.4.1), [Lucide React](https://lucide.dev/)
- **Video Engine**: [Remotion](https://www.remotion.dev/) (`@remotion/player`, `@remotion/renderer`, `@remotion/bundler`, `@remotion/tailwind` v4.0.513)
- **Data Fetching**: [SWR](https://swr.vercel.app/) (v2.5.1)
- **Containerization**: [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)

---

## Project Structure

```text
video-generation-frontend/
├── .agents/             # Agent skills and Remotion best practice references
├── .specs/              # Specification documentation and phase definitions
├── public/              # Static assets, fonts, and rendered video outputs
├── scripts/             # Remotion headless rendering and testing scripts
├── src/                 # Application source code
│   ├── adapters/        # Data transformation adapters (timeline.json -> editor state)
│   ├── app/             # Next.js App Router pages and API routes
│   ├── components/      # React components (editor, checkpoints, motion cards, UI)
│   ├── lib/             # API client, TypeScript types, and utility helpers
│   └── remotion/        # Remotion composition roots and render entrypoints
├── Dockerfile           # Multi-stage production container build with FFmpeg
├── docker-compose.yml   # Multi-container orchestration with backend pipeline
├── package.json         # Project metadata, dependencies, and npm scripts
├── tailwind.config.ts   # Tailwind CSS theme configuration
└── tsconfig.json        # TypeScript configuration and path aliases (@/*)
```

---

## Prerequisites

- **Node.js**: `>= 20.x` (validated on Node.js 20-bookworm)
- **npm**: `>= 10.x`
- **FFmpeg**: Required on the host machine for server-side Remotion rendering (included automatically in the Docker image)
- **Backend Service**: [video-generation-pipeline](http://localhost:8000) running FastAPI on port 8000

---

## Setup & Installation

1. **Clone the repository and navigate to the project directory**:
   ```bash
   cd video-generation-frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

---

## Environment Variables

Defined in `.env.example`:

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Yes | `http://localhost:8000` | URL of the backend FastAPI video generation pipeline |

---

## Running the Project

### Local Development

Start the Next.js development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build & Start

To build and run the optimized production bundle:

```bash
# Build the application
npm run build

# Start the production server
npm run start
```

### Running with Docker & Docker Compose

To run the frontend together with the backend pipeline:

```bash
# Build and run all services
docker compose up --build

# Run in detached mode
docker compose up -d
```

To build and run only the frontend container:

```bash
# Build Docker image
docker build -t video-generation-frontend .

# Run Docker container
docker run -p 3000:3000 -e NEXT_PUBLIC_API_URL=http://localhost:8000 video-generation-frontend
```

---

## Linting & Testing

### Code Quality

Run ESLint to check for code quality and syntax issues:

```bash
npm run lint
```

### Render Verification Scripts

The repository includes Remotion standalone test scripts in `scripts/`:

```bash
# Run headless Remotion video render test against sample timeline
node scripts/test_render.mjs
```

<!-- TODO: Automated unit/integration test suite (e.g. Jest / Playwright) has not been configured yet -->

---

## Key Application Routes

- `/`: Dashboard showing active and completed video jobs with real-time status polling.
- `/jobs/new`: Video generation creation form with preset templates (Documentary, Explainer, Shorts, Ad).
- `/jobs/[id]`: Job progress tracker featuring Human-in-the-Loop review checkpoints:
  - **Script Review**: Edit and approve beat narration, timestamps, and beat types.
  - **Footage Review**: Review visual candidate matches and swap alternatives.
- `/jobs/[id]/editor`: Full in-browser Remotion video editor with multi-track timeline, playback controls, asset inspection, motion graphic templates, and video export.
- `/api/render`: Server-side API endpoint delegating video export tasks to Remotion CLI.

---

## Deployment

The application is containerized via [Dockerfile](./Dockerfile) using `node:20-bookworm-slim` with `ffmpeg` installed for headless rendering.

- **Container Deployments**: Deploy the Docker container to any container platform (e.g. AWS ECS, GCP Cloud Run, Railway, Render) ensuring `NEXT_PUBLIC_API_URL` points to the deployed backend pipeline.
- **Vercel**: Can be deployed on Vercel as a Next.js App Router application. Note that server-side video rendering (`/api/render`) requires Remotion Lambda or a dedicated rendering instance if running in serverless environments.
