#!/usr/bin/env bash
QUERY="Component|React\.Component"
SEARCH_PATH="src"
TEST="$(grep -lr -E "extends $QUERY" $SEARCH_PATH | xargs grep -L -E "\@observer")"
if [[ $TEST ]]; then
    echo "$TEST"
    echo "Found components without @observer decorator"
    exit 1
else
    echo "All observer decorators are in place"
fi
