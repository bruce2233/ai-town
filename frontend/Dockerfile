FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=development
EXPOSE 5173

# Vite needs --host to be accessible from outside the container
CMD ["npx", "vite", "--host"]
