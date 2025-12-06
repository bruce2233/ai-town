FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=development
EXPOSE 8081

CMD ["npm", "run", "dev"]
