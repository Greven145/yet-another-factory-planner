# NOTE: This Dockerfile is preserved for reference only.
# It is NOT the active deployment path. The canonical dev and deployment path is
# the .NET Aspire AppHost (YetAnotherFactoryPlanner.AppHost).

FROM node:20-alpine3.17 as build
WORKDIR /home/node/app
COPY client/package.json client/package-lock.json ./
RUN npm install --legacy-peer-deps
RUN npx update-browserslist-db@latest
COPY client/. .
RUN echo 'VITE_API_BASE_URL="http://localhost:8080/"' > .env
RUN echo 'PUBLIC_URL="http://localhost"' >> .env
RUN npm run build

FROM nginx:1.27-alpine as host
COPY --from=build /home/node/app/dist /usr/share/nginx/html
