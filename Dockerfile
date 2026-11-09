FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY server/package.json server/package-lock.json ./server/
RUN npm ci --prefix server --no-audit --no-fund

FROM dependencies AS development
COPY . .
