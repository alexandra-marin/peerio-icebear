node --expose-gc ./node_modules/.bin/cucumber.js test/e2e/spec \
        -r test/e2e/code \
        --compiler js:babel-register \
        --format node_modules/cucumber-pretty \
        --tags '@wip'
