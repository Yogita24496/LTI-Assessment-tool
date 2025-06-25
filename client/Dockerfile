# Build stage
FROM node:18-alpine AS build

WORKDIR /app

# Set npm configurations to handle certificate issues
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
RUN npm config set strict-ssl false && \
    npm config set registry https://registry.npmjs.org/ && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000

# Copy package files first for better caching
COPY client/package.json client/package-lock.json* ./

# Install dependencies - handle potential lock file issues
RUN if [ -f package-lock.json ]; then \
        npm ci --legacy-peer-deps || npm install --legacy-peer-deps; \
    else \
        npm install --legacy-peer-deps; \
    fi

# Copy source code
COPY client/ ./

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=build /app/build /usr/share/nginx/html

# Copy nginx configuration - create a default one if client/nginx.conf doesn't exist
RUN echo 'server {\
    listen 80;\
    server_name localhost;\
    location / {\
        root /usr/share/nginx/html;\
        index index.html index.htm;\
        try_files $uri $uri/ /index.html;\
    }\
    location /api {\
        proxy_pass http://server:3001;\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
    }\
}' > /etc/nginx/conf.d/default.conf

# If you have a custom nginx.conf, uncomment the next line and comment out the RUN echo command above
# COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]