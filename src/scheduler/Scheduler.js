/*
MODULE: Scheduler
--------------------------------
Manages time-driven triggers for automated report generation.
Provides programmatic control over scheduled reports.
--------------------------------
*/

/**
 * Schedules a report to run automatically.
 * Creates a time-driven trigger for the specified template.
 * @param {string} templateName - Name of the template to schedule
 * @param {Object} options - Scheduling options
 * @param {string} options.frequency - "daily", "weekly", "monthly", "hourly"
 * @param {number} [options.hour] - Hour of day (0-23) for daily/weekly/monthly
 * @param {number} [options.minute] - Minute (0-59), defaults to 0
 * @param {number} [options.dayOfWeek] - Day for weekly (1=Mon, 7=Sun)
 * @param {number} [options.dayOfMonth] - Day for monthly (1-31)
 * @param {number} [options.everyMinutes] - Interval for hourly (1-60)
 * @param {Object} [options.overrides] - Config overrides for the template
 * @param {boolean} [options.validateFirst] - Validate template before scheduling (default: true)
 * @return {Object} Trigger info { triggerId: string, handlerFunction: string, nextExecution: Date }
 */
function scheduleReport(templateName, options) {
  try {
    // Validate inputs
    if (!templateName) {
      throw new Error("Template name is required");
    }
    
    if (!options || !options.frequency) {
      throw new Error("Frequency is required (daily, weekly, monthly, hourly)");
    }
    
    // Validate template first (optional but recommended)
    const shouldValidate = options.validateFirst !== false;
    if (shouldValidate) {
      const validation = validateTemplate(templateName);
      if (!validation.valid) {
        throw new Error(`Template validation failed: ${validation.errors.join(", ")}`);
      }
    }
    
    // Create unique handler function name
    const timestamp = Date.now();
    const handlerFunction = `scheduledReport_${templateName.replace(/[^a-zA-Z0-9_]/g, "_")}_${timestamp}`;
    
    // Store schedule configuration in PropertiesService
    const props = PropertiesService.getScriptProperties();
    const scheduleKey = `SCHEDULE_${handlerFunction}`;
    const scheduleConfig = {
      templateName: templateName,
      overrides: options.overrides || {},
      created: new Date().toISOString(),
      frequency: options.frequency,
      options: {
        hour: options.hour,
        minute: options.minute,
        dayOfWeek: options.dayOfWeek,
        dayOfMonth: options.dayOfMonth,
        everyMinutes: options.everyMinutes
      }
    };
    props.setProperty(scheduleKey, JSON.stringify(scheduleConfig));
    
    // Create the trigger based on frequency
    let trigger;
    const hour = options.hour !== undefined ? options.hour : 9; // Default 9 AM
    const minute = options.minute || 0;
    
    switch (options.frequency.toLowerCase()) {
      case "hourly":
        const interval = options.everyMinutes || 60;
        if (interval < 1 || interval > 60) {
          throw new Error("Hourly interval must be between 1 and 60 minutes");
        }
        trigger = ScriptApp.newTrigger("handleScheduledReport_")
          .timeBased()
          .everyMinutes(interval)
          .create();
        break;
        
      case "daily":
        trigger = ScriptApp.newTrigger("handleScheduledReport_")
          .timeBased()
          .everyDays(1)
          .atHour(hour)
          .nearMinute(minute)
          .create();
        break;
        
      case "weekly":
        const dayOfWeek = options.dayOfWeek || 1; // Default Monday
        if (dayOfWeek < 1 || dayOfWeek > 7) {
          throw new Error("Day of week must be 1 (Mon) through 7 (Sun)");
        }
        trigger = ScriptApp.newTrigger("handleScheduledReport_")
          .timeBased()
          .onWeekDay(convertDayNumber_(dayOfWeek))
          .atHour(hour)
          .nearMinute(minute)
          .create();
        break;
        
      case "monthly":
        // Monthly triggers require custom handling
        // We'll create a daily trigger that checks if it's the right day
        const dayOfMonth = options.dayOfMonth || 1;
        if (dayOfMonth < 1 || dayOfMonth > 31) {
          throw new Error("Day of month must be between 1 and 31");
        }
        trigger = ScriptApp.newTrigger("handleScheduledReport_")
          .timeBased()
          .everyDays(1)
          .atHour(hour)
          .nearMinute(minute)
          .create();
        // Store day of month in config for filtering
        scheduleConfig.dayOfMonth = dayOfMonth;
        props.setProperty(scheduleKey, JSON.stringify(scheduleConfig));
        break;
        
      default:
        throw new Error(`Unknown frequency: ${options.frequency}. Use: hourly, daily, weekly, monthly`);
    }
    
    // Store trigger ID with handler mapping
    const triggerData = {
      triggerId: trigger.getUniqueId(),
      handlerFunction: handlerFunction,
      templateName: templateName,
      scheduleKey: scheduleKey
    };
    props.setProperty(`TRIGGER_${trigger.getUniqueId()}`, JSON.stringify(triggerData));
    
    Log.info("Scheduler", `✅ Scheduled "${templateName}" (${options.frequency}) - Next: ${trigger.getNextHandlerExecutionTime()}`);
    
    return {
      success: true,
      triggerId: trigger.getUniqueId(),
      handlerFunction: handlerFunction,
      templateName: templateName,
      frequency: options.frequency,
      nextExecution: trigger.getNextHandlerExecutionTime()
    };
    
  } catch (e) {
    Log.error("Scheduler", `Failed to schedule report: ${e.message}`);
    throw e;
  }
}

