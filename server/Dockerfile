FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV XRPL_NETWORK=mainnet
ENV XRPL_RPC_URL=wss://s1.ripple.com/
ENV XRPL_RPC_FALLBACK_URLS=wss://s2.ripple.com/,wss://xrplcluster.com/
ENV XRPL_CLIENT_ENABLED=true
ENV REQUIRE_EXPLICIT_MAINNET_ENABLE=true
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
USER app
EXPOSE 8080
ENV HOST=0.0.0.0
CMD ["node", "dist/index.js"]

