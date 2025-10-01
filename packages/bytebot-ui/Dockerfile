# Base image
FROM public.ecr.aws/docker/library/node:20-alpine

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

# Configure npm for better reliability
RUN npm config set registry https://registry.npmjs.org/ && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-factor 2 && \
    npm config set fetch-retry-mintimeout 10000 && \
    npm config set fetch-retry-maxtimeout 60000 && \
    npm config set timeout 300000

# Install dependencies with retry logic
RUN npm install --no-optional --prefer-offline || \
    (sleep 10 && npm install --no-optional --prefer-offline) || \
    (sleep 30 && npm install --no-optional)

RUN npm run build

# Run the application
CMD ["npm", "run", "start"] 


