import { t as t_internal } from 'peerio-translator'; // eslint-disable-line camelcase

import { LocalizationStrings } from './defs';

type ParamsType<T> = T extends (...args: infer U) => any ? U : never;

export function t<K extends keyof LocalizationStrings>(
    id: K,
    ...params: ParamsType<LocalizationStrings[K]>
): ReturnType<LocalizationStrings[K]> {
    return t_internal(id, ...params) as ReturnType<LocalizationStrings[K]>;
}
