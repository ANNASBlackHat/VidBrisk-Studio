# VidBrisk Footage Manager & Analytics — Tech Spec

Oct 11, 2026 · @Annas Social

## Overview

The footage manager is a web frontend and backend that lets you see, search and measure everything in the VidBrisk footage library, so footage selection stops depending on guessed keywords. It is the first step toward the selection debugger and eval harness, since both need the same indexed, shot-level data.

**Problems it solves**

- Retrieval relies on the AI producing one or two keywords and hoping the embedding match lands.
- You cannot ask for a specific named subject (for example one particular ship) even when that footage is already in the library.
- Choosing matching clips by hand, clip by clip, takes too long.
- Stock footage (for example Pexels) is often a short loop with little visual change, while YouTube-sourced footage tends to be more dynamic.
- There is no view of what the library contains, so duplicates, gaps and topic skew are invisible.

**Goals**

1. Search the library by typed meaning and get back shots, not just files.
2. Browse and filter by source, duration, resolution, date and motion, in grid or list.
3. See library analytics: counts and hours by source, growth over time, usage.
4. Show an embedding map of the library, so you can see what topics it centres on.
5. Detect exact, near and semantically similar footage, with a similarity percentage.
6. Keep every embedding tagged with its model, so X-CLIP and Qwen can be compared.

**Non-goals for the MVP**

- Changing how the engine selects footage (that comes after the eval harness).
- Shot captioning with a vision model, which is a later step by your own ordering.
- Editing or rendering video; Remotion and the review UI stay as they are.

## Features

The MVP is Explore, Analytics and basic duplicate detection; the embedding map and the engine-facing tools follow.

| Feature | What it does | Phase |
| --- | --- | --- |
| Semantic search | Type any text, get matching shots ranked by embedding similarity; also "more like this" from a clip or an uploaded image | MVP |
| Library browser | Grid and list views with hover-scrub preview; filter by source (YouTube, Pexels, other), duration, resolution, date added, motion score, used / never used | MVP |
| Sorting | Newest, oldest, search score, duration, motion score, usage count | MVP |
| Clip detail | Player, shot breakdown, source URL, metadata, where it was used, similar clips, duplicate group | MVP |
| Analytics | Clip count and total hours per source; additions over time; duration and resolution distributions; used vs never used | MVP |
| Motion score | Per-shot visual-change score; flag loop-like clips; "hide static clips" filter | MVP |
| Exact and near duplicates | Duplicate groups with a similarity percentage and keep / merge / archive actions | Phase 2 |
| Embedding map | 2D map of the library coloured by source or topic, click a point to preview, auto-labelled clusters | Phase 3 |
| Named subjects | Link shots to a normalised entity (for example a specific ship) with suggested matches, so "everything showing X" works | Phase 3 |
| Selection debugger | Per beat: narration, generated keywords, top candidates with scores, the pick, one-click override | Phase 4 |
| Eval harness view | Re-run selection on an ingested reference video and compare picks beat by beat across model or prompt versions | Phase 4 |
| Curation queue | Keyboard-driven accept / reject / tag triage for newly ingested footage | Phase 4 |

**Why named subjects use a controlled vocabulary.** Freeform tags were rejected because the vocabulary gets forgotten. Entities here are created once, carry aliases, and are proposed by visual similarity, so the system suggests the name instead of you remembering it.

## Architecture

The frontend talks only to one API; everything heavy (scene detection, proxies, embeddings) runs in workers that write into a single store.

&#91;embedded content: system architecture · frontend, API, store, queue, workers\]

The API only reads the store and enqueues jobs; workers pull jobs from Redis, read the source files and write shots, vectors and proxies back.

