/*
 * - [ ] 在context页面的iframe中载入待测试页面
 *   - [ ] 在启动时向express注入html、css等静态文件
 *   - [ ] 注入一个后端，并提供转发和静态页面处理能力
 * - [ ] 可模拟用户操作（在Headless浏览器中不显示以下效果）
 *   - [ ] 可显示鼠标轨迹：从初始位置到目标位置逐点走直线；记录最后一次的鼠标位置，下一次移动从该位置开始；渐隐轨迹
 *   - [ ] 可显示触发的按键：气泡消失效果
 * - [ ] 可获取测试页面中的DOM：支持CSS选择器
 * - [ ] 在不同标签显示测试页面
 * - [ ] 在运行环境支持的情况下可截图
 * - [ ] 可拦截测试页面中的请求，并做本地/远端转发或返回模拟数据
 */
/*
 * ```
 * Browser.mock(url, [String/Function] content);
 * Browser.forward(url, target);
 *
 * var page = Browser.load('e2e/pages/mouse.html');
 * page.window, page.document, page.query(selector),
 * page.click(selector), page.dblclick(selector), page.mousemove(selector),
 * page.focus(selector).key(key)[down/press/up]()
 * ```
 */
import defaults from 'lodash/defaults';
import isNumber from 'lodash/isNumber';
import Sizzle from 'sizzle';
import simulant from 'simulant';
import Promise from 'bluebird';

import {
    getBorderSize,
    getBoxInnerSize,
    getOffsetToPage,
    getScrollbarSize,
    scroll
} from './utils';
import config from './config';

const pageRunnerContextId = 'page_runner_context';

function prepareContext() {
    // TODO Append html fragment (contains template)
    let context = window.document.querySelector(`#${pageRunnerContextId}`);
    if (!context) {
        context = window.document.createElement('div');
        context.setAttribute('id', pageRunnerContextId);
        context.setAttribute('class', 'page-runner');
        window.document.body.appendChild(context);
    }

    return context;
}

function pathToPage(pageUrl) {
    return config.context + config.apis.page + '?path=' + encodeURIComponent(pageUrl);
}

function loadPage(pageUrl, done) {
    const context = prepareContext();
    const url = pathToPage(pageUrl);
    const iframe = window.document.createElement('iframe');

    // Enable scrollbar
    // iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('frameborder', '0');
    iframe.src = url;
    iframe.onload = function () {
        const iframeWindow = (this.contentWindow || this.contentDocument).window;
        const iframeDocument = (this.contentWindow || this.contentDocument).document;

        done && done(iframeWindow, iframeDocument);
    };

    context.appendChild(iframe);

    return function () {
        context.removeChild(iframe);
    };
}

function getPagePositionOnNode(target, offset, middleWhenNoneOffset) {
    const targetOffset = getOffsetToPage(target);
    const targetBorder = getBorderSize(target);
    const targetSize = getBoxInnerSize(target);
    const os = middleWhenNoneOffset && !offset
        ? {x: targetSize.width / 2, y: targetSize.height / 2}
        : offset || {x: 0, y: 0};

    const x = targetOffset.x + targetBorder.left + os.x;
    const y = targetOffset.y + targetBorder.top + os.y;

    return {x, y};
}

/**
 * Examples:
 * ```
 * const mouse = new Mouse(new Page());
 * mouse.goTo('#source').down().moveTo('#target').up();
 * mouse.goTo('#dom').click().dblclick();
 * mouse.goTo('#node', {x: 10, y:20});
 * mouse.goTo(100, 200).click().moveTo(300, 500).dblclick();
 * mouse.moveTo('#element', {x: 5, y: 2}, 5).click();
 * mouse.done(() => {
 *     // Do some final things
 * });
 * ```
 */
function Mouse(page) {
    this.page = page;
    // The position is relative to the whole document/page
    this.$p = Promise.resolve({pos: {x: 0, y: 0}, target: null});
}

/**
 * Note: The specified element which chosen via `selector`
 * will not be the target of mouse event when other element
 * is covering on it, the mouse event will be triggered
 * from the covering elements.
 *
 * There are two function signatures:
 * - `(x: {Number}, y: {Number}) -> Mouse`:
 *   Set mouse at point (x, y)
 * - `(selector: {String/Object}, offset: {Object}) -> Mouse`:
 *   Set mouse over on the specified element with an `offset`
 *
 * @return {Mouse} this
 */
