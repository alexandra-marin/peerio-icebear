import { t } from 'peerio-translator';
const moment = require('moment');
const defaultClock = require('./observable-clock').default;

// 21 hour limit for displaying relative timestamp (because moment.js says '1 day' starting from 21h)
const hour = 60 * 60 * 1000;
const day = 24 * hour;
const relativeTimeDisplayLimit = 21 * hour;

/**
 * Formatted time stamp that changes baseds on how much time has passed since the given time.
 * < 24hr passed    => H:MM timestamp
 * < 48hr passed    => "Yesterday"
 * < 7 days passed  => day of week
 * > 7 days passed  => full date
 */
export default function relativeTimestamp(time: number): string {
    let timeFromNow = Date.now() - time;
    if (timeFromNow < hour) {
        // Subscribe to defaultClock only if the time is within the past hour.
        // Past an hour, refreshing the timestamp every minute is not necessary.
        timeFromNow = defaultClock.now - time;
    }

    if (timeFromNow > 7 * day) {
        return moment(time).format('LL');
    } else if (timeFromNow > 2 * day) {
        return moment(time).format('dddd');
    } else if (timeFromNow > relativeTimeDisplayLimit) {
        return t('title_yesterday');
    }
    return moment(time).fromNow();
}
