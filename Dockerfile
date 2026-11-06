# Build the React app, then run the Node server that serves both the API and the built site.
FROM node:22-alpine AS client
WORKDIR /app/client
COPY client/package.json ./
RUN npm install
COPY client/ ./
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production PORT=4000 DB_PATH=/data/seedsure.db TRUST_PROXY=1
WORKDIR /app
COPY server/ ./server/
COPY --from=client /app/client/dist ./client/dist
VOLUME /data
EXPOSE 4000
USER node
CMD ["node", "--disable-warning=ExperimentalWarning", "server/src/index.js"]
