#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$BACKEND_DIR/.." && pwd)"
API_DIR="$BACKEND_DIR/AlertTriage.Api"

if [[ -d "/opt/homebrew/opt/dotnet@8/libexec" ]]; then
  export DOTNET_ROOT="/opt/homebrew/opt/dotnet@8/libexec"
  export PATH="/opt/homebrew/opt/dotnet@8/bin:$HOME/.dotnet/tools:$PATH"
else
  export PATH="$HOME/.dotnet/tools:$PATH"
fi

cd "$REPO_ROOT"
docker compose up -d

cd "$API_DIR"
dotnet restore

if ! dotnet ef --version >/dev/null 2>&1; then
  dotnet tool install --global dotnet-ef --version 8.0.4
fi

dotnet ef database update
