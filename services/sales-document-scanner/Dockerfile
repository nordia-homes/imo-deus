FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates clamav clamav-daemon clamav-freshclam tini \
  && freshclam \
  && rm -rf /var/lib/apt/lists/* /var/log/clamav/*

WORKDIR /app
COPY --chown=clamav:clamav package.json server.mjs clamd-client.mjs entrypoint.sh ./
COPY clamd.conf /etc/clamav/clamd.conf
COPY freshclam.conf /etc/clamav/freshclam.conf
RUN chmod 0555 /app/entrypoint.sh \
  && chown -R clamav:clamav /var/lib/clamav /app \
  && chmod 0644 /etc/clamav/clamd.conf /etc/clamav/freshclam.conf

ENV NODE_ENV=production
ENV PORT=8080
ENV MAX_REQUEST_BYTES=18874368
ENV CLAMD_HOST=127.0.0.1
ENV CLAMD_PORT=3310
ENV CLAMD_TIMEOUT_MS=45000
ENV CLAMD_STARTUP_TIMEOUT_MS=180000

USER clamav
EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/app/entrypoint.sh"]

