describe('Runner testing:', function () {
    var page;
    var rawHTMLDoc;

    before(function (done) {
        const name = 'e2e/simple.html';
        page = PageRunner.load(`/${name}`, done);

        const html = (window.__html__ || {})[name];

        // https://developer.mozilla.org/en-US/Add-ons/Code_snippets/HTML_to_DOM
        rawHTMLDoc = document.implementation.createHTMLDocument('Simple page');
        rawHTMLDoc.documentElement.innerHTML = html;
    });

    after(function () {
        page.destroy();
    });

    it('Check objects', function () {
        expect(page).to.not.be.null;
        expect(page).to.not.be.undefined;
        expect(rawHTMLDoc).to.not.be.null;
        expect(rawHTMLDoc).to.not.be.undefined;

        expect(page.window).to.not.be.null;
        expect(page.window).to.not.be.undefined;
        expect(page.document).to.not.be.null;
        expect(page.document).to.not.be.undefined;

        expect(page.document).to.equal(page.window.document);
        expect(rawHTMLDoc.body.innerHTML).to.not.empty;
    });

    it('Check content', function () {
        expect(page.document.head.querySelector('title').textContent)
            .to.equal(rawHTMLDoc.head.querySelector('title').textContent);
        expect(page.document.body.innerHTML).to.equal(rawHTMLDoc.body.innerHTML);
    });

    it('Check querying dom nodes', function () {
        expect(page.query('head title')).to.be.an.instanceof(Array);
        expect(page.query('head title')[0]).to.equal(page.document.head.querySelector('title'));
        expect(page.query('head title')[0]).to.equal(page.get('head title'));
        expect(page.query('.content')).to.be.an.instanceof(Array);
        expect(page.query('.content')[0]).to.equal(page.document.body.querySelector('.content'));
        expect(page.query('.content')[0]).to.equal(page.get('.content'));
    });
});
