/**
 * Component
 *
 * Usage:
 *
 * in translations file:
 * "key":"some text <link>bla</> and a var {count}
 *
 * in React component:
 *
 * <T k="key">
 *      {{ count: 5, link: text=> <a>{text}</a>}}
 * </T>
 */
const React = require('react');
const { t } = require('peerio-translator');

function T(props) {
    const tag = props.tag || 'span';
    const properties = { className: props.className, style: props.style };
    const translation = t(props.k, props.children);

    if (typeof translation === 'string') {
        return React.createElement(tag, properties, translation);
    }

    return React.createElement(tag, properties, ...translation);
}

module.exports = T;
