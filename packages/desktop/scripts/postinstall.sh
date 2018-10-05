#!/bin/bash

electron-builder install-app-deps

node ./scripts/store_package_json_hash.js

# opt --in link-sdk --exec "cd app && npm link peerio-icebear && cd .."


