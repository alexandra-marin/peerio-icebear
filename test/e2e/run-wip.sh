SHOW_APP_LOGS=1
node --expose-gc ./node_modules/.bin/cucumber-js test/e2e/spec \
        -r test/e2e/code \
        --require-module babel-register \
        --format node_modules/cucumber-pretty \
        --tags '@wip'
