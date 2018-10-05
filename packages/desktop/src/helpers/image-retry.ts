/**
 * This module makes reload attempts on every currently rendered <img> elements in case image loading has failed.
 * 1. It subscribes to socket reconnect event, in most cases it means we had a network disconnection
 *    and there might be some images that failed to load because of that.
 *    Note that in a few cases socket reconnect could happen on a live network, but it's not an issue since
 *    event handler is not heavy.
 * 2. It finds all image elements, check if they've completed loading and if it was successful
 * 3. It forces reload of failed images.
 */

import { reaction, IReactionDisposer } from 'mobx';
import { socket } from 'peerio-icebear';

let disposer: IReactionDisposer | null = null;

export function start(): void {
    if (disposer) return;
    disposer = reaction(
        () => socket.connected,
        connected => {
            if (!connected) return;
            // caution: this is not an array, no forEach is available
            const elements = document.getElementsByTagName('img');
            for (let i = 0; i < elements.length; i++) {
                const img = elements[i];
                // complete - means it's currently not loading
                // naturalHeight - will be 0 if loading failed
                if (!img || !img.complete || img.naturalHeight > 0) continue;
                // not interested in local URIs
                if (img.src.startsWith('file://')) continue;
                // magically making image reload
                img.src = img.src;
            }
        }
    );
}

export function stop(): void {
    if (disposer) disposer();
    disposer = null;
}
