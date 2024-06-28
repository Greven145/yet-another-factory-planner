FROM node:21-alpine3.17 as build
WORKDIR /home/node/app
COPY client/package.json client/package-lock.json ./
RUN npm install
RUN npx update-browserslist-db@latest
COPY client/. .
RUN echo 'REACT_APP_API_BASE_URL="http://localhost:8080/"' > .env
RUN echo 'PUBLIC_URL="http://localhost"' >> .env
RUN npm run build

FROM nginx:latest as host
COPY --from=build /home/node/app/build /usr/share/nginx/html
