#!/usr/bin/sh

cd test
node --inspect=0.0.0.0:9229 ../dist/main.js . --hot
cd ..
