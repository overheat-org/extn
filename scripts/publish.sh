#!/usr/bin/sh

./scripts/build.sh

cd packages/extn
pnpm publish
cd ../extn-cli
pnpm publish