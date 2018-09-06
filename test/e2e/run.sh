#!/bin/bash
set -x
mkdir -p ./test-results/e2e

npm run test-build

export PEERIO_REDUCE_SCRYPT_FOR_TESTS=1
export SHOW_APP_LOGS=0

if [ $CI ]
then
    if [ $CIRCLE_BRANCH == 'master' ] || [ $CIRCLE_BRANCH == 'dev' ]
        tags='not @off'
    else
        tags='not @off and not @long'
    fi
    export DEFAULT_TIMEOUT=300000
else
    tags='not @wip and not @debug and not @off'
    export DEFAULT_TIMEOUT=180000
fi

node --expose-gc ./node_modules/.bin/cucumber-js test/e2e/spec \
        -r test/e2e/code \
        --format node_modules/cucumber-pretty \
        --format usage:./test-results/e2e/usage.txt \
        --format json:./test-results/e2e/result.json \
        --tags "$tags" \
        --exit
