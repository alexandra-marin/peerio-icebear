#!/bin/sh

DUPS=$(awk -F'"' '{ print $2 }' src/copy/en.json | awk 'NF' | sort | uniq -d)

if [ -n "$DUPS" ]; then
	echo "Duplicate keys in copy:"
	echo "$DUPS"
	exit 1;
fi
