'use strict';

/*
 * Scheduling: up to five timed runs. The extension host owns the timers (so closing the panel
 * does not cancel a schedule); this module adds, labels, cancels, and lists them, and mirrors the
 * Parallel Runs toggle.
 */

/**
 * Schedules the checked plan items at the picked time.
 *
 * @returns {Promise<void>}
 */
async function addScheduledRun() {
    const value = elements['input-schedule'].value;
    const checkedItems = getCheckedPlanItems();

    if (!testFutureDateTime(value) || checkedItems.length === 0) {
        return;
    }

    // Refuse a schedule whose data would refuse the run, so a timed run never fails on empty values.
    if (!await testRunData(checkedItems)) {
        return;
    }

    // Snapshot the items with their keys and data, and the plan's iterations, for the timed run.
    const items = newPlanFileItems(checkedItems).map((item) => ({ ...item, checked: true, data: getRunData(item) }));
    const runAt = new Date(parseDateTime(value));
    const result = await g4Host.request('schedules:add', {
        runAt: runAt.toISOString(),
        label: '',
        items,
        iterations: state.iterations.map((iteration) => ({ include: iteration.include !== false })),
        testParallel: state.planParallel,
        environment: state.environment,
        folderPath: state.folderPath,
        collectAllure: state.allureEnabled
    });

    if (result?.error) {
        writeLog(`Schedule refused: ${result.error}`, 'warn');

        return;
    }

    elements['input-schedule'].value = '';
    writeLog(`Scheduled run created for ${formatDateTime(runAt)} (${items.length} items).`, 'warn');
    await updateSchedules();
}

/**
 * Loads a scheduled run's snapshot into the plan, confirming before replacing it.
 *
 * @param {object} schedule - The scheduled run: { items, iterations, label, testParallel }.
 * @returns {Promise<void>}
 */
async function loadSchedulePlan(schedule) {
    if (state.plan.length > 0) {
        const isConfirmed = await confirmDialog({
            title: 'Replace plan',
            message: 'Loading this scheduled run replaces your current plan. Consider saving it first. Replace now?',
            confirmLabel: 'Replace'
        });

        if (!isConfirmed) {
            return;
        }
    }

    const plan = {
        type: PLAN_FILE_TYPE,
        items: schedule.items,
        iterations: schedule.iterations || [],
        parallel: Boolean(schedule.testParallel)
    };

    setLoadedPlan(plan, schedule.label || 'scheduled run');
}

/**
 * Cancels a scheduled run.
 *
 * @param {number} id - The schedule id.
 * @returns {Promise<void>}
 */
async function removeSchedule(id) {
    await g4Host.request('schedules:remove', { id });
    writeLog('Scheduled run canceled.', 'muted');
    await updateSchedules();
}

/**
 * Stores the Parallel Runs toggle on the host scheduler.
 *
 * @param {CustomEvent} event - g4-input { value }.
 * @returns {Promise<void>}
 */
async function setScheduleParallel(event) {
    state.parallelMode = event.detail.value === true;
    await g4Host.request('schedules:setParallel', { parallel: state.parallelMode });
}

/**
 * Applies the scheduler snapshot the host sent.
 *
 * @param {object} snapshot - { schedules, parallel, maximum }.
 * @returns {void}
 */
function setSchedules(snapshot) {
    state.scheduledRuns = snapshot?.schedules || [];
    state.parallelMode = Boolean(snapshot?.parallel);
    runtime.maximumSchedules = snapshot?.maximum || 5;

    if (runtime.activeRuns === 0) {
        updateIdleStatus();
    }

    showApp();
}

/**
 * Renders one scheduled run (editable label, time, cancel, drag to load).
 *
 * @param {object} schedule - The scheduled run.
 * @returns {HTMLElement} The row.
 */
function showScheduleItem(schedule) {
    const item = document.createElement('div');
    const main = document.createElement('div');
    const label = document.createElement('input');
    const meta = document.createElement('span');
    const cancel = document.createElement('button');
    let labelTimer = null;

    item.className = 'schedule-item';
    item.draggable = true;
    item.title = 'Drag onto the plan to load this run';
    item.dataset.testId = `schedule-${schedule.id}`;
    main.className = 'schedule-main';
    label.className = 'schedule-label';
    label.type = 'text';
    label.placeholder = 'Label (optional)';
    label.value = schedule.label;
    label.draggable = false;
    label.setAttribute('aria-label', 'Schedule label');
    meta.className = 'schedule-meta';
    meta.textContent = `${formatDateTime(new Date(schedule.runAt))} - ${formatCount(schedule.items.length, 'item')}` +
        (schedule.environment ? ` - ${schedule.environment}` : '');
    cancel.type = 'button';
    cancel.className = 'schedule-cancel';
    cancel.title = 'Cancel';
    cancel.setAttribute('aria-label', 'Cancel scheduled run');
    cancel.innerHTML = '&times;';
    main.append(label, meta);
    item.append(main, cancel);

    // Labels save after a short pause so typing does not flood the host.
    label.addEventListener('input', () => {
        schedule.label = label.value;
        clearTimeout(labelTimer);
        labelTimer = setTimeout(() => g4Host.request('schedules:setLabel', { id: schedule.id, label: schedule.label }), 400);
    });

    // Interacting with the label must not start a drag.
    label.addEventListener('mousedown', (event) => event.stopPropagation());
    cancel.addEventListener('click', () => removeSchedule(schedule.id));

    item.addEventListener('dragstart', (event) => {
        runtime.dragPayload = { kind: 'schedulePlan', schedule };
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData('text/plain', schedule.label || 'schedule');
        item.classList.add('dragging');
    });

    item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        runtime.dragPayload = null;
        clearPlanDropMarkers();
    });

    return item;
}

/**
 * Renders the scheduled runs and the Parallel Runs toggle.
 *
 * @returns {void}
 */
function showSchedules() {
    elements['toggle-parallel-runs'].value = state.parallelMode;

    const list = elements['schedule-list'];

    // Keep a label being edited: re-render only when the list itself changed.
    const signature = state.scheduledRuns.map((schedule) => `${schedule.id}:${schedule.runAt}`).join('|');

    if (list.dataset.signature === signature && list.contains(document.activeElement)) {
        return;
    }

    list.dataset.signature = signature;
    list.replaceChildren(...state.scheduledRuns.map(showScheduleItem));
}

/**
 * Reloads the schedules from the host.
 *
 * @returns {Promise<void>}
 */
async function updateSchedules() {
    try {
        setSchedules(await g4Host.request('schedules:list'));
    } catch (error) {
        writeLog(`Schedules could not be read: ${error.message}`, 'warn');
    }
}
