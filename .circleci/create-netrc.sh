#!/bin/bash

cat > ~/.netrc << EOF
machine api.github.com
    login $GH_USER
    password $GH_TOKEN
machine uploads.github.com
    login $GH_USER
    password $GH_TOKEN
EOF
