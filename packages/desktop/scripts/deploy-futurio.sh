#!/usr/bin/env bash

set -e

npm install

export NODE_ENV=production


echo "Building and publishing futurio"
./node_modules/.bin/peerio-desktop-release --repository PeerioTechnologies/peerio-desktop \
                       --overrides PeerioTechnologies/peerio-desktop-futurio \
                       --publish \
                       --tag dev \
                       --versioning futurio \
                       --nosign \
                       --key ../peerio-desktop-futurio/signing.key
