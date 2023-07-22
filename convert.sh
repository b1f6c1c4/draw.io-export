#!/bin/sh

set -ex

F="$1"
shift

if [ "$#" -eq 0 ]; then

  printf "Converting %s to %s\n" "$F" "$F.pdf"
  rm -f "$F.pdf"
  cp --attributes-only "$F" "$F.pdf"
  ./bin/drawio.js "$F" -o "$F.pdf" -F cat-pdf

  printf "Converting %s to %s\n" "$F" "$F.png"
  rm -f "$F.png"
  cp --attributes-only "$F" "$F.png"
  ./bin/drawio.js "$F" -o "$F.png" -F png

elif [[ "$1" =~ pdf$ ]]; then

  printf "Converting %s to %s\n" "$F" "$F.pdf"
  rm -f "$F.pdf"
  cp --attributes-only "$F" "$F.pdf"
  ./bin/drawio.js "$F" -o "$F.pdf" -F "$1"

elif [[ "$1" =~ png$ ]]; then

  printf "Converting %s to %s\n" "$F" "$F.png"
  rm -f "$F.png"
  cp --attributes-only "$F" "$F.png"
  ./bin/drawio.js "$F" -o "$F.png" -F "$1"

fi
