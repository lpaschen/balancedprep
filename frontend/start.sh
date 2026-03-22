#!/bin/bash
export PATH="/opt/homebrew/bin:$PATH"
export PORT=3010
cd "$(dirname "$0")"
npm start
