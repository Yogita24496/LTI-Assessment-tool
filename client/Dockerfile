# Stage 1: Build the React app
FROM node:16-alpine as build

WORKDIR /usr/src/app

COPY client/package*.json ./
RUN npm install

COPY client/ .
RUN npm run build

# Stage 2: Serve the app using Nginx
FROM nginx:alpine

COPY --from=build /usr/src/app/build /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]