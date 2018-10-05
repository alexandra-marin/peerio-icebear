#!/bin/sh

set -e

BASE_DIR=$(dirname "$0")

# Mac
iconutil --convert icns --output $BASE_DIR/../dist-assets/icon.icns $BASE_DIR/icon.iconset
iconutil --convert icns --output $BASE_DIR/../dist-assets/dmg-icon.icns $BASE_DIR/dmg-icon.iconset

# Windows
convert \
    $BASE_DIR/win-icon/icon_256x256.png \
    $BASE_DIR/win-icon/icon_64x64.png \
    $BASE_DIR/win-icon/icon_48x48.png \
    $BASE_DIR/win-icon/icon_32x32.png \
    $BASE_DIR/win-icon/icon_16x16.png \
    $BASE_DIR/../dist-assets/icon.ico

convert \
    $BASE_DIR/win-installer/icon_256x256.png \
    $BASE_DIR/win-installer/icon_64x64.png \
    $BASE_DIR/win-installer/icon_48x48.png \
    $BASE_DIR/win-installer/icon_32x32.png \
    $BASE_DIR/win-installer/icon_16x16.png \
    $BASE_DIR/../dist-assets/win-installer.ico

# Linux window icon
cp $BASE_DIR/icon.iconset/icon_512x512@2x.png $BASE_DIR/../src/static/img/icon.png

# Linux app icons
LINUX_DIR=$BASE_DIR/../dist-assets/linux-icon
mkdir $BASE_DIR/../dist-assets/linux-icon || true
cp $BASE_DIR/icon.iconset/icon_16x16.png $LINUX_DIR/16x16.png
cp $BASE_DIR/icon.iconset/icon_32x32.png $LINUX_DIR/32x32.png
cp $BASE_DIR/icon.iconset/icon_32x32@2x.png $LINUX_DIR/64x64.png
cp $BASE_DIR/icon.iconset/icon_128x128.png $LINUX_DIR/128x128.png
cp $BASE_DIR/icon.iconset/icon_256x256.png $LINUX_DIR/256x256.png
cp $BASE_DIR/icon.iconset/icon_512x512.png $LINUX_DIR/512x512.png

# Some other icon
cp $BASE_DIR/icon.iconset/icon_512x512@2x.png $BASE_DIR/../dist-assets/icon.png
