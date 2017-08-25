// https://github.com/olympicsoftware/scrollbar-size/blob/master/scrollbar-size.js
export function getScrollbarSize(window) {
    if (window.scrollbarSize) {
        return window.scrollbarSize;
    }

    const div1 = window.document.createElement('div');
    const div2 = window.document.createElement('div');

    div1.style.width = '100px';
    div1.style.overflowX = 'scroll';
    div2.style.width = '100px';

    window.document.body.appendChild(div1);
    window.document.body.appendChild(div2);

    window.scrollbarSize = div1.offsetHeight - div2.offsetHeight;

    window.document.body.removeChild(div1);
    window.document.body.removeChild(div2);

    return window.scrollbarSize;
}

const ELEMENT_NODE = 1;
export function getOffsetToPage(node) {
    node = node.nodeType === ELEMENT_NODE ? node : node.parentElement;
    if (!node) {
        return null;
    }

    const win = node.ownerDocument.defaultView;
    const source = node;
    const offset = {x: source.offsetLeft, y: source.offsetTop};
    // https://www.kirupa.com/html5/get_element_position_using_javascript.htm
    while ((node = node.offsetParent)) {
        if (node.tagName === 'BODY') {
            // deal with browser quirks with body/window/document and page scroll
            const scrollLeft = node.scrollLeft || win.document.documentElement.scrollLeft;
            const scrollTop = node.scrollTop || win.document.documentElement.scrollTop;

            offset.x += node.offsetLeft - scrollLeft + node.clientLeft;
            offset.y += node.offsetTop - scrollTop + node.clientTop;
        } else {
            // for all other non-BODY elements
            offset.x += node.offsetLeft - node.scrollLeft + node.clientLeft;
            offset.y += node.offsetTop - node.scrollTop + node.clientTop;
        }
    }

    return offset;
}

function getStyle(node, name, numeric) {
    const win = node.ownerDocument.defaultView;
    const value = win.getComputedStyle(node)[name];

    return numeric ? win.parseFloat(value) : value;
}

export function getPaddingSize(node) {
    return {
        top: getStyle(node, 'paddingTop', true),
        bottom: getStyle(node, 'paddingBottom', true),
        left: getStyle(node, 'paddingLeft', true),
        right: getStyle(node, 'paddingRight', true)
    };
}

export function getBorderSize(node) {
    return {
        top: getStyle(node, 'borderTopWidth', true),
        bottom: getStyle(node, 'borderBottomWidth', true),
        left: getStyle(node, 'borderLeftWidth', true),
        right: getStyle(node, 'borderRightWidth', true)
    };
}

export function getBoxSize(node) {
    if (node) {
        var rect = node.getBoundingClientRect();

        return {
            width: rect.width,
            height: rect.height
        };
    } else {
        return {
            width: 0,
            height: 0
        };
    }
}

export function getBoxInnerSize(node, excludePadding) {
    var rect = getBoxSize(node);
    var border = getBorderSize(node);
    var padding = excludePadding ? getPaddingSize(node) : {left: 0, right: 0, top: 0, bottom: 0};

    return {
        width: rect.width - border.left - border.right - padding.left - padding.right,
        height: rect.height - border.top - border.bottom - padding.top - padding.bottom
    };
}

export function scroll(window, x, y) {
    (window.scroll || window.scrollTo)(x, y);
}
