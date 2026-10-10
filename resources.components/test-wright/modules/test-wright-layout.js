'use strict';

/*
 * Layout: resizable and collapsible side panels, the tree/plan split, the console drawer, edge
 * handles that reopen collapsed panels, and the status bar toggles.
 */

// Sidebar width limits so the controls remain usable while resizing.
const SIDEBAR_WIDTH_BOUNDS = { minimum: 250, maximum: 460 };

// Repository width limits so plan and run names remain readable.
const REPOSITORY_WIDTH_BOUNDS = { minimum: 250, maximum: 480 };

// A drag this far past the minimum collapses the panel.
const COLLAPSE_OVERSHOOT_PIXELS = 40;

// Each of the tree and plan panes keeps at least this width.
const SPLIT_PANE_MINIMUM_WIDTH_PIXELS = 260;

// Smallest console height when open.
const DRAWER_MINIMUM_HEIGHT_PIXELS = 100;

// Status bar height, below the console drawer.
const STATUS_BAR_HEIGHT_PIXELS = 26;

// Width of the resizer tracks.
const RESIZER_TRACK_WIDTH_PIXELS = 5;

// Pointer movement that turns an edge-handle click into a drag.
const EDGE_HANDLE_DRAG_THRESHOLD_PIXELS = 3;

// The console may take most, but not all, of the height.
const DRAWER_MAXIMUM_HEIGHT_RATIO = 0.85;

// Smallest tree+plan area that keeps both panes above their floor.
const MAIN_MINIMUM_WIDTH_PIXELS = 2 * SPLIT_PANE_MINIMUM_WIDTH_PIXELS + RESIZER_TRACK_WIDTH_PIXELS;

/**
 * Makes a resizer draggable, calling onMove during the drag and saving at the end.
 *
 * @param {HTMLElement} resizer - The drag handle.
 * @param {Function} onMove - Receives each mousemove event.
 * @returns {void}
 */
function enableDraggable(resizer, onMove) {
    resizer.addEventListener('mousedown', (event) => {
        event.preventDefault();
        resizer.classList.add('dragging');
        document.body.style.userSelect = 'none';

        const onDocumentMouseMove = (moveEvent) => onMove(moveEvent);
        const onDocumentMouseUp = () => {
            resizer.classList.remove('dragging');
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', onDocumentMouseMove);
            document.removeEventListener('mouseup', onDocumentMouseUp);
            requestSave();
        };

        document.addEventListener('mousemove', onDocumentMouseMove);
        document.addEventListener('mouseup', onDocumentMouseUp);
    });
}

/**
 * Wires an edge handle: click reopens the panel, drag resizes it.
 *
 * @param {HTMLElement} handle - The edge handle.
 * @param {Function} onMove - Receives each move event while dragging.
 * @param {Function} onReopen - Called on a click without a drag.
 * @returns {void}
 */
function enableEdgeHandle(handle, onMove, onReopen) {
    handle.addEventListener('mousedown', (event) => {
        event.preventDefault();
        document.body.style.userSelect = 'none';

        const start = { x: event.clientX, y: event.clientY };
        let isMoved = false;

        const onDocumentMouseMove = (moveEvent) => {
            const isPastThreshold = Math.abs(moveEvent.clientX - start.x) > EDGE_HANDLE_DRAG_THRESHOLD_PIXELS
                || Math.abs(moveEvent.clientY - start.y) > EDGE_HANDLE_DRAG_THRESHOLD_PIXELS;

            isMoved = isMoved || isPastThreshold;

            if (isMoved) {
                onMove(moveEvent);
            }
        };

        const onDocumentMouseUp = () => {
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', onDocumentMouseMove);
            document.removeEventListener('mouseup', onDocumentMouseUp);

            if (!isMoved) {
                onReopen();
            }

            requestSave();
        };

        document.addEventListener('mousemove', onDocumentMouseMove);
        document.addEventListener('mouseup', onDocumentMouseUp);
    });
}

/**
 * Returns the body grid width.
 *
 * @returns {number} Pixels.
 */
function getBodyWidth() {
    return document.querySelector('.body').clientWidth;
}

/**
 * Widest the repository column may be while the tree and plan stay usable.
 *
 * @returns {number} Pixels.
 */
function getRepoMax() {
    const sidebarWidth = state.showSidebar ? runtime.uiSidebarW + RESIZER_TRACK_WIDTH_PIXELS : 0;

    return Math.min(REPOSITORY_WIDTH_BOUNDS.maximum, getBodyWidth() - MAIN_MINIMUM_WIDTH_PIXELS - sidebarWidth - RESIZER_TRACK_WIDTH_PIXELS);
}

