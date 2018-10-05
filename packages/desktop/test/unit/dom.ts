import { getAttributeInParentChain } from '../../src/helpers/dom';

const mockRootElement: any = {
    attributes: { 'data-id': true },
    getAttribute(name) {
        return this.attributes[name];
    },
    parentElement: null
};

const mockChildElement: any = {
    attributes: { 'child-data-id': true },
    getAttribute(name) {
        return this.attributes[name];
    },
    parentElement: mockRootElement
};

describe('dom helper: getAttributeInParentChain', () => {
    it('should handle undefined element', () => {
        const expected = null;

        const actual1 = getAttributeInParentChain(undefined, 'does not matter');
        expect(actual1).toEqual(expected);

        const actual2 = getAttributeInParentChain(null, 'does not matter');
        expect(actual2).toEqual(expected);
    });
    it('should fail to find attribute if it is not there', () => {
        const expected = null;
        const actual = getAttributeInParentChain(
            mockChildElement,
            'i do not exist'
        );
        expect(actual).toEqual(expected);
    });
    it('should find attribute in a tree', () => {
        const expected = true;

        const actual1 = getAttributeInParentChain(mockRootElement, 'data-id');
        expect(actual1).toEqual(expected);

        const actual2 = getAttributeInParentChain(mockChildElement, 'data-id');
        expect(actual2).toEqual(expected);

        const actual3 = getAttributeInParentChain(
            mockChildElement,
            'child-data-id'
        );
        expect(actual3).toEqual(expected);
    });
});
