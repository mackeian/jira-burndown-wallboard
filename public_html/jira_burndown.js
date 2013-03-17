var JiraBurndown = (function() {
    // Data from JIRA
    var _jiradata;
    var _date_format_length=10; // Jira date format: '2013-01-01'
    var _sprint_info;
    var _sprint_date_info;
    var _sprint_fieldname;
    var _points_fieldname;
    var one_day_in_ms = 3600*24*1000;
    var _today;

    // Calculated data
    var _total_points = 0.0;
    var _start_date;
    var _end_date;
    var _number_of_sprint_days;
    var _sprint_dates;
    var _burndown_values;

    
    /*
     * Constructor for Jira Burndown
     * Calculates burndown values and dates from jira data
     */
    function JiraBurnDown(jiradata, until_date){
        if (until_date == undefined)
            until_date = new Date();
        _jiradata = jiradata;
        _today = until_date;
        setFieldNameInfo();
        
        // Set sprint information
        setSprintInfo();
        
        // Start and end date
        setStartDate();
        setEndDate();
        
        // Points burned per sprint-day
        setSprintDateInfo();
        
        // Points summarize
        setBurndownValues();
        
        return {
            total_points: _total_points,
            sprint_days: _number_of_sprint_days,
            sprint_dates: _sprint_dates,
            burndown_values: _burndown_values,
            formatDate: formatDate
        }
    };
    
    var debug = true;
    function logme(message) {
        if (debug)
            console.log(message);
    };

    function setSprintInfo() {
        _sprint_info = _jiradata.data['issues'][0]['fields'][_sprint_fieldname][0];
    };
    
    function setFieldNameInfo() {
        _sprint_fieldname = _jiradata.settings['sprint_fieldname'];
        _points_fieldname = _jiradata.settings['points_fieldname'];
    };
    
    /*
     * Puts the sprint start date in _start_date
     */
    function setStartDate() {
        var start_date_key = "startDate=";
        var start_date_index = _sprint_info.indexOf(start_date_key);
        var start_date_string = _sprint_info.substring(start_date_index+start_date_key.length, 
        start_date_index+start_date_key.length+_date_format_length);
        _start_date = new Date(start_date_string);
        return _start_date;
    };
    
    /*
     * Puts the sprint end date in _end_date
     */
    function setEndDate() {
        var end_date_key = "endDate=";
        var end_date_index = _sprint_info.indexOf(end_date_key);
        var end_date_string = _sprint_info.substring(end_date_index+end_date_key.length, 
        end_date_index+end_date_key.length+_date_format_length);
        _end_date = new Date(end_date_string);
        return _end_date;
    };
    
    /**
     * Calculates points burned per day from JIRA issues,
     * in _calendar_days, _sprint_date_info and _total_points
     */
    function setSprintDateInfo() {
        start_end_diff = Math.floor(_end_date - _start_date)/24/3600/1000;
        _calendar_days = start_end_diff+1;
        
        var sprint_date_info = {};
        // Adding all days
        for (i=0; i<=_calendar_days;i++) {
            var date = new Date(_start_date.getTime()+one_day_in_ms*i);
            sprint_date_info[date] = {'points_burned': 0, 'points_left': 0};
        }
        logme(sprint_date_info);
        // Updating days with data
        logme('=== BURNING POINTS ===');
        _total_points = 0.0;
        for (var i=0; i<_jiradata.data['issues'].length; i++) {
            var issue = _jiradata.data['issues'][i];
            var status = issue['fields']['status']['name'];
            var resolved_at = null;
            var points = 0;
            try {
                points = parseFloat(issue['fields'][_points_fieldname]);
                if (points == NaN) {
                    points = 0;
                }
            } catch (err) {
                points = 0;
            }
            _total_points += points;
            if (issue['changelog']['histories'] == undefined)
                continue;
            for (var j=0; j<issue['changelog']['histories'].length; j++) {
                var history = issue['changelog']['histories'][j];
                if (history['items'] == undefined)
                    continue;
                for (var k=0; k<history['items'].length;k++) {
                    var item = history['items'][k];
                    if (item['field'] == 'status' && (item['toString'] == 'Resolved' || item['toString'] == 'Closed')) {
                        resolved_at = new Date(history['created'].substring(0,10));
                    }
                }
            }
            if (resolved_at) {
                if (sprint_date_info[resolved_at] == undefined) {
                    logme('Date ' + resolved_at + ' for issue ' + issue['key']
                        + ' does not belong to the sprint, not adding.');
                    continue;
                }
                sprint_date_info[resolved_at]['points_burned'] = 
                    sprint_date_info[resolved_at]['points_burned'] + points;
                logme('Burned down ' + points + 'p at ' + resolved_at);
            }
        }
        _sprint_date_info = sprint_date_info;
        return {sprint_date_info: sprint_date_info, total_points:_total_points};
    };
    
    /**
     * Calculate burndown values, points left each day,
     * in _number_of_sprint_days, _sprint_dates and _burndown_values
     */ 
    function setBurndownValues() {
        var burndown_values = [];
        var burndown_dates_values = [];
        var points_left = _total_points;
        
        var actual_number_of_sprint_days = 0;
        var actual_sprint_dates = [];
        
        logme('Adding [' + actual_number_of_sprint_days + '] = ' + null
                    + ' - ' + points_left + 'p');
        actual_sprint_dates.push(undefined);
        burndown_values.push([actual_number_of_sprint_days, points_left]);
        
        logme('=== SUMMARIZE POINTS, total ' + _total_points + '===');
        for (var i=0; i<_calendar_days; i++) {
            var date = new Date(_start_date.getTime() + one_day_in_ms*i);
            
            // If no info on yesterday, skip since we're on the first day.
            if (_sprint_date_info[date] == undefined)
                continue;
                
            // Burn all yesterday's points
            points_left = points_left - _sprint_date_info[date]['points_burned'];
            _sprint_date_info[date]['points_left'] = points_left;
            
            var is_weekend = (date.getDay() == 6) || (date.getDay() == 0);
            if (!is_weekend) {
                actual_sprint_dates.push(date);
                actual_number_of_sprint_days++;
                logme('Adding [' + actual_number_of_sprint_days + '] = ' + date
                    + ' - ' + _sprint_date_info[date]['points_left'] + 'p');
                // Only add burndown up until today
                if (date.getTime() <= _today.getTime()) {
                    burndown_values.push([actual_number_of_sprint_days, _sprint_date_info[date]['points_left']]);
                }
            }
        }
        logme(burndown_values);
        logme(actual_sprint_dates);
        
        // Add an end line endpoints if needed
        if (burndown_values.length < actual_number_of_sprint_days) {
            burndown_values.push([actual_number_of_sprint_days, null]);
        }
        _number_of_sprint_days = actual_number_of_sprint_days;
        _sprint_dates = actual_sprint_dates;
        _burndown_values = burndown_values;
    };
    
    /**
     * Format a javascript date to string format,
     * e.g. "2014-01-23"
     */
    formatDate = function(date) {
        formatted_date = date.getFullYear() + '-';
        if ((date.getMonth()+1) < 10) {
            formatted_date += '0';
        }
        formatted_date += date.getMonth()+1+'-';
        if (date.getDate() < 10) {
            formatted_date += '0';
        }
        formatted_date += date.getDate();
        return formatted_date;
    };

    return JiraBurnDown;
})();