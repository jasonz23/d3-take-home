#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
API_DIR="$BACKEND_DIR/AlertTriage.Api"
API_URL="${ASPNETCORE_URLS:-http://localhost:8182}"

if [[ -d "/opt/homebrew/opt/dotnet@8/libexec" ]]; then
  export DOTNET_ROOT="/opt/homebrew/opt/dotnet@8/libexec"
  export PATH="/opt/homebrew/opt/dotnet@8/bin:$HOME/.dotnet/tools:$PATH"
else
  export PATH="$HOME/.dotnet/tools:$PATH"
fi

cd "$API_DIR"
dotnet run --urls "$API_URL"
