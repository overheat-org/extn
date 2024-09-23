#!/usr/bin/sh

mode="development"

if [ "$1" ]; then
    mode="$1"
fi

./node_modules/.bin/babel -f ./src/index
./node_modules/.bin/rsbuild build -c ./rsbuild.main.ts -m "$mode"