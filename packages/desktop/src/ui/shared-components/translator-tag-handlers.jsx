const React = require('react');

function a(text, url) {
    return (
        <a key={url} href={url}>
            {text}
        </a>
    );
}

function b(text) {
    return <strong>{text}</strong>;
}

function i(text) {
    return <i>{text}</i>;
}

function br() {
    return <br />;
}

module.exports = {
    a,
    b,
    i,
    br
};
