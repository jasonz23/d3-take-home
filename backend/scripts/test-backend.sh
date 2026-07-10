#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_DIR="$BACKEND_DIR/AlertTriage.Api.Tests"

if [[ -d "/opt/homebrew/opt/dotnet@8/libexec" ]]; then
  export DOTNET_ROOT="/opt/homebrew/opt/dotnet@8/libexec"
  export PATH="/opt/homebrew/opt/dotnet@8/bin:$HOME/.dotnet/tools:$PATH"
else
  export PATH="$HOME/.dotnet/tools:$PATH"
fi

cd "$TEST_DIR"
dotnet test
