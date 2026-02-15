/*
MODULE: Scheduler
---------------------------------------------------
Helper utility for managing time-based triggers.
Allows programmatic scheduling of reports.
---------------------------------------------------
*/

/**
 * Schedules a report to run at a specific time every day.
 * @param {string} templateName - The name of the template to generate.
 * @param {number} hour - The hour (0-23) to run the report.
 * @param {string} [timeZone] - The timezone (default: script time zone).
 * @return {string} The ID of the created trigger.
 */
function scheduleDailyReport(templateName, hour, timeZone) {
    const tz = timeZone || Session.getScriptTimeZone();

    // Create a unique handler function name for this template
    // Note: Examples of dynamic function creation in GAS are complex. 
    // For this portfolio project, we'll use a standard dispatcher pattern.
    // We'll set up a user property to map the trigger ID to the template name.

    const trigger = ScriptApp.newTrigger('triggerDispatcher')
        .timeBased()
        .everyDays(1)
        .atHour(hour)
        .inTimezone(tz)
        .create();

    const triggerId = trigger.getUniqueId();

    // Store the mapping
    const props = PropertiesService.getScriptProperties();
    const scheduleMap = JSON.parse(props.getProperty('SCHEDULE_MAP') || '{}');
    scheduleMap[triggerId] = templateName;
    props.setProperty('SCHEDULE_MAP', JSON.stringify(scheduleMap));

    Logger.log(`✅ Scheduled '${templateName}' daily at ${hour}:00 (${tz}). Trigger ID: ${triggerId}`);
    return triggerId;
}

/**
 * Dispatcher function that all triggers call.
 * Looks up the template name based on the trigger ID.
 * @param {Object} e - The event object from the trigger.
 */
function triggerDispatcher(e) {
    if (!e || !e.triggerUid) {
        Logger.log("❌ Trigger Dispatcher called without trigger ID.");
        return;
    }

    const triggerId = e.triggerUid;
    const props = PropertiesService.getScriptProperties();
    const scheduleMap = JSON.parse(props.getProperty('SCHEDULE_MAP') || '{}');
    const templateName = scheduleMap[triggerId];

    if (templateName) {
        Logger.log(`⏰ Trigger ${triggerId} fired for template: ${templateName}`);
        generateEmailDraft(templateName);
    } else {
        Logger.log(`⚠️ Orphaned trigger ${triggerId} fired. No template mapped.`);
    }
}

/**
 * Lists all active scheduled reports.
 * @return {Object[]} Array of { id, handler, template }
 */
function listActiveTriggers() {
    const triggers = ScriptApp.getProjectTriggers();
    const props = PropertiesService.getScriptProperties();
    const scheduleMap = JSON.parse(props.getProperty('SCHEDULE_MAP') || '{}');

    const result = triggers.map(t => {
        const id = t.getUniqueId();
        return {
            id: id,
            handler: t.getHandlerFunction(),
            template: scheduleMap[id] || "(Unknown/Manual)",
            type: t.getEventType().toString()
        };
    });

    Logger.log("📋 Active Triggers:");
    result.forEach(r => Logger.log(`- [${r.id}] ${r.handler} -> ${r.template}`));
    return result;
}

/**
 * Clears all triggers associated with the project.
 */
function clearAllTriggers() {
    const triggers = ScriptApp.getProjectTriggers();
    for (const t of triggers) {
        ScriptApp.deleteTrigger(t);
    }
    PropertiesService.getScriptProperties().deleteProperty('SCHEDULE_MAP');
    Logger.log(`🗑️ Deleted ${triggers.length} triggers and cleared schedule map.`);
}
