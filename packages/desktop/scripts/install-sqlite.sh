#!/usr/bin/env bash

export LDFLAGS="-L`brew --prefix`/opt/sqlcipher/lib"
export CPPFLAGS="-I`brew --prefix`/opt/sqlcipher/include"
npm install sqlite3 -S --build-from-source --sqlite_libname=sqlcipher --sqlite=`brew --prefix`

pushd node_modules/sqlite3
node-gyp configure --module_name=node_sqlite3 --sqlite_libname=sqlcipher --sqlite=`brew --prefix` --module_path=../lib/binding/electron-v1.4-darwin-x64
popd

pushd node_modules/sqlite3
node-gyp rebuild --target=1.4.3 --arch=x64 --target_platform=darwin --sqlite_libname=sqlcipher --sqlite=`brew --prefix` --dist-url=https://atom.io/download/atom-shell --module_name=node_sqlite3 --module_path=../lib/binding/electron-v1.4-darwin-x64
popd
