import requests
import json

# Fetch the issue
issue_response = requests.get("https://api.github.com/repos/Protocol-Guild/PayD/issues/266")
issue = issue_response.json()
print("ISSUE TITLE:", issue.get("title"))
print("ISSUE BODY:", issue.get("body"))
print("ISSUE STATE:", issue.get("state"))
print("ISSUE NUMBER:", issue.get("number"))

# Fetch repo contents to understand structure
contents_response = requests.get("https://api.github.com/repos/Protocol-Guild/PayD/contents/")
contents = contents_response.json()
for item in contents:
    print(f"  {item['type']}: {item['name']}")
