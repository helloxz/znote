#!/bin/sh
set -e

BASE_DIR=$(pwd)

mkdir -p "$BASE_DIR/public/static/assets"

cd "$BASE_DIR/frontend"
bun run build
cd "$BASE_DIR"

rm -rf "$BASE_DIR/public/static/assets"/*
cp -ar "$BASE_DIR/frontend/dist/static/assets"/* "$BASE_DIR/public/static/assets/"

bun run output
