# Use official Node.js image as base
FROM node:16-alpine

# Create app directory
WORKDIR /usr/src/app

# Install dependencies
COPY server/package*.json ./
RUN npm install

# Bundle app source
COPY server/ .

# Install MongoDB client tools (for health checks)
RUN apk add --no-cache mongodb-tools

# Create a health check script
RUN echo '#!/bin/sh\n\
until nc -z localhost 27017; do\n\
  echo "Waiting for MongoDB..."\n\
  sleep 1\n\
done\n\
exit 0' > /healthcheck.sh && chmod +x /healthcheck.sh

# Expose the app port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV MONGODB_URI=mongodb://mongo:27017/lti-grade-passback

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD ./healthcheck.sh

# Start the application
CMD ["npm", "start"]