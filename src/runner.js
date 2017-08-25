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

import {
    getScrollbarSize,
    getOffsetToPage,
    getBoxInnerSize,
    getBorderSize,
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
 * const mouse = new Mouse(new Page());
 * mouse.goTo('#source').down().moveTo('#target').up();
 * mouse.goTo('#dom').click().dblclick();
 * mouse.goTo('#node', {x: 10, y:20});
 * mouse.goTo(100, 200).click().moveTo(300, 500).dblclick();
 * mouse.moveTo('#element', {x: 5, y: 2}, 5).click();
 */
function Mouse(page) {
    // The position is relative to the whole document/page
    this.x = 0;
    this.y = 0;
    this.page = page;
}

// TODO Promise interfaces

/**
 * Note: The specified element which chosen via `selector`
 * will not be the target of mouse event when other element
 * is covering on it, the mouse event will be triggered
 * from the covering elements.
 */
Mouse.prototype.goTo = function (selector, offset) {
    let pos = {x: 0, y: 0};

    if (isNumber(arguments[0]) && isNumber(arguments[1])) {
        pos.x = arguments[0];
        pos.y = arguments[1];
    } else {
        const target = this.page.get(selector);
        pos = getPagePositionOnNode(target, offset, true);
    }

    this._goTo(pos.x, pos.y);
    return this;
};

Mouse.prototype.click = function () {
    this._fire(this.currentTarget, 'click');
    return this;
};

Mouse.prototype.dblclick = function () {
    this._fire(this.currentTarget, 'dblclick');
    return this;
};

Mouse.prototype.down = function () {
    this._fire(this.currentTarget, 'mousedown');
    return this;
};

Mouse.prototype.up = function () {
    this._fire(this.currentTarget, 'mouseup');
    return this;
};

Mouse.prototype.moveTo = function (selector, offset, delayPerStep) {
    if (isNumber(arguments[0]) && isNumber(arguments[1])) {
        this._moveTo(arguments[0], arguments[1]);
        return this;
    }

    // TODO 根据鼠标位置下的节点依次触发mouseenter, mouseover, mouseout, mouseleave等事件
    // NOTE: 指定的节点不一定是事件触发点，需检查最接近鼠标的节点。
    // 如果二者为父子关系，则触发点的事件会向上冒泡给父节点；
    // 否则，目标节点不会触发mouse事件
    const target = this.page.get(selector);
    const startPoint = {x: this.x, y: this.y};
    const endPoint = getPagePositionOnNode(target, offset, true);

    if (delayPerStep <= 0) {
        this._moveTo(endPoint.x, endPoint.y);
        return this;
    }

    const hDistance = Math.abs(endPoint.x - startPoint.x);
    const xMovingStep = (endPoint.x - startPoint.x) / hDistance;
    const yMovingStep = (endPoint.y - startPoint.y) / hDistance;
    const movingTime = hDistance * delayPerStep;

    const me = this;
    (function moving(timelong) {
        if (timelong >= movingTime) {
            return;
        } else if (timelong > 0) { // Ignore the first calling
            // TODO Cut the precision?
            const x = me.x + xMovingStep;
            const y = me.y + yMovingStep;
            me._moveTo(x, y);
        }
        setTimeout(moving, delayPerStep, timelong + delayPerStep);
    })(0);

    return this;
};

Mouse.prototype._goTo = function (x, y) {
    this.x = x;
    this.y = y;
    this.currentTarget = this.page.getTopElementAt(this.x, this.y);

    const space = 10;
    this.page.scrollTo(this.x - space, this.y - space);

    return this.currentTarget;
};

Mouse.prototype._moveTo = function (x, y) {
    if (this.x === x && this.y === y) {
        // No event will be triggered when mouse is hold
        return;
    }

    const prevTarget = this.currentTarget;
    const currentTarget = this._goTo(x, y);

    if (prevTarget !== currentTarget) {
        // From one element to other element
        this._fire(prevTarget, 'mouseleave', false);
        this._fire(prevTarget, 'mouseout', true);

        this._fire(currentTarget, 'mouseenter', false);
        this._fire(currentTarget, 'mouseover', true);
        this._fire(currentTarget, 'mousemove', true);
    } else {
        this._fire(currentTarget, 'mousemove', true);
    }
};

Mouse.prototype._fire = function (target, event, canBubble) {
    if (!target) {
        return;
    }

    const state = defaults({
        bubbles: canBubble !== false
    }, this._state(target));

    // NOTE: Animation will be asynchronous, so calling it before firing events
    this.page.drawMouse(event, state.pageX, state.pageY);
    simulant.fire(target, event, state);
};

Mouse.prototype._state = function (target) {
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
    const offsetX = this.x - targetOffset.x - targetBorder.left;
    const offsetY = this.y - targetOffset.y - targetBorder.top;

    const clientX = this.x - this.page.window.scrollX;
    const clientY = this.y - this.page.window.scrollY;
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
        pageX: this.x,
        pageY: this.y,
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
