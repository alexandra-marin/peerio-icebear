set -x
mkdir -p ./test-results/e2e

if [ $CI ]
then
    tags='not @wip and not @long'
else
    tags='not @wip'
fi
node --expose-gc ./node_modules/.bin/cucumber-js test/e2e/spec \
        -r test/e2e/code \
        --require-module babel-register \
        --format node_modules/cucumber-pretty \
        --format usage:./test-results/e2e/usage.txt \
        --format json:./test-results/e2e/result.json \
        --tags "$tags"
