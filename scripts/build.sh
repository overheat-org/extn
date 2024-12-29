#!/usr/bin/sh

export PATH=$PATH:./node_modules/.bin

tsc --project tsconfig.lib.json
webpack
find "./lib" -name "*.d.ts" -exec cp {} "./types" \;