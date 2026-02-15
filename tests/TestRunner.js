/*
TEST SUITE: Universal Email Automation Engine
--------------------------------
Unit tests for pure functions.
Run with: testRunner()
--------------------------------
*/

/**
 * Main test runner - executes all tests and reports results
 */
function testRunner() {
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };
  
  console.log("🧪 Starting Test Suite...\n");
  
  // Run all test suites
  runTestSuite("parseDateToken_", testParseDateToken, results);
  runTestSuite("applyDictionary_", testApplyDictionary, results);
  runTestSuite("parseRecipientKeys", testParseRecipientKeys, results);
  runTestSuite("fixMissingQuotes_", testFixMissingQuotes, results);
  runTestSuite("htmlToPlainText_", testHtmlToPlainText, results);
  
  // Report results
  console.log("\n" + "=".repeat(50));
  console.log(`📊 Results: ${results.passed} passed, ${results.failed} failed`);
  console.log("=".repeat(50));
  
  if (results.failed > 0) {
    console.log("\n❌ Failed Tests:");
    results.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  - ${t.name}: ${t.error}`);
    });
  } else {
    console.log("\n✅ All tests passed!");
  }
  
  return results;
}

/**
 * Helper to run a test suite
 */
function runTestSuite(name, testFn, results) {
  console.log(`\n📋 Testing: ${name}`);
  console.log("-".repeat(50));
  testFn(results);
}

/**
 * Assert helper
 */
function assert(name, actual, expected, results) {
  const passed = JSON.stringify(actual) === JSON.stringify(expected);
  const testResult = {
    name,
    passed,
    actual,
    expected,
    error: passed ? null : `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
  };
  
  results.tests.push(testResult);
  
  if (passed) {
    results.passed++;
    console.log(`  ✅ ${name}`);
  } else {
    results.failed++;
    console.log(`  ❌ ${name}: ${testResult.error}`);
  }
}

// ==========================================
// TEST SUITES
// ==========================================

/**
 * Tests for parseDateToken_ function
 */
function testParseDateToken(results) {
  // Today variations
  const today = new Date();
  const result1 = parseDateToken_("today");
  assert("today returns Date object", result1 instanceof Date, true, results);
  assert("today has correct date", result1.getDate(), today.getDate(), results);
  
  // Yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const result2 = parseDateToken_("yesterday");
  assert("yesterday", result2.getDate(), yesterday.getDate(), results);
  
  // Tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const result3 = parseDateToken_("tomorrow");
  assert("tomorrow", result3.getDate(), tomorrow.getDate(), results);
  
  // Day arithmetic
  const todayPlus3 = new Date();
  todayPlus3.setDate(todayPlus3.getDate() + 3);
  const result4 = parseDateToken_("today+3");
  assert("today+3", result4.getDate(), todayPlus3.getDate(), results);
  
  // MonthStart
  const monthStart = new Date();
  monthStart.setDate(1);
  const result5 = parseDateToken_("monthstart");
  assert("monthstart sets day to 1", result5.getDate(), 1, results);
  
  // WeekStart (Sunday)
  const result6 = parseDateToken_("weekstart");
  assert("weekstart returns Sunday", result6.getDay(), 0, results);
  
  // Next Monday
  const result7 = parseDateToken_("next monday");
  assert("next monday is a Monday", result7.getDay(), 1, results);
  assert("next monday is in the future", result7 > new Date(), true, results);
  
  // Last week
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);
  const result8 = parseDateToken_("last week");
  const diffDays = Math.floor((new Date() - result8) / (1000 * 60 * 60 * 24));
  assert("last week is ~7 days ago", diffDays >= 6 && diffDays <= 8, true, results);
}

/**
 * Tests for applyDictionary_ function
 */
function testApplyDictionary(results) {
  // DATE command
  const result1 = applyDictionary_("{{DATE:Today}}");
  assert("DATE:Today returns formatted date", result1.match(/^\d{2}-[A-Z]{3}-\d{4}$/) !== null, true, results);
  
  // RANGE command
  const result2 = applyDictionary_("{{RANGE:Today:Today}}");
  assert("RANGE returns formatted range", result2.includes(" - "), true, results);
  
  // TIME command (default)
  const result3 = applyDictionary_("{{TIME}}");
  assert("TIME returns time string", result3.match(/\d{1,2}:\d{2}/) !== null, true, results);
  
  // TIME command (BKK)
  const result4 = applyDictionary_("{{TIME:BKK}}");
  assert("TIME:BKK includes ICT", result4.includes("ICT"), true, results);
  
  // MONTHNAME command
  const result5 = applyDictionary_("{{MONTHNAME:0}}");
  assert("MONTHNAME:0 returns month name", result5.match(/^[A-Z]+ \d{4}$/i) !== null, true, results);
  
  // GREETING command
  const result6 = applyDictionary_("{{GREETING}}");
  assert("GREETING returns greeting", ["Good Morning", "Good Afternoon", "Good Evening"].includes(result6), true, results);
  
  // Unknown command returns original
  const result7 = applyDictionary_("{{UNKNOWN:Param}}");
  assert("Unknown command returns original", result7, "{{UNKNOWN:Param}}", results);
  
  // HTML healing
  const result8 = applyDictionary_("{{<b>DATE</b>:&nbsp;Today}}");
  assert("HTML tags are stripped from inside brackets", result8.match(/^\d{2}-[A-Z]{3}-\d{4}$/) !== null, true, results);
  
  // Multiple tags
  const result9 = applyDictionary_("Date: {{DATE:Today}} and Time: {{TIME}}");
  assert("Multiple tags processed", result9.includes("Date:") && result9.includes("Time:"), true, results);
  
  // Empty string
  const result10 = applyDictionary_("");
  assert("Empty string returns empty", result10, "", results);
  
  // No tags
  const result11 = applyDictionary_("Plain text without tags");
  assert("Plain text unchanged", result11, "Plain text without tags", results);
}

