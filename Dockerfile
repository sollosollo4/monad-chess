FROM node:20-slim

RUN apt-get update && apt-get install -y \
    git build-essential cmake wget unzip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /tmp
RUN git clone https://github.com/official-stockfish/Stockfish.git
WORKDIR /tmp/Stockfish/src
RUN make build ARCH=x86-64

RUN mv stockfish /usr/local/bin/stockfish
RUN /usr/local/bin/stockfish --version

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 6455

CMD ["npx", "ts-node-dev", "--respawn", "--transpile-only", "--inspect=0.0.0.0:9230", "src/server.ts"]