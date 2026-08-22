# ==============================================================================
# Video Generation Frontend Dockerfile
# ==============================================================================
FROM node:20-bookworm-slim

WORKDIR /app

# Install system dependencies (ffmpeg, curl, ca-certificates)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifests
COPY package*.json ./

# Install npm dependencies
RUN npm ci

# Copy application source code
COPY . .

# Set production environment variables
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    PORT=3000 \
    NEXT_PUBLIC_API_URL=http://localhost:8000

# Build Next.js application
RUN npm run build

# Expose Next.js port
EXPOSE 3000

# Start production server
CMD ["npm", "run", "start"]