Mouse.prototype.goTo = function (selector, offset) {
    return this._then(() => {
        let pos = {x: 0, y: 0};

        if (isNumber(arguments[0]) && isNumber(arguments[1])) {
            pos.x = arguments[0];
            pos.y = arguments[1];
        } else {
            const node = this.page.get(selector);
            pos = getPagePositionOnNode(node, offset, true);
        }

        const target = this._goTo(pos.x, pos.y);
        return {pos, target};
    });
};

/**
 * Single click the mouse
 *
 * @return {Mouse} this
 */
Mouse.prototype.click = function () {
    return this.fire('click');
};

/**
 * Double click the mouse
 *
 * @return {Mouse} this
 */
Mouse.prototype.dblclick = function () {
    return this.fire('dblclick');
};

/**
 * Press down the mouse
 *
 * @return {Mouse} this
 */
Mouse.prototype.down = function () {
    return this.fire('mousedown');
};

/**
 * Release the mouse
 *
 * @return {Mouse} this
 */
Mouse.prototype.up = function () {
    return this.fire('mouseup');
};

/**
 * Note: The specified element which chosen via `selector`
 * will not be the target of mouse event when other element
 * is covering on it, the mouse event will be triggered
 * from the covering elements.
 *
 * There are two function signatures:
 * - `(x: {Number}, y: {Number}) -> Mouse`:
 *   Move mouse to point (x, y)
 * - `(selector: {String/Object}, offset: {Object}, delayPerStep: {Number}) -> Mouse`:
 *   Move mouse to the specified element with an `offset`.
 *   If `delayPerStep` is greater than zero, the mouse will be moved animatedly
 *
 * @return {Mouse} this
 */
Mouse.prototype.moveTo = function (selector, offset, delayPerStep) {
    return this._then((payload) => {
        const prevTarget = payload.target;
        const startPoint = {...payload.pos};

        let endPoint;
        if (isNumber(arguments[0]) && isNumber(arguments[1])) {
            endPoint = {x: arguments[0], y: arguments[1]};
            delayPerStep = 0;
        } else {
            const target = this.page.get(selector);
            endPoint = getPagePositionOnNode(target, offset, true);
        }

        if (startPoint.x === endPoint.x && startPoint.y === endPoint.y) {
            return payload;
        } else if (delayPerStep <= 0) {
            const target = this._moveTo(endPoint.x, endPoint.y, prevTarget);
            return {pos: endPoint, target};
        } else {
            const hDistance = Math.abs(endPoint.x - startPoint.x);
            const xMovingStep = (endPoint.x - startPoint.x) / hDistance;
            const yMovingStep = (endPoint.y - startPoint.y) / hDistance;
            const movingTime = hDistance * delayPerStep;

            let p = Promise.resolve(payload);
            for (let timelong = 0; timelong < movingTime; timelong += delayPerStep) {
                p = p.delay(delayPerStep).then((payload) => {
                    const pos = payload.pos;
                    const x = pos.x + xMovingStep;
                    const y = pos.y + yMovingStep;

                    const target = this._moveTo(x, y, payload.target);
                    return {pos: {x, y}, target};
                });
            }
            return p;
        }
    });
};

/**
 * Fire mouse event
 *
 * @param {String} event The event name
 * @param {Boolean} [canBubble=false] Whether bubble the event or not?
 * @return {Mouse} this
 */
Mouse.prototype.fire = function (event, canBubble) {
    return this._then((payload) => {
        const target = payload.target;
        const pos = {...payload.pos};

        this._fire(target, event, pos, canBubble);

        return payload;
    });
};

/**
 * Do something after all mouse actions are finished
 *
 * @return {Mouse} this
 */
Mouse.prototype.done = function (cb) {
    cb && this._then(cb);
    this.$p = Promise.resolve({pos: {x: 0, y: 0}, target: null});
    return this;
};

/** @return {Mouse} this */
Mouse.prototype._then = function (cb) {
    this.$p = this.$p.then(cb);
    return this;
};

/** @return {Element} The target element at (x, y) */
Mouse.prototype._moveTo = function (x, y, prevTarget) {
    const currentTarget = this._goTo(x, y);
    const endPoint = {x, y};

    if (prevTarget !== currentTarget) {
        // From one element to other element
        this._fire(prevTarget, 'mouseleave', endPoint, false);
        this._fire(prevTarget, 'mouseout', endPoint, true);

        this._fire(currentTarget, 'mouseenter', endPoint, false);
        this._fire(currentTarget, 'mouseover', endPoint, true);
        this._fire(currentTarget, 'mousemove', endPoint, true);
    } else {
        this._fire(currentTarget, 'mousemove', endPoint, true);
    }
    return currentTarget;
};

