FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates clamav clamav-freshclam tini \
  && freshclam \
  && rm -rf /var/lib/apt/lists/* /var/log/clamav/*

WORKDIR /app
COPY --chown=node:node package.json server.mjs ./

ENV NODE_ENV=production
ENV PORT=8080
ENV MAX_REQUEST_BYTES=18874368
ENV SCAN_TIMEOUT_MS=25000

USER node
EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.mjs"]

