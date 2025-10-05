#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ -f "${PROJECT_ROOT}/.env" ]]; then
	source "${PROJECT_ROOT}/.env"
fi

MONGO_DB="${MONGODB_DB:-po-scanner}"

mongosh --quiet --eval "db.getSiblingDB(\"${MONGO_DB}\").purchase_orders.find({}, { rawText: 0 }).sort({ createdAt: -1 }).toArray()"
