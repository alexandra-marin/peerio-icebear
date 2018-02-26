const { convertBuffers, formatBytes, tryToGet } = require('~/util');

describe('Utils', () => {
    it('convertBuffers', () => {
        const input = { prop: new ArrayBuffer(10) };

        const expected = { prop: new Uint8Array(10) };
        const actual = convertBuffers(input);

        actual.should.deep.equal(expected);
    });

    it('formatBytes', () => {
        formatBytes(1024).should.equal('1 KB');
        formatBytes(1500).should.equal('1.46 KB');
        formatBytes(1048576).should.equal('1 MB');
        formatBytes(1500000).should.equal('1.43 MB');
        formatBytes(1073741824).should.equal('1 GB');
        formatBytes(3873741824).should.equal('3.61 GB');
    });

    it('tryToGet', () => {
        tryToGet(() => 'peerio', 'icebear').should.equal('peerio');
        tryToGet('peerio', 'icebear').should.equal('icebear');
    });
});
