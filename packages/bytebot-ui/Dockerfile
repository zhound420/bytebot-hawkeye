# Base image
FROM node:20-alpine

# Declare build arguments
ARG BYTEBOT_AGENT_BASE_URL
ARG BYTEBOT_DESKTOP_VNC_URL

# Set environment variables for the build process
ENV BYTEBOT_AGENT_BASE_URL=${BYTEBOT_AGENT_BASE_URL}
ENV BYTEBOT_DESKTOP_VNC_URL=${BYTEBOT_DESKTOP_VNC_URL}

# Create app directory
WORKDIR /app

# Copy app source
COPY packages/shared ./packages/shared
COPY packages/bytebot-ui/ ./packages/bytebot-ui
COPY config/universal-coordinates.yaml ./config/universal-coordinates.yaml

WORKDIR /app/packages/bytebot-ui

# Install dependencies
RUN npm install

RUN npm run build

# Run the application
CMD ["npm", "run", "start"] 


