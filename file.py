import requests

# הגדרות ריפוזיטורי
owner = "KALFANET"
repo = "agent-macos"
branch = "main"
base_path = ""

# תיקיות שיש להתעלם מהן
excluded_dirs = {"node_modules", ".git", "__pycache__"}

# רשימה לשמירת קבצים שמצאנו
collected_files = []

# פונקציה לשליפת תוכן תיקייה מה-API של GitHub
def fetch_directory_contents(path):
    url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}?ref={branch}"
    response = requests.get(url)
    
    if response.status_code == 404:
        print(f"⚠️ התיקייה {path} לא קיימת ב-Repository. מוודא שממשיכים...")
        return []
    
    if response.status_code == 200:
        return response.json()
    
    print(f"⚠️ שגיאה בלתי צפויה בשליפת {url}: {response.status_code}")
    return []

# פונקציה לסריקת תיקיות רקורסיבית
def collect_files_recursive(path, raw_base_url):
    contents = fetch_directory_contents(path)
    
    for item in contents:
        if item["type"] == "dir":
            dir_name = item["name"]
            if dir_name in excluded_dirs:
                continue  # מתעלם מתיקיות לא רצויות
            collect_files_recursive(f"{path}/{dir_name}", raw_base_url)
        elif item["type"] == "file":
            collected_files.append(f"{raw_base_url}/{item['path']}")

# פונקציה ראשית
def main():
    raw_base_url = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}"
    collect_files_recursive(base_path, raw_base_url)

    # שמירת הקישורים לקובץ טקסט
    with open("github_raw_links.txt", "w") as f:
        for link in collected_files:
            f.write(link + "\n")

    print("✅ רשימת הקישורים נשמרה ב-github_raw_links.txt")

if __name__ == "__main__":
    main()