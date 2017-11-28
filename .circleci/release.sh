# this script is supposed to run from ci only
set -e

branch="$(git rev-parse --abbrev-ref HEAD)"
git config user.email "anri82@gmail.com"
git config user.name "Anri Asaturov"
echo branch $branch
echo "releasing from $branch"
./node_modules/.bin/standard-version -a -m "chore(release): $branch %s [skip ci]"
git push --follow-tags origin $branch
VERSION="$(node ./.circleci/get-package-version.js)"
./.circleci/ok.sh create_release PeerioTechnologies peerio-icebear v$VERSION

