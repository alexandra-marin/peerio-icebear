/**
 * Looks for an attribute value in html element's parent chain.
 * Starts checks from the element itself.
 * @param element - html element
 * @param attribute - attribute name
 * @returns found attribute value or null
 */
export function getAttributeInParentChain(
    element: HTMLElement,
    attribute: string
): string | null {
    let el = element;

    while (el) {
        const ret = el.getAttribute(attribute);
        if (ret) return ret;
        el = el.parentElement;
    }
    return null;
}

/**
 * Returns html element in parent chain that has a certain class.
 * @param element - html element
 * @param attribute - attribute name
 * @returns found html element or null
 */
export function getParentWithClass(
    element: HTMLElement,
    className
): HTMLElement | null {
    let el = element;

    while (el) {
        const attr = el.classList.contains(className);
        if (attr) return el;
        el = el.parentElement;
    }
    return null;
}

/**
 * Finds all 'data-...' props of an instance of a component
 * @param props from component
 */
export function getDataProps<T extends {}>(props: T): T {
    const dataProps = {} as T;

    Object.keys(props)
        .filter(p => p.startsWith('data-'))
        .forEach(key => {
            dataProps[key] = props[key];
        });

    return dataProps;
}
