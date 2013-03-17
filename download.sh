#!/bin/bash
source jira.cfg

# Output filename
OUTPUT_FILENAME="public_html/jira_data.json"

JIRA_PATH="/rest/api/2/search?jql=issuetype+IN+(Story,Bug)+AND+Sprint=$SPRINT_ID&fields=changelog,status,$SPRINT_FIELDNAME,$POINTS_FIELDNAME&expand=changelog"
echo "Connecting to $JIRA_HOST"
JIRA_DATA=$(curl --user $JIRA_USER:$JIRA_PWD $JIRA_HOST$JIRA_PATH)
echo "window.JiraData = { data: $JIRA_DATA, settings:{sprint_fieldname: '$SPRINT_FIELDNAME', points_fieldname: '$POINTS_FIELDNAME'} };" > $OUTPUT_FILENAME
echo "Saved jira data in json to $OUTPUT_FILENAME."
