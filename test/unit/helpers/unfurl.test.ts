import * as fs from 'fs';
import * as path from 'path';
import { parseHTML } from '../../../src/helpers/unfurl/parse';
import testData from './unfurl-data';

describe('Unfurl', () => {
    it('parseHTML', () => {
        for (const data of testData) {
            const page = fs.readFileSync(path.join(__dirname, 'unfurl-data', data.file)).toString();
            const result = parseHTML(data.url, page);
            result.should.deep.equal(data.result);
        }
    });
});
