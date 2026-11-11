# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
# Puppeteer is a dev dependency used only for local screenshots; skip its Chrome download.
ENV PUPPETEER_SKIP_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- serve ----
FROM nginx:1.27-alpine
# host:port of the gateway; nginx proxies /api/* -> http://$GATEWAY_UPSTREAM/*
ENV GATEWAY_UPSTREAM=gateway:8080
# The official image runs envsubst over /etc/nginx/templates/*.template at startup.
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -qO- http://127.0.0.1/healthz || exit 1
