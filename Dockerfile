FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .

CMD ["npx", "ts-node-dev", "--respawn", "--transpile-only", "--inspect=0.0.0.0:9230", "src/server.ts"]
