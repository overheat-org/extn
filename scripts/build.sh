#!/usr/bin/sh

cd packages
PACKAGES=$(ls)

for dir in $PACKAGES; do
	cd $dir
	pnpm build
	cd ..
done