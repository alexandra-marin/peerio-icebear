const moment = require('moment');
const { t } = require('peerio-translator');

// 21 hour limit for displaying relative timestamp (because moment.js says '1 day' starting from 21h)
const relativeTimeDisplayLimit = 21 * 60 * 60 * 1000;
const day = 24 * 60 * 60 * 1000;

/**
 * Formatted time stamp that changes based on how much time has passed since the given time.
 * < 24hr passed    => H:MM timestamp
 * < 48hr passed    => "Yesterday"
 * < 7 days passed  => day of week
 * > 7 days passed  => full date
 */
function timestamp(time) {
    const timeFromNow = Date.now() - time;
    console.log(timeFromNow);
    if (timeFromNow > 7 * day) {
        return moment(time).format('l');
    } else if (timeFromNow > 2 * day) {
        return moment(time).format('dddd');
    } else if (timeFromNow > relativeTimeDisplayLimit) {
        return t('title_yesterday');
    }
    return moment(time).fromNow();
}

module.exports = {
    relativeTimeDisplayLimit,
    timestamp
};
