const config = require('../config');
const TinyDb = require('../db/tiny-db');
const { cryptoUtil } = require('../crypto');

class Telemetry {
    // TODO: may need to support other baseUrls if we want to use /engage/ functionality?
    baseUrl = 'https://api.mixpanel.com/track/?data=';
    baseObj = {
        properties: {
            token: '', // TODO: remember to put the token here before trying to send data
            'App Version': config.appVersion,
            'Version Number': 1 // refers to our own tracker library versioning
        }
    };

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
        this.baseObj.properties.distinct_id = uuid;
        console.log('BASE OBJECT');
        console.log(this.baseObj);
    }

    send(eventObj) {
        // `baseObj`'s properties will be overwritten on assign.
        // This song-and-dance merges the properties first, assigns the object, then assigns the object's properties
        const properties = Object.assign(this.baseObj.properties, eventObj.properties);
        const object = Object.assign(this.baseObj, eventObj);
        object.properties = properties;

        const data = config.isMobile
            ? null // TODO: pretty sure window.btoa() won't work on mobile
            : window.btoa(JSON.stringify(object));

        const url = `${this.baseUrl}${data}`;

        // // uncomment to send the event
        // window.fetch(url, {
        //     method: 'POST'
        // }).then(response => console.log(response.json()));

        console.log('SEND OBJECT');
        console.log(object);

        console.log('URL');
        console.log(url);
    }
}

module.exports = new Telemetry();
