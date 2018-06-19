#!/usr/bin/env node
const cp = require('child_process');

const resStr = cp.execSync('find ./test/e2e/spec -name "*.feature"').toString();
const resArr = resStr.split('\n').filter(i => i);
// console.log(resArr);
// console.log();
const length = resArr.length;
const part = +process.argv[2];
const maxParts = +process.argv[3];
const partLength = Math.trunc(length / maxParts);
// console.log(length, part, maxParts, partLength);
const start = (part - 1) * partLength;
let end = start + partLength;
if (length - end < partLength) end = length;
const res = resArr.slice(start, end);
console.log(res.join(' '));