/**
 * Widest the sidebar may be while the tree and plan stay usable.
 *
 * @returns {number} Pixels.
 */
function getSidebarMax() {
    const repositoryWidth = state.showRepo ? runtime.uiRepoW + RESIZER_TRACK_WIDTH_PIXELS : 0;

    return Math.min(SIDEBAR_WIDTH_BOUNDS.maximum, getBodyWidth() - MAIN_MINIMUM_WIDTH_PIXELS - repositoryWidth - RESIZER_TRACK_WIDTH_PIXELS);
}

/**
 * Returns the side panel widths to draw: the user's widths, shrunk to fit a narrow window.
 *
 * @remarks
 * The user's widths (runtime.uiSidebarW / uiRepoW) are never changed here. A webview that is
 * hidden behind another editor tab briefly reports a zero or tiny width; shrinking the stored
 * widths then would lose them for good, so only the drawn widths follow the window.
 *
 * @returns {{ sidebar: number, repo: number }} Pixels.
 */
function getDisplayedPanelWidths() {
    const bodyWidth = getBodyWidth();

    // No usable width (hidden or not laid out yet): draw the user's widths as they are.
    if (bodyWidth <= MAIN_MINIMUM_WIDTH_PIXELS) {
        return { sidebar: runtime.uiSidebarW, repo: runtime.uiRepoW };
    }

    const sidebar = Math.min(runtime.uiSidebarW, Math.max(SIDEBAR_WIDTH_BOUNDS.minimum, getSidebarMax()));
    const sidebarTrack = state.showSidebar ? sidebar + RESIZER_TRACK_WIDTH_PIXELS : 0;
    const repoMaximum = Math.min(REPOSITORY_WIDTH_BOUNDS.maximum, bodyWidth - MAIN_MINIMUM_WIDTH_PIXELS - sidebarTrack - RESIZER_TRACK_WIDTH_PIXELS);
    const repo = Math.min(runtime.uiRepoW, Math.max(REPOSITORY_WIDTH_BOUNDS.minimum, repoMaximum));

    return { sidebar, repo };
}

/**
 * Wires every resizer, edge handle, and the window-resize fit-up.
 *
 * @returns {void}
 */
function registerResizers() {
    const mainSplit = document.querySelector('.main-split');

    enableDraggable(elements['resizer-left'], (event) => resizeSidebar(event.clientX));
    enableDraggable(elements['resizer-right'], (event) => resizeRepo(event.clientX));
    enableDraggable(elements['drawer-resizer'], (event) => resizeDrawer(event.clientY));
    enableDraggable(elements['pane-resizer'], (event) => {
        runtime.uiSplitTreeW = event.clientX - mainSplit.getBoundingClientRect().left;
        updateSplitGrid();
    });

    enableEdgeHandle(elements['edge-sidebar'], (event) => resizeSidebar(event.clientX), () => {
        state.showSidebar = true;
        updateBodyGrid();
        showLayoutToggles();
    });

    enableEdgeHandle(elements['edge-repo'], (event) => resizeRepo(event.clientX), () => {
        state.showRepo = true;
        updateBodyGrid();
        showLayoutToggles();
    });

    enableEdgeHandle(elements['edge-console'], (event) => resizeDrawer(event.clientY), () => {
        state.consoleOpen = true;
        state.consoleUnread = false;
        showConsoleState();
    });

    // Redraw only: the drawn widths follow the window, the user's widths stay as they were.
    window.addEventListener('resize', updateBodyGrid);
}

/**
 * Resizes the console; collapses it when dragged past the minimum.
 *
 * @param {number} pointerY - Pointer Y.
 * @returns {void}
 */
function resizeDrawer(pointerY) {
    const drawerBottom = window.innerHeight - STATUS_BAR_HEIGHT_PIXELS;
    const maximumHeight = Math.round(window.innerHeight * DRAWER_MAXIMUM_HEIGHT_RATIO);
    const height = drawerBottom - pointerY;

    if (height < DRAWER_MINIMUM_HEIGHT_PIXELS - COLLAPSE_OVERSHOOT_PIXELS) {
        state.consoleOpen = false;
    } else {
        state.consoleOpen = true;
        state.consoleUnread = false;
        runtime.consoleHeightPx = limitNumber(height, DRAWER_MINIMUM_HEIGHT_PIXELS, maximumHeight);
        elements['console-drawer'].style.height = `${runtime.consoleHeightPx}px`;
    }

    showConsoleState();
}

