#!/bin/bash
# DISHA 20-20 Firestore Quota Sentinel Launcher
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"
mkdir -p logs
PID=$(pgrep -f "scripts/sync_firestore_to_snapshot.ts")
if [ -n "$PID" ]; then
  echo "Sentinel is already running with PID: $PID"
else
  nohup pnpm exec tsx scripts/sync_firestore_to_snapshot.ts > logs/quota_sentinel.log 2>&1 &
  echo "DISHA Quota Sentinel started in background (PID: $!)."
  echo "It will monitor Firestore and auto-sync at 1:30 PM IST."
fi
echo "View live log: tail -f logs/quota_sentinel.log"