| Component | Technology | Responsibility |
| --- | --- | --- |
| Frontend | Next.js | Explore, Analytics, Duplicates, Map and Ingest pages |
| API | FastAPI | Search, filters, analytics, duplicate actions, ingest requests |
| Store | Postgres with pgvector | Metadata, filters and one vector index per embedding model |
| Object storage | S3-compatible bucket, or local disk to start | Originals, thumbnails, previews and sprite sheets |
| Queue | Redis with Celery | Job chain for each asset, retries and progress |
| CPU workers | Python, ffmpeg, PySceneDetect, OpenCV | Probe, shots, proxies, motion score, hashes |
| GPU workers | Python, X-CLIP, a Qwen embedder | Embeddings per shot, per model |

Every choice here follows what the stack already uses (Python workers, Celery and Redis, Next.js), except pgvector, which is a proposal.

## Ingest pipeline

Every asset runs through one idempotent Celery job chain that turns a raw file into searchable, previewable shots. Each step writes its result and a version, so a step can be re-run alone (for example re-embedding with a new model) without redoing the rest.

1. **Register the asset.** Record source type (YouTube, Pexels, other), source URL, license note, file path or object key, and a SHA-256 checksum of the file. An existing checksum means an exact duplicate, so link it instead of re-processing.
2. **Probe.** Read duration, resolution, fps and codec with ffprobe.
3. **Detect shots.** Run PySceneDetect, which the pipeline already uses. Each shot gets a start and end time. Very long shots are split into fixed windows (about 8 s) so one embedding does not cover too much change.
4. **Build proxies.** Per shot: a WebP thumbnail, a short low-res H.264 preview (about 480p) and a sprite sheet for hover-scrub. The UI never loads originals for browsing.
5. **Score motion.** Sample frames at about 4 fps on downsampled grayscale and compute mean frame difference or optical flow. Store a 0–1 motion score per shot. Flag a loop when the first and last frames match and the frame signature repeats periodically, which catches the repeating Pexels-style clips.
6. **Hash keyframes.** Compute a perceptual hash (pHash) for several keyframes per shot, for near-duplicate detection that survives re-encoding and cropping.
7. **Embed shots.** Sample frames uniformly from each shot and embed with each configured model. X-CLIP runs locally and takes a fixed frame count per clip (8 for the common base checkpoints); a Qwen-based multimodal embedder runs on a GPU worker. Vectors are stored per model.
8. **Optional transcript.** For YouTube sources with speech, run WhisperX and store word timings, which later supports searching by what is said.
9. **Mark ready.** Set the asset status to ready; the UI shows partial progress for assets still processing.

Workers are split by hardware: CPU workers for ffprobe, scene detection, proxies, motion and hashing; GPU workers (Colab or a hosted box) for embeddings. Redis is the shared broker, as in the existing Celery setup.

## Data model

The proposed store is Postgres with the pgvector extension, so metadata, vectors and filters live in one database and one query can combine "similar to this text" with "source = Pexels and motion > 0.4". This is a default to confirm against what already exists (see open questions).

| Table | Key columns | Purpose |
| --- | --- | --- |
| `assets` | id, source\_type, source\_url, license\_note, storage\_key, sha256, duration\_s, width, height, fps, status, created\_at | One row per source file |
| `shots` | id, asset\_id, start\_s, end\_s, thumb\_key, preview\_key, sprite\_key, motion\_score, is\_loop, phash\_set | One row per detected shot; the unit of search |
| `embedding_models` | id, name, version, dims, modality, notes | Registry of models, so vectors are never mixed |
| `shot_embeddings` | shot\_id, model\_id, vector | One vector per shot per model; one vector index per model |
| `duplicate_groups` | id, kind (exact / near / similar), created\_at | A cluster of related shots or assets |
| `duplicate_members` | group\_id, shot\_id, similarity | Membership with a similarity score |
| `entities` | id, name, kind, aliases | Controlled vocabulary of named subjects |
| `shot_entities` | shot\_id, entity\_id, confidence, status (suggested / confirmed) | Links shots to subjects |
| `usage` | shot\_id, video\_id, beat\_id, used\_at | Where each shot was used, for used / never used and overuse |
| `map_points` | model\_id, shot\_id, x, y, cluster\_id | Cached 2D projection for the embedding map |
| `clusters` | id, model\_id, label, size | Cluster labels shown on the map |