/**
 * Tests for parseRecipientKeys function
 */
function testParseRecipientKeys(results) {
  // Normal case
  const result1 = parseRecipientKeys("Manager, Analyst, user@example.com");
  assert("Normal comma-separated", result1.length, 3, results);
  assert("Normal - first item", result1[0], "Manager", results);
  assert("Normal - email preserved", result1[2], "user@example.com", results);
  
  // With quotes and parentheses
  const result2 = parseRecipientKeys("('Manager'), \"Analyst\"");
  assert("Quotes and parens stripped", result2[0], "Manager", results);
  assert("Quotes stripped from second", result2[1], "Analyst", results);
  
  // Empty string
  const result3 = parseRecipientKeys("");
  assert("Empty string returns empty array", result3.length, 0, results);
  
  // Null/undefined
  const result4 = parseRecipientKeys(null);
  assert("Null returns empty array", result4.length, 0, results);
  
  // Trailing comma
  const result5 = parseRecipientKeys("Manager, Analyst,");
  assert("Trailing comma handled", result5.length, 2, results);
  
  // Whitespace
  const result6 = parseRecipientKeys("  Manager  ,  Analyst  ");
  assert("Whitespace trimmed", result6[0], "Manager", results);
  assert("Whitespace trimmed on second", result6[1], "Analyst", results);
}

/**
 * Tests for fixMissingQuotes_ function
 */
function testFixMissingQuotes(results) {
  // Simple sheet name
  const result1 = fixMissingQuotes_("Sheet1!A1:B10");
  assert("Simple sheet name gets quotes", result1, "'Sheet1'!A1:B10", results);
  
  // Already quoted
  const result2 = fixMissingQuotes_("'My Sheet'!A1:B10");
  assert("Already quoted unchanged", result2, "'My Sheet'!A1:B10", results);
  
  // Sheet name with spaces
  const result3 = fixMissingQuotes_("Data Sheet!A1");
  assert("Sheet with spaces gets quotes", result3, "'Data Sheet'!A1", results);
  
  // No exclamation mark (named range)
  const result4 = fixMissingQuotes_("NamedRange");
  assert("No bang returns as-is", result4, "NamedRange", results);
  
  // Sheet with special chars
  const result5 = fixMissingQuotes_("Sheet-Name!A1");
  assert("Sheet with hyphen gets quotes", result5, "'Sheet-Name'!A1", results);
}

/**
 * Tests for htmlToPlainText_ function
 */
function testHtmlToPlainText(results) {
  // BR tags
  const result1 = htmlToPlainText_("Line1<br>Line2");
  assert("BR becomes newline", result1.includes("\n"), true, results);
  
  // Paragraphs
  const result2 = htmlToPlainText_("<p>Paragraph</p>");
  assert("Paragraph becomes newline", result2.includes("\n"), true, results);
  
  // List items
  const result3 = htmlToPlainText_("<ul><li>Item1</li><li>Item2</li></ul>");
  assert("LI becomes bullet", result3.includes("•"), true, results);
  
  // HTML entities
  const result4 = htmlToPlainText_("&nbsp;&amp;&lt;&gt;&quot;");
  assert("Entities decoded", result4, " &<>\"", results);
  
  // Empty/null
  const result5 = htmlToPlainText_(null);
  assert("Null returns empty", result5, "", results);
  
  const result6 = htmlToPlainText_("");
  assert("Empty returns empty", result6, "", results);
  
  // Tables
  const result7 = htmlToPlainText_("<table><tr><td>A</td><td>B</td></tr></table>");
  assert("Table tags stripped", result7.includes("<table>"), false, results);
  
  // Multiple newlines collapsed
  const result8 = htmlToPlainText_("A<br><br><br>B");
  const newlineCount = (result8.match(/\n/g) || []).length;
  assert("Multiple newlines collapsed to max 2", newlineCount <= 2, true, results);
}