/**
 * Internal handler for scheduled reports.
 * This function is called by the triggers.
 * @private
 */
function handleScheduledReport_(event) {
  try {
    const triggerId = event.triggerUid;
    const props = PropertiesService.getScriptProperties();
    
    // Get trigger data
    const triggerDataStr = props.getProperty(`TRIGGER_${triggerId}`);
    if (!triggerDataStr) {
      Log.error("Scheduler", `No trigger data found for ID: ${triggerId}`);
      return;
    }
    
    const triggerData = JSON.parse(triggerDataStr);
    const scheduleKey = triggerData.scheduleKey;
    
    // Get schedule config
    const scheduleConfigStr = props.getProperty(scheduleKey);
    if (!scheduleConfigStr) {
      Log.error("Scheduler", `No schedule config found for: ${scheduleKey}`);
      return;
    }
    
    const scheduleConfig = JSON.parse(scheduleConfigStr);
    
    // Check if monthly trigger should run today
    if (scheduleConfig.frequency === "monthly" && scheduleConfig.dayOfMonth) {
      const today = new Date().getDate();
      if (today !== scheduleConfig.dayOfMonth) {
        Log.info("Scheduler", `Skipping monthly report "${scheduleConfig.templateName}" - today is ${today}, scheduled for ${scheduleConfig.dayOfMonth}`);
        return;
      }
    }
    
    // Execute the report
    Log.info("Scheduler", `Running scheduled report: "${scheduleConfig.templateName}"`);
    const result = generateEmailDraft(scheduleConfig.templateName, scheduleConfig.overrides);
    
    if (result && result.success) {
      Log.info("Scheduler", `✅ Scheduled report completed successfully`);
    } else {
      Log.error("Scheduler", `❌ Scheduled report failed`);
    }
    
  } catch (e) {
    Log.error("Scheduler", `Error in scheduled report handler: ${e.message}`);
  }
}

/**
 * Lists all active scheduled reports.
 * @return {Object[]} Array of schedule info objects
 */
function listActiveTriggers() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    const props = PropertiesService.getScriptProperties();
    const schedules = [];
    
    triggers.forEach(trigger => {
      // Only include our report triggers
      if (trigger.getHandlerFunction() === "handleScheduledReport_") {
        const triggerId = trigger.getUniqueId();
        const triggerDataStr = props.getProperty(`TRIGGER_${triggerId}`);
        
        if (triggerDataStr) {
          const triggerData = JSON.parse(triggerDataStr);
          const scheduleConfigStr = props.getProperty(triggerData.scheduleKey);
          const scheduleConfig = scheduleConfigStr ? JSON.parse(scheduleConfigStr) : {};
          
          schedules.push({
            triggerId: triggerId,
            templateName: triggerData.templateName,
            frequency: scheduleConfig.frequency || "unknown",
            nextExecution: trigger.getNextHandlerExecutionTime(),
            created: scheduleConfig.created,
            options: scheduleConfig.options || {}
          });
        }
      }
    });
    
    Log.info("Scheduler", `Found ${schedules.length} active scheduled reports`);
    return schedules;
    
  } catch (e) {
    Log.error("Scheduler", `Failed to list triggers: ${e.message}`);
    return [];
  }
}

/**
 * Clears all scheduled report triggers.
 * Use with caution!
 * @param {boolean} [requireConfirmation=true] - Whether to show confirmation dialog
 */
