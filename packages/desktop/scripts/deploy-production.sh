#!/usr/bin/env bash
read -p "Confirm releasing PRODUCTION build from MASTER branch? (y/n)" choice
case "$choice" in
  y|Y ) echo "yes";;
  n|N ) exit;;
  * ) exit;;
esac

# Check if there are uncommited changes
if ! git diff-index --quiet HEAD --; then
    git status
    echo "*** There are uncommited changes, please commit or stash them"
    exit 1
fi

# this is important for locales, we need to pull latest en.json
npm install

#echo "[•              ] getting locales"
#./scripts/get-locales.sh
#if git diff-index HEAD --; then
#    echo "*** Locales changed, committing."
#    git commit -a -m "chore: update locales"
#fi

echo "[•••            ] setting flags"

set -e
export NODE_ENV=production

echo "[••••••••       ] tagging release"
./node_modules/.bin/standard-version
git push && git push --follow-tags origin master

if [[ $1 = "mandatory" ]]; then
  node ./scripts/update_mandatory_version
else
  echo "Optional update"
fi

echo "[•••••••••••••••] building and publishing"
echo '**'
echo '** NOTE: on Windows, run: peerio-desktop-signer --shared Y:\ --certificate "certificate subject name"'
echo '**'
./node_modules/.bin/peerio-desktop-release --key ~/.peerio-updater/secret.key \
                       --shared ~/Win \
                       --repository PeerioTechnologies/peerio-desktop \
                       --publish
