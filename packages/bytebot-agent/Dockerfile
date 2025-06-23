# Base image
FROM node:20.18.2-alpine3.21

# Create app directory
WORKDIR /app

# Copy app source
COPY ./shared ./shared
COPY ./bytebot-agent/ ./bytebot-agent/

WORKDIR /app/bytebot-agent

# Install dependencies
RUN npm install


RUN npm run build

# Run the application
CMD ["npm", "run", "start:prod"] 


