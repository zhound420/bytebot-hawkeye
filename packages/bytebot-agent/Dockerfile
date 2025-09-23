# Base image
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Copy app source
COPY ./packages ./packages
COPY ./config/universal-coordinates.yaml ./config/universal-coordinates.yaml

WORKDIR /app/packages/bytebot-agent

# Install dependencies
RUN npm install


RUN npm run build

# Run the application
CMD ["npm", "run", "start:prod"] 


