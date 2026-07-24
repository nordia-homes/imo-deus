FROM mcr.microsoft.com/playwright:v1.59.1-noble

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY server.mjs ./

ENV NODE_ENV=production

CMD ["node", "server.mjs"]
