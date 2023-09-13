FROM node:20-alpine3.17 as build
WORKDIR /home/node/app
COPY client/package.json client/package-lock.json ./
RUN npm install
COPY client/. .
RUN echo 'REACT_APP_API_BASE_URL="http://localhost:8080/"' > .env
RUN npx update-browserslist-db@latest
RUN npm run build

FROM nginx:latest as host
COPY --from=build /home/node/app/build /usr/share/nginx/html
