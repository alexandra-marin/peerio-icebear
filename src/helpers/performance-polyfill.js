const globalContext = require('./global-context');

try {
    (function(scope) {
        if (scope.performance) {
            console.log(`performance is already present in the scope`);
            return;
        }
        const performance = scope.performance || {};
        scope.performance = performance;
        const _entries = [];
        const _marksIndex = {};

        function _filterEntries(key, value) {
            const n = _entries.length, result = [];
            for (let i = 0; i < n; i++) {
                if (_entries[i][key] === value) {
                    result.push(_entries[i]);
                }
            }
            return result;
        }

        function _clearEntries(type, name) {
            let i = _entries.length, entry;
            while (i--) {
                entry = _entries[i];
                if (entry.entryType === type && (name === void 0 || entry.name === name)) {
                    _entries.splice(i, 1);
                }
            }
        }
        if (!performance.now) {
            performance.now = performance.webkitNow || performance.mozNow || performance.msNow || function() {
                return Date.now();
            };
        }


        if (!performance.mark) {
            performance.mark = performance.webkitMark || function(name) {
                const mark = {
                    name,
                    entryType: 'mark',
                    startTime: performance.now(),
                    duration: 0
                };
                _entries.push(mark);
                _marksIndex[name] = mark;
                };
        }


        if (!performance.measure) {
            performance.measure =
                performance.webkitMeasure ||
                function(name, startMark, endMark) {
                    /* eslint-disable no-param-reassign */
                    startMark = _marksIndex[startMark].startTime;
                    endMark = _marksIndex[endMark].startTime;
                    /* eslint-enable no-param-reassign */

                    _entries.push({
                        name,
                    entryType: 'measure',
                    startTime: startMark,
                    duration: endMark - startMark
                });
            };
        }


        if (!performance.getEntriesByType) {
            performance.getEntriesByType = performance.webkitGetEntriesByType || function(type) {
                return _filterEntries('entryType', type);
            };
        }


        if (!performance.getEntriesByName) {
            performance.getEntriesByName = performance.webkitGetEntriesByName || function(name) {
                return _filterEntries('name', name);
            };
        }


        if (!performance.clearMarks) {
            performance.clearMarks = performance.webkitClearMarks || function(name) {
                _clearEntries('mark', name);
            };
        }


        if (!performance.clearMeasures) {
            performance.clearMeasures = performance.webkitClearMeasures || function(name) {
                _clearEntries('measure', name);
            };
        }
    }(globalContext));
} catch (e) {
    console.error(e);
}
