# Base image
FROM node:20-alpine

# Create app directory
WORKDIR /app

COPY ./shared ./shared

WORKDIR /app/bytebot-ui

# Copy app source
COPY ./bytebot-ui/ .

# Install dependencies
RUN npm install

RUN npm run build

# Run the application
CMD ["npm", "run", "start"] 


