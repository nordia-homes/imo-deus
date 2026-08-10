#!/bin/sh
set -eu

clamd --config-file=/etc/clamav/clamd.conf &
clamd_pid=$!

freshclam --daemon --foreground=true --config-file=/etc/clamav/freshclam.conf &
freshclam_pid=$!

node server.mjs &
server_pid=$!

shutdown() {
  kill -TERM "$server_pid" "$clamd_pid" "$freshclam_pid" 2>/dev/null || true
  wait "$server_pid" "$clamd_pid" "$freshclam_pid" 2>/dev/null || true
}

trap shutdown INT TERM EXIT

while kill -0 "$server_pid" 2>/dev/null && kill -0 "$clamd_pid" 2>/dev/null; do
  sleep 2
done

if ! kill -0 "$server_pid" 2>/dev/null; then
  wait "$server_pid" || status=$?
else
  wait "$clamd_pid" || status=$?
fi

exit "${status:-1}"
