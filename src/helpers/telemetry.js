const config = require('../config');
const TinyDb = require('../db/tiny-db');
const { cryptoUtil } = require('../crypto');
const os = require('os');

class Telemetry {
    // TODO: may need to support other baseUrls if we want to use /engage/ functionality?
    baseUrl = 'https://api.mixpanel.com/track/?data=';
    baseObj = {
        properties: {
            token: '', // TODO: remember to put the token here before trying to send data
            Device: config.isMobile ? 'Mobile' : 'Desktop',
            'Operating System': os.type(),
            'OS Version': os.release(),
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
    }

    camelToTitleCase(text) {
        return (text[0].toUpperCase() + text.slice(1)).split(/(?=[A-Z])/).join(' ');
    }

    send(eventObj) {
        // Marketing wants all items (property names and values) to be in Title Case, but this breaks code style.
        // So we still write props in camelCase when sending events from client, and convert them here.
        let properties = {};
        Object.keys(eventObj.properties).forEach(itemInCamel => {
            const item = this.camelToTitleCase(itemInCamel);
            properties[item] = eventObj.properties[itemInCamel];
        });

        // `baseObj`'s properties will be overwritten on assign.
        // This song-and-dance merges the properties first, assigns the object, then assigns the object's properties
        properties = Object.assign(properties, this.baseObj.properties);
        const object = Object.assign({}, eventObj, this.baseObj);
        object.properties = properties;

        // // uncomment to send the event
        // const data = config.isMobile
        //     ? null // TODO: pretty sure window.btoa() won't work on mobile
        //     : window.btoa(JSON.stringify(object));
        // const url = `${this.baseUrl}${data}`;
        //
        // window.fetch(url, {
        //     method: 'POST'
        // }).then(response => console.log(response.json()));

        console.log(object);
    }
}

module.exports = new Telemetry();
