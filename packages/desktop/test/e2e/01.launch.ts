import { startApp, closeApp, isDev, Context } from './helpers';

console.log(
    `===== Tests starting in ${isDev ? 'DEVELOPMENT' : 'PRODUCTION'} mode =====`
);

describe('application launch', function(this: Context) {
    setupTimeout(this);
    beforeEach(() => startApp(this));
    afterEach(() => closeApp(this));

    it('opens a window', () => {
        return this.app.client.browserWindow
            .focus()
            .browserWindow.isMinimized()
            .should.eventually.be.false.browserWindow.isFocused()
            .should.eventually.be.true.browserWindow.getBounds()
            .should.eventually.have.property('width')
            .and.be.above(0)
            .browserWindow.getBounds()
            .should.eventually.have.property('height')
            .and.be.above(0);
    });

    it('has a default language & dictionary', async () => {
        const language = await this.app.client.execute(
            () => require('./stores/language-store').language
        );
        expect(language.value).toEqual('en');

        const locale = await this.app.client.execute(
            () => ice.PhraseDictionary.current.locale
        );
        expect(locale.value).toEqual('en');

        const dict = await this.app.client.execute(
            () => ice.PhraseDictionary.current.dict
        );
        expect(dict.value.length).toBeGreaterThan(10000);
    });
});
