FROM mcr.microsoft.com/playwright:v1.59.1-noble

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund

COPY server.mjs ./

ENV NODE_ENV=production
ENV FACEBOOK_PROFILE_ROOT=/data/profiles
ENV FACEBOOK_RUNNER_STATE_PATH=/data/state/runner-state.json

VOLUME ["/data"]

CMD ["xvfb-run", "-a", "node", "server.mjs"]
