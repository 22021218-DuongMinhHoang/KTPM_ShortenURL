FROM oven/bun:latest

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Expose ports
EXPOSE 3001 3002

# Start command (will be overridden by docker-compose environment)
CMD ["bun", "run", "src/index.ts"]
