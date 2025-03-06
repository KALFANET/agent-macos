import os
import re

# 🔹 תיקיית העבודה הנוכחית (backend/)
ROOT_DIRECTORY = os.getcwd()  

# 🔹 שמות הקבצים שצריך לעדכן
TARGET_FILES = [
    "deviceController.js",
    "deviceRoutes.js",
    "models/device.js",
    "backendClient.js",
    "statusService.js",
    "installService.js",
    "commandService.js"
]

# 🔹 תבניות להחלפה
PATTERNS = [
    (r'\bdeviceId\b', 'id'),  # כל deviceId יהפוך ל-id
    (r'\bid\b(?!Key\b)', 'idKey')  # כל id (שלא היה deviceId) יהפוך ל-idKey
]

# 🔹 פונקציה לחיפוש קובץ בתיקיות משנה (בתוך backend/)
def find_all_files(root_dir, filenames):
    found_files = {}
    for dirpath, _, files in os.walk(root_dir):  # חיפוש בתוך כל התיקיות
        for filename in filenames:
            if filename in files:
                found_files[filename] = os.path.join(dirpath, filename)
    return found_files

# 🔹 חיפוש כל הקבצים הרלוונטיים
found_files = find_all_files(ROOT_DIRECTORY, TARGET_FILES)

# 🔹 ביצוע השינויים בקבצים שנמצאו
for filename, file_path in found_files.items():
    with open(file_path, "r", encoding="utf-8") as file:
        content = file.read()

    # ביצוע ההחלפות בתוכן הקובץ
    for pattern, replacement in PATTERNS:
        content = re.sub(pattern, replacement, content)

    # כתיבה חזרה לקובץ
    with open(file_path, "w", encoding="utf-8") as file:
        file.write(content)

    print(f"✅ שינויים בוצעו בקובץ: {file_path}")

# 🔹 הצגת קבצים שלא נמצאו
missing_files = set(TARGET_FILES) - set(found_files.keys())
if missing_files:
    for filename in missing_files:
        print(f"⚠️ הקובץ {filename} לא נמצא באף תיקייה בתוך {ROOT_DIRECTORY}!")