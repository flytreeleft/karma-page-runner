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

import Sizzle from 'sizzle';

import config from './config';

function isInBrowser() {
    return typeof window !== 'undefined' && typeof window.document !== 'undefined';
}

const pageRunnerContextId = 'page_runner_context';
function prepareContext() {
    if (!isInBrowser()) {
        return;
    }

    // TODO Append html fragment (contains template)
    var context = window.document.querySelector(`#${pageRunnerContextId}`);
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

    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('frameborder', '0');
    iframe.src = url;
    iframe.onload = function () {
        var iframeWindow = (this.contentWindow || this.contentDocument).window;
        var iframeDocument = (this.contentWindow || this.contentDocument).document;

        done && done(iframeWindow, iframeDocument);
    };

    context.appendChild(iframe);

    return function () {
        context.removeChild(iframe);
    };
}

function Page() {
}

Page.prototype.query = function (selector) {
    return this.document ? Sizzle(selector, this.document) : [];
};

Page.prototype.get = function (selector) {
    var doms = this.query(selector);

    return doms.length > 0 ? doms[0] : null;
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
