# Base image
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Copy app source
COPY ./packages/shared ./shared
COPY ./packages/bytebot-agent/ ./bytebot-agent/
COPY ./config/universal-coordinates.yaml ./config/universal-coordinates.yaml

WORKDIR /app/bytebot-agent

# Install dependencies
RUN npm install


RUN npm run build

# Run the application
CMD ["npm", "run", "start:prod"] 


