const fs = require("fs");
const path = require("path");
const dir = "/Users/koushikgoudshaganti/Desktop/Agency/Praneeth/Event-360/src/components/";
const files = [
"TimelinePlanner.js", "SeatingChart.js", "ColorThemeDesigner.js",
"BeforeAfterCompare.js", "CollaborationMode.js", "StyleLibrary.js",
"VendorManager.js", "InventoryTracker.js", "CalendarBooking.js",
"ZoneNotes.js", "RevenueAnalytics.js", "WeatherSimulator.js",
"WalkthroughExporter.js", "ARQRGenerator.js", "PlaylistBuilder.js",
"MoodBoardMatcher.js", "TestimonialWall.js", "ESignatureFlow.js",
"NotificationCenter.js", "InvoiceGenerator.js", "BudgetOptimizer.js",
"EventBriefGenerator.js"
];
let classes = new Set();
files.forEach(f => {
  try {
    const content = fs.readFileSync(path.join(dir, f), "utf8");
    const matches = content.match(/class(?:Name)?=[\"'\`]([^\"'\`>]+)[\"'\`]/g);
    if(matches) {
      matches.forEach(m => {
        const cStr = m.replace(/class(?:Name)?=[\"'\`]/, "").replace(/[\"'\`]/g, "");
        cStr.split(/\s+/).forEach(c => {
          if(c && !c.includes("$") && !c.includes("{") && !c.startsWith("<")) classes.add(c);
        });
      });
    }
  } catch(e) { console.error(e.message); }
});
console.log(Array.from(classes).sort().join("\n"));