function clearAllTriggers(requireConfirmation = true) {
  try {
    const schedules = listActiveTriggers();
    
    if (schedules.length === 0) {
      Log.info("Scheduler", "No active triggers to clear");
      return { cleared: 0 };
    }
    
    // Show confirmation dialog if requested
    if (requireConfirmation) {
      try {
        const ui = SpreadsheetApp.getUi();
        const response = ui.alert(
          "⚠️ Clear All Scheduled Reports",
          `This will delete ${schedules.length} scheduled report(s). Are you sure?`,
          ui.ButtonSet.YES_NO
        );
        
        if (response !== ui.Button.YES) {
          return { cleared: 0, cancelled: true };
        }
      } catch (e) {
        // Not in UI context, proceed without confirmation
        Log.warn("Scheduler", "Running without UI confirmation");
      }
    }
    
    // Delete all triggers
    const triggers = ScriptApp.getProjectTriggers();
    const props = PropertiesService.getScriptProperties();
    let cleared = 0;
    
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === "handleScheduledReport_") {
        const triggerId = trigger.getUniqueId();
        
        // Clean up properties
        const triggerDataStr = props.getProperty(`TRIGGER_${triggerId}`);
        if (triggerDataStr) {
          const triggerData = JSON.parse(triggerDataStr);
          props.deleteProperty(triggerData.scheduleKey);
          props.deleteProperty(`TRIGGER_${triggerId}`);
        }
        
        // Delete trigger
        ScriptApp.deleteTrigger(trigger);
        cleared++;
      }
    });
    
    Log.info("Scheduler", `Cleared ${cleared} scheduled reports`);
    return { cleared: cleared };
    
  } catch (e) {
    Log.error("Scheduler", `Failed to clear triggers: ${e.message}`);
    throw e;
  }
}

/**
 * Clears triggers for a specific template.
 * @param {string} templateName - Name of the template
 * @return {Object} Result { cleared: number }
 */
function clearTriggerByTemplate(templateName) {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    const props = PropertiesService.getScriptProperties();
    let cleared = 0;
    
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === "handleScheduledReport_") {
        const triggerId = trigger.getUniqueId();
        const triggerDataStr = props.getProperty(`TRIGGER_${triggerId}`);
        
        if (triggerDataStr) {
          const triggerData = JSON.parse(triggerDataStr);
          
          if (triggerData.templateName === templateName) {
            // Clean up properties
            props.deleteProperty(triggerData.scheduleKey);
            props.deleteProperty(`TRIGGER_${triggerId}`);
            
            // Delete trigger
            ScriptApp.deleteTrigger(trigger);
            cleared++;
          }
        }
      }
    });
    
    if (cleared > 0) {
      Log.info("Scheduler", `Cleared ${cleared} trigger(s) for template "${templateName}"`);
    } else {
      Log.warn("Scheduler", `No triggers found for template "${templateName}"`);
    }
    
    return { cleared: cleared };
    
  } catch (e) {
    Log.error("Scheduler", `Failed to clear trigger: ${e.message}`);
    throw e;
  }
}

/**
 * Helper to convert day number to ScriptApp.WeekDay
 * @param {number} dayNum - 1 (Mon) through 7 (Sun)
 * @return {ScriptApp.WeekDay}
 */
function convertDayNumber_(dayNum) {
  const days = [
    null, // 0 index not used
    ScriptApp.WeekDay.MONDAY,
    ScriptApp.WeekDay.TUESDAY,
    ScriptApp.WeekDay.WEDNESDAY,
    ScriptApp.WeekDay.THURSDAY,
    ScriptApp.WeekDay.FRIDAY,
    ScriptApp.WeekDay.SATURDAY,
    ScriptApp.WeekDay.SUNDAY
  ];
  return days[dayNum];
}

/**
 * Displays schedules in a formatted dialog.
 * Only works in container-bound context.
 */
function showSchedulesDialog() {
  try {
    if (!SpreadsheetApp.getActiveSpreadsheet) {
      Logger.log("❌ This function requires a container-bound script");
      return;
    }
    
    const schedules = listActiveTriggers();
    const ui = SpreadsheetApp.getUi();
    
    if (schedules.length === 0) {
      ui.alert("📅 Scheduled Reports", "No active scheduled reports found.", ui.ButtonSet.OK);
      return;
    }
    
    let message = "📅 Active Scheduled Reports:\n\n";
    schedules.forEach((sched, i) => {
      const nextRun = Utilities.formatDate(new Date(sched.nextExecution), Session.getScriptTimeZone(), "MMM dd, yyyy HH:mm");
      message += `${i + 1}. "${sched.templateName}" (${sched.frequency})\n   Next: ${nextRun}\n\n`;
    });
    
    ui.alert("📅 Scheduled Reports", message, ui.ButtonSet.OK);
    
  } catch (e) {
    Logger.log("❌ Error: " + e.message);
  }
}
