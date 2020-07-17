#!/bin/sh

printf "Converting %s to %s\n" "$1" "$1.pdf"
rm -f "$1.pdf"
node ./bin/drawio.js "$1" -o "$1.pdf"

printf "Converting %s to %s\n" "$1" "$1.png"
rm -f "$1.png"
node ./bin/drawio.js "$1" -o "$1.png"