Object storage holds originals and proxies; the database holds only keys and metadata. Embeddings carry their model id, and a re-embed writes a new set under the new model rather than overwriting.

## Search and similarity design

Search returns ranked shots from one chosen model's index, with metadata filters applied in the same query. Duplicate detection uses three different methods, because one cosine number cannot tell "same file" from "same kind of scene".

**Search**

- **Query types:** text, "more like this shot" (uses that shot's stored vector), and an uploaded image where the model supports it.
- **One index per model.** The user picks the model (X-CLIP or Qwen) in a dropdown, and the default is whichever wins the eval comparison. Vectors from different models are never compared.
- **Filters run with the vector search** (source, duration, resolution, date, motion, used / never used), not after it, so a filter does not empty the result page.
- **Approximate nearest neighbor:** HNSW index in pgvector with cosine distance. Revisit a dedicated vector store only if the library outgrows it.
- **Later:** an LLM rewrites one typed query into several phrasings and the scores are averaged, and transcript keywords are blended in for YouTube sources.

**Duplicate and similarity tiers**

| Tier | Method | UI label | What it means |
| --- | --- | --- | --- |
| Exact | Same SHA-256, or identical pHash set on all keyframes | 100% identical | The same file or frames |
| Near duplicate | Share of keyframe pHashes within a small Hamming distance, confirmed by very high embedding similarity | e.g. 94% match | Same footage re-encoded, resized, cropped or trimmed |
| Visually similar | Embedding cosine similarity inside a band below near-duplicate | e.g. 88% similar | Different footage of the same kind of scene |

- The percentage is a calibrated score, not raw cosine. Calibrate it by labelling about 200 sampled pairs by eye (same / near / similar / different) and choosing the cutoffs that separate them; the 0.85–0.95 band mentioned earlier is only a starting guess.
- Never compare all pairs. For each shot, fetch its top-k neighbors from the index, keep pairs above the tier threshold, and union them into groups in a nightly or post-ingest background job.
- Groups store a suggested keeper (highest resolution, then longest), and actions are keep, merge or archive. Nothing is deleted automatically.

**Embedding map**

1. Take all shot vectors for the selected model.
2. Reduce to 2D with UMAP using cosine distance, and cache the result in `map_points`.
3. Cluster with HDBSCAN so the number of clusters is not fixed in advance; points that fit no cluster stay unlabelled.
4. Label clusters by comparing each cluster centroid with a list of candidate phrases using the model's text encoder, or by sending a few thumbnails from the cluster to a vision LLM.
5. In the UI, colour points by source, cluster or motion score, and click a point to preview the shot.

The map is recomputed after large ingests, not on every clip, and its axes carry no meaning: only distance and grouping do.

## API and frontend pages

The backend is a FastAPI service over the Postgres store; the frontend is Next.js and talks to it with typed, cursor-paginated JSON endpoints. Filter and search state lives in the URL, so any view can be bookmarked or shared.

**API endpoints**

| Endpoint | Purpose |
| --- | --- |
| `GET /shots` | List shots with filters (source, duration, resolution, date, motion, used), sort and cursor |
| `POST /search` | Text, shot-id or image query; model id; filters; returns ranked shots with scores |
| `GET /shots/{id}` | Shot detail with asset, usage, similar shots and duplicate group |
| `GET /assets/{id}` | Asset detail and its shots |
| `GET /analytics/summary` | Counts, hours, distributions and growth by source |
| `GET /map?model=` | Cached 2D points, cluster ids and labels |
| `GET /duplicates` | Duplicate groups by tier, with members and similarity |
| `POST /duplicates/{id}/resolve` | Keep, merge or archive action |
| `POST /ingest` | Register an asset or folder and enqueue the job chain |
| `GET /ingest/jobs` | Progress per asset and step |
| `GET /models` | Registered embedding models and index status |
| `POST /entities`, `POST /shots/{id}/entities` | Create subjects and link shots (Phase 3) |

**Pages**

| Page | Behavior |
| --- | --- |
| Explore | Search box on top, filter bar, sort menu, grid / list toggle. Virtualized grid so thousands of thumbnails stay smooth; hover scrubs the sprite; click opens a side panel with the player, metadata and similar shots. A model dropdown sets which index is searched. |
| Analytics | Cards for total clips, total hours and never-used share; bar charts by source; line chart of additions over time; duration and resolution histograms. |
| Duplicates | Tabs for exact, near and similar; each group shows members side by side with the similarity percentage and the suggested keeper. |
| Map | WebGL scatter (deck.gl or regl-scatterplot) for tens of thousands of points; colour-by selector; cluster labels; lasso select to bulk filter or tag; click to preview. |
| Ingest | Upload or register sources, job progress per step, failures with retry. |

The UI never loads original files for browsing: it uses signed URLs for the proxies, and the player requests the original only on explicit "open source".

## Phased build plan

Each phase ends with something you can use, and no phase starts before the previous one's acceptance criteria pass. Phase 4 is where this connects to the footage-selection eval harness you decided to build first.

| Phase | Scope | Acceptance criteria |
| --- | --- | --- |
| 1. Foundation and Explore | Schema, ingest chain (probe, shots, proxies, motion, hashes, one embedding model), `/shots` and `/search`, Explore page, basic Analytics | A folder of real footage ingests end to end; a typed query returns relevant shots in under 1 s on the existing library; filters by source, duration and motion work; analytics counts match the database |
| 2. Duplicates and second model | Checksum and pHash duplicates, near-duplicate groups, second embedding model and model dropdown, Duplicates page | Seeded known duplicates (re-encoded and cropped copies) are all found; the labelled pair sample yields agreed thresholds; the same query can be run on both models and compared |
| 3. Map and named subjects | UMAP and HDBSCAN projection, cluster labels, Map page, entities with suggested matches | The map loads for the full library in a few seconds from cache; clusters match topics you recognize; a named subject query returns known footage of that subject |
| 4. Engine-facing tools | Usage tracking, selection debugger, eval harness view, curation queue | For a rendered video, each beat shows keywords, candidates and the pick; an ingested reference video can be re-run and compared per beat; overrides are saved |

The sample-and-label step in Phase 2 is worth doing even if it feels slow: it turns the similarity percentage from a guess into a number you trust.

## Risks and open questions

The biggest unknown is how footage and embeddings are stored today, because it decides whether Phase 1 is "connect to what exists" or "build the ingest chain first".

**Open questions**

- [ ] Where does footage live now (local disk, object storage), and where do the current embeddings live?
- [ ] Is this a standalone app or a new section inside the existing Next.js frontend?
- [ ] Is it only for you, or will editors and teammates use it (this affects auth and permissions)?
- [ ] Footage-first or concept-first production? Footage-first makes Explore the main screen; concept-first makes the debugger and gap analytics more important.
- [ ] How large is the library today (clips and hours), and how fast does it grow?
- [ ] Which GPU is available for the second embedding model (Colab session, hosted GPU, local)?

**Risks**

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Dark or uniform footage hashes alike | Dark ocean clips can produce near-identical pHashes and false duplicate matches | Require several keyframes to agree and confirm with embedding similarity before labelling near-duplicate |
| Embedding quality on abstract queries | X-CLIP may rank poorly for abstract or very specific text | Compare it with the second model on real queries before choosing a default; keep per-model indexes |
| GPU availability | Embedding runs on Colab-style sessions can stop mid-job | Idempotent, resumable per-shot jobs; queue persists in Redis |
| Motion score misjudges clips | Camera pans can look like high motion; slow subjects look static | Treat it as a filter and badge you can override, and check it against a handful of known loops |
| Mixed-source licensing | YouTube and stock footage carry different usage rights | Store a source URL and license note per asset and show it in the clip detail |
| UMAP instability | Projections shift between runs, which can confuse a returning user | Fix the random seed and recompute only after large ingests |

**Future work.** Shot captioning with a vision model, searching by spoken transcript, and feeding usage and retention data back into footage ranking.
