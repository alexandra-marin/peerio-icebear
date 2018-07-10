const config = require('../config');
const TinyDb = require('../db/tiny-db');
const { cryptoUtil } = require('../crypto');

class Telemetry {
    // TODO: may need to support other baseUrls if we want to use /engage/ functionality?
    baseUrl = 'https://api.mixpanel.com/track/?data=';
    baseObj = {};

    getUserId = () => {
        return TinyDb.system.getValue('uuid')
            .then(id => {
                if (!id) {
                    const newId = cryptoUtil.getRandomGlobalShortIdHex().toString();
                    TinyDb.system.setValue('uuid', newId);
                    return newId;
                }
                return id;
            })
            .catch(err => {
                console.error(err);
            });
    }

    async init() {
        const uuid = await this.getUserId();

        // base properties to be sent with all events
        // TODO: mobile & desktop have different base props
        const obj = {
            properties: {
                distinct_id: uuid,
                token: '' // TODO: remember to put the token here before trying to send data
            }
        };
        this.baseObj = obj;
    }

    send(eventObj) {
        const object = Object.assign(this.baseObj, eventObj);

        const data = config.isMobile
            ? null // TODO: pretty sure window.btoa() won't work on mobile
            : window.btoa(JSON.stringify(object));

        const url = `${this.baseUrl}${data}`;

        // // uncomment to send the event
        // window.fetch(url, {
        //     method: 'POST'
        // }).then(response => console.log(response.json()));

        console.log(url);
    }
}

module.exports = new Telemetry();
