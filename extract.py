import os, re
dir_path = "/Users/koushikgoudshaganti/Desktop/Agency/Praneeth/Event-360/src/components/"
files = [
"TimelinePlanner.js", "SeatingChart.js", "ColorThemeDesigner.js",
"BeforeAfterCompare.js", "CollaborationMode.js", "StyleLibrary.js",
"VendorManager.js", "InventoryTracker.js", "CalendarBooking.js",
"ZoneNotes.js", "RevenueAnalytics.js", "WeatherSimulator.js",
"WalkthroughExporter.js", "ARQRGenerator.js", "PlaylistBuilder.js",
"MoodBoardMatcher.js", "TestimonialWall.js", "ESignatureFlow.js",
"NotificationCenter.js", "InvoiceGenerator.js", "BudgetOptimizer.js",
"EventBriefGenerator.js"
]
classes = set()
for f in files:
    try:
        with open(os.path.join(dir_path, f), "r") as file:
            content = file.read()
            matches = re.findall(r"class(?:Name)?=[\"\'\`]?([^\"\'\`>]+)[\"\'\`]?", content)
            for match in matches:
                for c in match.split():
                    if "$" not in c and "{" not in c and not c.startswith("<"):
                        classes.add(c)
    except Exception as e:
        print(f"Error reading {f}: {e}")
print("\n".join(sorted(classes)))
