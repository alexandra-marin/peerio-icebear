import config from '~/config';

let component = require('~/ui/chat/components/ZeroChats').default;
if (config.whiteLabel.name === 'medcryptor') {
    component = require('~/ui/chat/components/ZeroChats_medcryptor').default;
}

const ZeroChats = component;
export default ZeroChats;
