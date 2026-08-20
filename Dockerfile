FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/server/dist ./server/dist
EXPOSE 3001
CMD ["node", "server/dist/index.js"]
