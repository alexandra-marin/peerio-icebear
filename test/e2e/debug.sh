#!/bin/bash

export PEERIO_REDUCE_SCRYPT_FOR_TESTS=1
export DEFAULT_TIMEOUT=-1
node  --expose-gc --inspect-brk=9229 ./node_modules/cucumber/bin/cucumber-js test/e2e/spec \
                            -r test/e2e/code \
                            --require-module "@babel/register" \
                            --tags '@debug' \
                            --exit
