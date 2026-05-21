# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm install
COPY client/ .
RUN npm run build

# Stage 2: Build backend
FROM node:20-alpine AS backend-build
WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
RUN npm install
COPY server/ .
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS production
WORKDIR /app

# Install production dependencies for server
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --omit=dev

# Copy built backend
COPY --from=backend-build /app/server/dist ./server/dist

# Copy built frontend
COPY --from=frontend-build /app/client/dist ./client/dist

# Copy migration script (needed for first run)
COPY server/src/db/migrate.ts ./server/src/db/migrate.ts
COPY server/tsconfig.json ./server/

# Create data directory
RUN mkdir -p /app/data

# Environment
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/subpilot.db
ENV JWT_SECRET=change-this-in-production

EXPOSE 3000

# Run migration then start server
CMD ["sh", "-c", "cd /app/server && npx tsx src/db/migrate.ts && node dist/index.js"]
