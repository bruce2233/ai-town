FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Environment variables will be provided by docker-compose
ENV NODE_ENV=development

CMD ["npm", "start"]
