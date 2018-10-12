import { observable, IObservableArray, ObservableMap } from 'mobx';

/**
 * Creates a map object that will be dynamically updated when items are added or removed to the passed array.
 * Doesn't watch for map key property change.
 * @param array - array to create map for
 * @param keyProp - property of the items in the array that will be used as key for the map
 * @returns map object
 */
export default function createMap<TKey, TVal>(
    array: IObservableArray<TVal>,
    keyProp: string
): { map: { [key: string]: TVal }; observableMap: ObservableMap<TKey, TVal> } {
    const map = {};
    const observableMap = observable.map<TKey, TVal>();

    array.intercept(delta => {
        if (delta.type === 'splice') {
            for (let i = delta.removedCount; i > 0; i--) {
                const el = delta.object[delta.index + i - 1];
                delete map[el[keyProp]];
                observableMap.delete(el[keyProp]);
            }

            delta.added.forEach(el => {
                map[el[keyProp]] = el;
                observableMap.set(el[keyProp], el);
            });
        }
        return delta;
    });

    array.forEach(el => {
        map[el[keyProp]] = el;
        observableMap.set(el[keyProp], el);
    });

    return { map, observableMap };
}
