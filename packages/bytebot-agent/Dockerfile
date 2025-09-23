# syntax=docker/dockerfile:1

FROM node:20-alpine AS base

WORKDIR /app

COPY ./packages ./packages
COPY ./config/universal-coordinates.yaml ./config/universal-coordinates.yaml

WORKDIR /app/packages/bytebot-agent

RUN npm install

RUN npm run build

RUN npm prune --omit=dev

CMD ["sh", "-c", "npm run prisma:prod && node dist/main.js"]


