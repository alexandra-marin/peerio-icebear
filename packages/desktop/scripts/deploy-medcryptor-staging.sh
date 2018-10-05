#!/usr/bin/env bash

set -e

if [ -z "$1" ]; then
    echo "*** Please specify branch name to release Medcryptor Staging build from it."
    exit 1
fi

read -p "Confirm releasing MedCryptor STAGING build from $1 branch? (y/n)" choice
case "$choice" in
  y|Y ) echo "yes";;
  n|N ) exit;;
  * ) exit;;
esac

export NODE_ENV=production

echo "Building and publishing staging"
peerio-desktop-release --key ~/.peerio-updater/secret.key \
                       --shared ~/Win \
                       --repository PeerioTechnologies/peerio-desktop \
                       --overrides PeerioTechnologies/medcryptor-desktop,PeerioTechnologies/medcryptor-desktop-staging \
                       --tag $1 \
                       --versioning medcryptorstaging \
                       --publish
