import { when } from 'mobx';
import { contactStore, chatStore } from 'peerio-icebear';
import { getAttributeInParentChain } from './dom';

// TODO: use Icebear types
export async function getChannelByEvent(ev): Promise<any> {
    return chatStore.getChatWhenReady(
        getAttributeInParentChain(ev.target, 'data-channelid')
    );
}

export async function getContactByEvent(ev): Promise<any> {
    const contact = contactStore.getContact(
        getAttributeInParentChain(ev.target, 'data-username')
    );
    return new Promise(resolve =>
        when(() => !contact.loading, () => resolve(contact))
    );
}
