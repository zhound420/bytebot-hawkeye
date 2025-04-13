# Base image
FROM node:20-alpine AS production

# Set node environment
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Create app directory
WORKDIR /app

COPY ./shared ./shared

# Copy application dependency manifests
COPY ./bytebot-agent/package*.json ./bytebot-agent/

WORKDIR /app/bytebot-agent

# Install dependencies
RUN npm ci

# Copy app source
COPY ./bytebot-agent/ .

RUN npm run build

# Run the application
CMD ["npm", "run", "start:prod"] 


