FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production MODEL_PROVIDER=openai RELAY_DIR=/data DEMO_PORT=4321 RELAY_HEALTH_FILE=/tmp/ranrao-relay-heartbeat
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && mkdir -p /data && chown node:node /data
COPY server ./server
COPY shared ./shared
COPY web-host ./web-host
USER node
CMD ["node", "web-host/relay.mjs"]
