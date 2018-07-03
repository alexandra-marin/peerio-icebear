module.exports = async function measure(name, fn) {
    console.time(name);
    await fn();
    console.timeEnd(name);
};
