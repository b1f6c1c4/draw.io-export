#!/bin/sh

set -e

/usr/bin/find /files -type f -name '*.xml' -exec ./convert.sh '{}' "$@" \;
