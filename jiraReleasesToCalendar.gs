function deleteAllFutureEvents(calendar) {
  
  const startDate = new Date(2000, 0, 1);  // Start from January 1, 2000
  const endDate = new Date(2100, 11, 31);  // End on December 31, 2100
  
  // Get all events in the calendar within this date range
  const allEvents = calendar.getEvents(startDate, endDate);  // Fetch all events from past to future
  
  Logger.log("Found " + allEvents.length + " events to delete.");

  // Loop through each event and delete it
  allEvents.forEach(function(event) {
    //Logger.log("Deleting event: " + event.getTitle() + " on " + event.getStartTime());
    event.deleteEvent();
  });
}

/*function setAccessToken() {
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty('ACCESS_TOKEN', '[Access token]');
}*/

function getAccessToken() {
  const scriptProperties = PropertiesService.getScriptProperties();
  return scriptProperties.getProperty('ACCESS_TOKEN');
}

function fetchJiraReleases(jiraProjectKey) {
  const jiraDomain = "https://jira-di.atlassian.net/";
  const accessToken = getAccessToken();  // Use your Jira API token
  const apiUrl = `${jiraDomain}/rest/api/3/project/${jiraProjectKey}/version`;
  
  const headers = {
    "Authorization": `Basic ${Utilities.base64Encode("per-olof.bengtsson@di.no:"+accessToken)}`,
    "Accept": "application/json"
  };
  
  let allReleases = [];
  let startAt = 0;
  let isLastPage = false;
  
  // Loop through paginated results
  while (!isLastPage) {
    const urlWithPagination = `${apiUrl}?startAt=${startAt}&maxResults=50`;
    
    const options = {
      "method": "GET",
      "headers": headers
    };
    const response = UrlFetchApp.fetch(urlWithPagination, options);
    const data = JSON.parse(response.getContentText());

    // Collect the releases from the current page
    allReleases = allReleases.concat(data.values);

    // Update pagination variables
   
    isLastPage = data.isLast || data.values.length < data.maxResults;  // Check if it's the last page
    
    // If not the last page, update startAt for the next page
    if (!isLastPage) {
      startAt += data.maxResults;
    }
    //Logger.log("Name: " + data.values[0].name + " page: " +startAt + " maxLength" + data.values.length + " isLast:" + isLastPage)
  }


   // Filter the releases to include only those that are unreleased and not archived
  const unreleasedReleases = allReleases.filter(function(release) {
  return (release.archived === false || release.archived === undefined);
});
  
  return unreleasedReleases;  // Returns only unreleased and non-archived versions
}


function createReleaseEvents() {
  const projectKeys = ['DI', 'MED'];  // Replace with your Jira project keys
  
  const calendar = CalendarApp.getCalendarById("[your calendarId");  // Your Google Calendar ID

  // Delete all future events before creating new ones
  deleteAllFutureEvents(calendar);

  projectKeys.forEach(function(projectKey) {
    Logger.log("Fetching releases for project: " + projectKey);
    const releases = fetchJiraReleases(projectKey);  // Fetch the release data

    releases.forEach(function(release) {
      const releaseName = release.name;
      const releaseDate = release.releaseDate;  // Ensure date format is correct (YYYY-MM-DD)

      if (releaseDate) {
        const eventDate = new Date(releaseDate);
        
        // Fetch detailed version info (including the description)
  
        const description = release.description || "No description available";

        // Search for existing events on the same date with the same name
        const events = calendar.getEventsForDay(eventDate);
        let eventExists = false;
        
        for (let i = 0; i < events.length; i++) {
          if (events[i].getTitle() === releaseName) {
            eventExists = true;
            break;
          }
        }
        
        // If no event with the same name exists on that day, create a new event
        if (!eventExists) {
          const event = calendar.createAllDayEvent(releaseName, eventDate);
          event.setDescription(description + " Event created by google script that fetch data from Jira, for any changes of this event please do it in Jira and google calendar will be updated automatically");  // Add Jira description to the event
          Logger.log("Created event: " + releaseName + " on " + releaseDate);

          // Check if the release name starts with "Main"
          
          // Create release candidate if start date exist
          if (release.startDate) {
            const startDate = new Date(release.startDate);  // Use the startDate from the release
            
            const rcEventName = "RC for release " + releaseName;
            const rcEvent = calendar.createAllDayEvent(rcEventName, startDate);
            rcEvent.setDescription(description + " Event created by google script that fetch data from Jira, for any changes of this event please do it in Jira and google calendar will be updated automatically");  // Set description for RC event
            
            Logger.log("Created RC event: " + rcEventName + " on " + startDate);
          }
          

        } else {
          Logger.log("Event already exists: " + releaseName + " on " + releaseDate);
        }
      }
    });
  })
}

function main() {
  // Fetch Jira releases and create calendar events
  createReleaseEvents();
}
