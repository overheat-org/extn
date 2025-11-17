#!/usr/bin/sh

./scripts/build.sh

cd packages
PACKAGES=$(ls)

for dir in $PACKAGES; do
	cd $dir
	pnpm publish
	cd ..
done