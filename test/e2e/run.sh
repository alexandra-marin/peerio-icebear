mkdir -p ./test-results/e2e
node --expose-gc ./node_modules/.bin/cucumber.js test/e2e/spec \
        -r test/e2e/code \
        --compiler js:babel-register \
        --format node_modules/cucumber-pretty \
        --format usage:./test-results/e2e/usage.txt \
        --format json:./test-results/e2e/result.json \
        --tags 'not @wip'
