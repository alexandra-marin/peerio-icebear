# How to verify file hashes and signatures

Peerio updater manifest (`manifest.txt` published in our GitHub releases)
contains a signed list of SHA-512 hashes for the binaries we distribute. You
can verify manifest signature and hashes to cryptographically ensure that the
files you downloaded are published by us.

You can use OpenBSD [signify](https://man.openbsd.org/signify) utility
(`apt-get install signify-openbsd` on [Ubuntu](https://packages.ubuntu.com/yakkety/signify-openbsd),
[Debian](https://packages.debian.org/stretch/signify-openbsd), `brew install signify-osx` on
[macOS](https://github.com/jpouellet/signify-osx)) or [minisign](https://jedisct1.github.io/minisign/) to verify signature. The
manifest is signed for one of the following public keys:

* [peerio_signify1.pub](https://www.peerio.com/peerio-static-assets/peerio_signify1.pub)
* [peerio_signify2.pub](https://www.peerio.com/peerio-static-assets/peerio_signify2.pub)

You can download `manifest.txt` for the binary from the corresponding [GitHub release](https://github.com/peeriotechnologies/peerio-desktop/releases).

The following shell command will first verify manifest signature with
*signify*, and then, if it's correct, verify SHA-512 hash of the file. If
verification with one public key fails, try another by adjusting `pubkey`
variable. `os` should be set to `linux-x64` for Linux, `mac` for macOS, or
`win` for Windows.

```
( pubkey=peerio_signify1.pub; \
  manifest=manifest.txt; \
  os=linux-x64; \
  cmd=$(which signify-openbsd || which signify || echo signify not found); \
  $cmd -Vep $pubkey -x $manifest -m - > /dev/null && \
  file=$(awk -F: -F/ "/$os-file/{print \$NF}" $manifest) && \
  hash=$(awk "/$os-sha512/{print \$2}" $manifest) && \
  [ "$hash" = "$(openssl dgst -sha512 $file | awk '{print $2}')" ] && \
  echo OK || echo Failed )
```
