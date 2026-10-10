'use strict';

/*
 * Page utilities: escaping, date and path helpers, and the empty-state markup.
 */

// Display text per test status.
const STATUS_LABELS = {
    'not-run': 'Not Run',
    queued: 'Queued',
    running: 'Running',
    passed: 'Passed',
    failed: 'Failed',
    warning: 'Warning',
    broken: 'Broken',
    canceled: 'Canceled'
};

/**
 * Formats a count with its noun, singular for one: "1 bot", "2 bots".
 *
 * @param {number} count - The count.
 * @param {string} noun - The singular noun (the plural adds "s").
 * @returns {string} The formatted count.
 */
function formatCount(count, noun) {
    return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * Formats a date as "YYYY-MM-DD HH:MM" in local time.
 *
 * @param {Date} date - The date to format.
 * @returns {string} The formatted local date-time.
 */
function formatDateTime(date) {
    const pad = (value) => String(value).padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
        `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Returns the directory portion of a file path (handles both separators).
 *
 * @param {string} filePath - The file path.
 * @returns {string} The path without its last segment.
 */
function getDirectoryName(filePath) {
    return filePath.replace(/[\\/][^\\/]*$/, '');
}

/**
 * Escapes text for safe interpolation into innerHTML.
 *
 * @param {*} value - The value to escape (coerced to string).
 * @returns {string} The escaped text.
 */
function getEscapedHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

/**
 * Maps a status to its display label.
 *
 * @param {string} status - The status key.
 * @returns {string} The label.
 */
function getStatusLabel(status) {
    return STATUS_LABELS[status] || status;
}

/**
 * Joins a folder and a forward-slash relative path using the folder's own separator.
 *
 * @param {string} directory - The folder path.
 * @param {string} relativePath - A path such as 'suite/bot.json'.
 * @returns {string} The combined path.
 */
function joinPath(directory, relativePath) {
    const separator = directory.includes('\\') ? '\\' : '/';

    return `${directory.replace(/[\\/]+$/, '')}${separator}${relativePath.split('/').join(separator)}`;
}

/**
 * Clamps a number to the inclusive [min, max] range.
 *
 * @param {number} value - The value to clamp.
 * @param {number} min - The lower bound.
 * @param {number} max - The upper bound.
 * @returns {number} The clamped value.
 */
function limitNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Parses "YYYY-MM-DD[ HH:MM]" as local time.
 *
 * @param {string} value - The text.
 * @returns {number} Epoch milliseconds, or NaN when the text is not a date.
 */
function parseDateTime(value) {
    const matches = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/.exec((value || '').trim());

    if (!matches) {
        return Number.NaN;
    }

    const [, year, month, day, hour, minute] = matches.map((part) => Number(part || 0));

    return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
}

/**
 * Tests whether a date-time string is a valid future time.
 *
 * @param {string} value - The date-time string.
 * @returns {boolean} True when it parses to a time after now.
 */
function testFutureDateTime(value) {
    const time = parseDateTime(value);

    return Number.isFinite(time) && time > Date.now();
}

/**
 * Returns markup for an empty-state placeholder.
 *
 * @param {string} icon - Icon name: folder | search | filter | plan.
 * @param {string} heading - The heading text.
 * @param {string} subtitle - The supporting text.
 * @returns {string} The <g4-empty-state> markup (attribute values escaped).
 */
function writeEmptyState(icon, heading, subtitle) {
    return `<g4-empty-state icon="${getEscapedHtml(icon)}" heading="${getEscapedHtml(heading)}" ` +
        `subtitle="${getEscapedHtml(subtitle)}" test-id="empty-state-${getEscapedHtml(icon)}"></g4-empty-state>`;
}