/** @return {Element} The target element at (x, y) */
Mouse.prototype._goTo = function (x, y) {
    const target = this.page.getTopElementAt(x, y);

    const space = 10;
    this.page.scrollTo(x - space, y - space);

    return target;
};

/** @return {void} */
Mouse.prototype._fire = function (target, event, pos, canBubble) {
    if (event && target && pos) {
        const state = defaults({
            bubbles: canBubble !== false
        }, this._state(target, pos));

        // NOTE: Animation will be asynchronous, so calling it before firing events
        this.page.drawMouse(event, state.pageX, state.pageY);
        simulant.fire(target, event, state);
    }
};

/** @return {Object} The new state of mouse */
Mouse.prototype._state = function (target, pos) {
    // https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/button
    // - 0: Main button pressed, usually the left button or the un-initialized state
    // - 1: Auxiliary button pressed, usually the wheel button or the middle button (if present)
    // - 2: Secondary button pressed, usually the right button
    // - 3: Fourth button, typically the Browser Back button
    // - 4: Fifth button, typically the Browser Forward button
    // https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/which
    // - 0: No button
    // - 1: Left button
    // - 2: Middle button (if present)
    // - 3: Right button
    // http://stackoverflow.com/questions/9262741/what-is-the-difference-between-pagex-y-clientx-y-screenx-y-in-javascript
    const targetOffset = getOffsetToPage(target);
    const targetBorder = getBorderSize(target);
    const offsetX = pos.x - targetOffset.x - targetBorder.left;
    const offsetY = pos.y - targetOffset.y - targetBorder.top;

    const clientX = pos.x - this.page.window.scrollX;
    const clientY = pos.y - this.page.window.scrollY;
    return {
        bubbles: true,
        button: 0,
        which: 1,
        cancelable: true,
        view: this.page.window,
        clientX: clientX,
        clientY: clientY,
        offsetX: offsetX,
        offsetY: offsetY,
        pageX: pos.x,
        pageY: pos.y,
        screenX: clientX,
        screenY: clientY,
        x: clientX,
        y: clientY
    };
};

function Page() {
}

Page.prototype.getClientSize = function () {
    // https://developer.mozilla.org/en-US/docs/Web/API/Window/innerHeight
    const windowWidth = this.window.innerWidth;
    const windowHeight = this.window.innerHeight;
    const scrollbarSize = getScrollbarSize(this.window);

    return {
        width: windowWidth - scrollbarSize,
        height: windowHeight - scrollbarSize
    };
};

Page.prototype.getScreenSize = function () {
    // Assume screen size is equal to client size plus scrollbar size
    return this.getClientSize();
};

Page.prototype.getPageSize = function () {
    return {
        width: this.document.documentElement.scrollWidth,
        height: this.document.documentElement.scrollHeight
    };
};

/** @return {Mouse} The mouse which is bound to this page */
Page.prototype.getMouse = function () {
    return new Mouse(this);
};

Page.prototype.scrollTo = function (x, y) {
    scroll(this.window, x, y);
};

Page.prototype.query = function (selector) {
    return this.document ? Sizzle(selector, this.document) : [];
};

Page.prototype.get = function (selector) {
    const doms = this.query(selector);

    return doms.length > 0 ? doms[0] : null;
};

Page.prototype.getTopElementAt = function (x, y) {
    // TODO Find the top element at the point (x, y)
};

Page.prototype.drawMouse = function (action, x, y) {
    // TODO Show animation on top mask layer based on mouse action
    switch (action) {
        case 'mousedown':
            break;
        case 'mousemove':
            break;
        case 'mouseup':
            break;
        case 'click':
            break;
        case 'dblclick':
            break;
    }
};

Page.prototype.drawKey = function (action, key) {
    // TODO Popup the char which presents the specified key in the visible area, hide it when key is released. Support pressing multiple keys
    switch (action) {
        case 'keydown':
            break;
        case 'keyup':
            break;
    }
};

Page.prototype.destroy = function () {
    this._destroy && this._destroy();
    this.window = this.document = null;
};

const PageRunner = {
    load: function (url, done) {
        const page = new Page();

        page._destroy = loadPage(url, function (window, document) {
            page.window = window;
            page.document = document;

            done && done();
        });
        return page;
    }
};

export default PageRunner;
