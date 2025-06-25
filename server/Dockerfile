FROM node:18-slim

WORKDIR /app

# Copy package files first for better caching
COPY server/package.json server/package-lock.json ./
RUN npm install --production

# Copy source code
COPY server/ ./

# Health check using curl to your own health endpoint
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

EXPOSE 3001
CMD ["node", "server.js"]