/**
 * Resizes the repository column; collapses it when dragged past the minimum.
 *
 * @param {number} pointerX - Pointer X.
 * @returns {void}
 */
function resizeRepo(pointerX) {
    const width = window.innerWidth - pointerX;

    if (width < REPOSITORY_WIDTH_BOUNDS.minimum - COLLAPSE_OVERSHOOT_PIXELS) {
        state.showRepo = false;
    } else {
        state.showRepo = true;
        runtime.uiRepoW = limitNumber(width, REPOSITORY_WIDTH_BOUNDS.minimum, Math.max(REPOSITORY_WIDTH_BOUNDS.minimum, getRepoMax()));
    }

    updateBodyGrid();
    showLayoutToggles();
}

/**
 * Resizes the sidebar; collapses it when dragged past the minimum.
 *
 * @param {number} pointerX - Pointer X (the sidebar's right edge).
 * @returns {void}
 */
function resizeSidebar(pointerX) {
    if (pointerX < SIDEBAR_WIDTH_BOUNDS.minimum - COLLAPSE_OVERSHOOT_PIXELS) {
        state.showSidebar = false;
    } else {
        state.showSidebar = true;
        runtime.uiSidebarW = limitNumber(pointerX, SIDEBAR_WIDTH_BOUNDS.minimum, Math.max(SIDEBAR_WIDTH_BOUNDS.minimum, getSidebarMax()));
    }

    updateBodyGrid();
    showLayoutToggles();
}

/**
 * Reflects the panel visibility on the status bar toggles.
 *
 * @returns {void}
 */
function showLayoutToggles() {
    elements['toggle-sidebar'].classList.toggle('active', state.showSidebar);
    elements['toggle-repo'].classList.toggle('active', state.showRepo);
}

/**
 * Toggles the repository column.
 *
 * @returns {void}
 */
function switchRepo() {
    state.showRepo = !state.showRepo;
    updateBodyGrid();
    showLayoutToggles();
    requestSave();
}

/**
 * Toggles the sidebar.
 *
 * @returns {void}
 */
function switchSidebar() {
    state.showSidebar = !state.showSidebar;
    updateBodyGrid();
    showLayoutToggles();
    requestSave();
}

/**
 * Applies the body grid tracks and the collapsed panel state.
 *
 * @returns {void}
 */
function updateBodyGrid() {
    const widths = getDisplayedPanelWidths();
    const sidebarTrack = state.showSidebar ? `${widths.sidebar}px ${RESIZER_TRACK_WIDTH_PIXELS}px` : '0px 0px';
    const repositoryTrack = state.showRepo ? `${RESIZER_TRACK_WIDTH_PIXELS}px ${widths.repo}px` : '0px 0px';

    // Hidden panels stay as zero-width tracks so the column mapping never shifts.
    document.querySelector('.body').style.gridTemplateColumns = `${sidebarTrack} 1fr ${repositoryTrack}`;
    elements['sidebar'].classList.toggle('collapsed', !state.showSidebar);
    elements['repo'].classList.toggle('collapsed', !state.showRepo);
    elements['edge-sidebar'].classList.toggle('visible', !state.showSidebar);
    elements['edge-repo'].classList.toggle('visible', !state.showRepo);

    updateSplitGrid();
    updateAccordionLayout();
}

/**
 * Applies the tree/plan split, keeping both panes above their floor.
 *
 * @returns {void}
 */
function updateSplitGrid() {
    const split = document.querySelector('.main-split');

    if (!split || runtime.uiSplitTreeW <= 0 || !split.clientWidth) {
        return;
    }

    const width = split.clientWidth;
    const minimum = Math.max(SPLIT_PANE_MINIMUM_WIDTH_PIXELS, Math.round(width / 3));
    const maximum = width - minimum - RESIZER_TRACK_WIDTH_PIXELS;

    if (maximum < minimum) {
        split.style.gridTemplateColumns = `1fr ${RESIZER_TRACK_WIDTH_PIXELS}px 1fr`;

        return;
    }

    // Clamp the drawn width only; the user's split survives a temporarily narrow window.
    const treeWidth = limitNumber(runtime.uiSplitTreeW, minimum, maximum);

    split.style.gridTemplateColumns = `${treeWidth}px ${RESIZER_TRACK_WIDTH_PIXELS}px 1fr`;
}
