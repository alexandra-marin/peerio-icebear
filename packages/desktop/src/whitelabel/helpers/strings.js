const config = require('~/config');
const routerStore = require('~/stores/router-store');

class STRINGS {
    get currentView() {
        return routerStore.ROUTES_INVERSE[routerStore.currentRoute];
    }

    get newChannel() {
        const obj = {
            title: 'title_createChannel',
            description: 'title_createChannelDetails',
            offerDM: 'title_offerNewDM',
            channelName: 'title_channelName',
            channelPurpose: 'title_purpose',
            purposeHelper: 'title_optional',
            userPickerTitle: 'title_chatWith'
        };

        if (config.whiteLabel.name === 'medcryptor') {
            obj.title = 'mcr_title_newRoom';

            if (this.currentView === 'newPatient') {
                obj.title = 'mcr_button_addPatient';
                obj.offerDM = 'mcr_title_newPatientDescription';
            }

            if (this.currentView === 'newInternalRoom') {
                obj.title = 'mcr_title_newInternalRoom';
                obj.description = 'mcr_title_newInternalRoomDescription';
                obj.channelName = 'title_nameOfRoom';
            }

            if (this.currentView === 'newPatientRoom') {
                obj.title = 'mcr_title_newPatientRoom';
                obj.description = 'mcr_title_newPatientRoomDescription';
                obj.channelName = 'title_nameOfRoom';
            }
        }

        return obj;
    }

    get newChat() {
        const obj = {
            offerRoom: 'title_offerNewRoom'
        };

        if (config.whiteLabel.name === 'medcryptor') {
            obj.offerRoom = 'mcr_title_offerNewRoom';
        }

        return obj;
    }
}

module.exports = new STRINGS();
