#!/bin/bash

set -x
mkdir -p ./test-results/e2e

export PEERIO_REDUCE_SCRYPT_FOR_TESTS=1
export SHOW_APP_LOGS=0

if [ $CI ]
then
    tags='not @wip and not @long and not @off'
    export DEFAULT_TIMEOUT=300000
else
    tags='not @wip and not @off'
    export DEFAULT_TIMEOUT=180000
fi

if [ $1 ]
then
    scenarios=("`${BASH_SOURCE%/*}/split.js $1 $2`")
else
    scenarios=test/e2e/spec
fi

node --expose-gc ./node_modules/.bin/cucumber-js $scenarios \
        -r test/e2e/code \
        --require-module "@babel/register" \
        --format node_modules/cucumber-pretty \
        --format usage:./test-results/e2e/usage.txt \
        --format json:./test-results/e2e/result.json \
        --tags "$tags" \
        --exit
