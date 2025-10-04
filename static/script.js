// DOM Elements
const trainForm = document.getElementById('trainForm');
const submitBtn = document.getElementById('submitBtn');
const submitText = document.getElementById('submitText');
const spinner = document.getElementById('spinner');
const results = document.getElementById('results');
const error = document.getElementById('error');
const errorMessage = document.getElementById('errorMessage');

// Result elements
const trainName = document.getElementById('trainName');
const trainRoute = document.getElementById('trainRoute');
const trainType = document.getElementById('trainType');
const currentLocation = document.getElementById('currentLocation');
const delay = document.getElementById('delay');
const routeTable = document.getElementById('routeTable');
const trainStats = document.getElementById('trainStats');

// Set default date to today
document.getElementById('journeyDate').value = new Date().toISOString().split('T')[0];

// Form submission handler
trainForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleFormSubmit();
});

async function handleFormSubmit() {
    const formData = new FormData(trainForm);
    const trainNumber = formData.get('train_number');
    const journeyDate = formData.get('journey_date');
    
    // Clear previous results and errors
    hideResults();
    hideError();
    
    // Show loading state
    showLoading();
    
    try {
        const response = await fetch(`/running/status?train_number=${trainNumber}&journey_date=${journeyDate}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        displayResults(data);
        
    } catch (err) {
        console.error('Error fetching train status:', err);
        showError(err.message || 'Failed to fetch train status. Please try again.');
    } finally {
        hideLoading();
    }
}

function showLoading() {
    submitBtn.disabled = true;
    submitText.textContent = 'Fetching Status...';
    spinner.classList.remove('hidden');
}

function hideLoading() {
    submitBtn.disabled = false;
    submitText.textContent = 'Get Train Status';
    spinner.classList.add('hidden');
}

function displayResults(data) {
    console.log('Displaying results:', data);
    
    // Display train information
    trainName.textContent = `${data.train.trainNumber} - ${data.train.trainName}`;
    trainRoute.textContent = `${data.train.sourceStationName} → ${data.train.destinationStationName}`;
    trainType.textContent = `${data.train.type} • Zone: ${data.train.zone} • Distance: ${data.train.distanceKm}km`;
    
    // Display current status from live data or general status
    if (data.liveData && data.liveData.currentLocation) {
        const currentLoc = data.liveData.currentLocation;
        currentLocation.innerHTML = `
            <strong>Current Location:</strong> ${currentLoc.stationCode} - ${currentLoc.status}
            <br><small>Distance from origin: ${currentLoc.distanceFromOriginKm}km</small>
        `;
        
        // No direct delay info in live data, so show status
        delay.innerHTML = `<span class="status-info">📍 ${currentLoc.status}</span>`;
        delay.className = 'delay';
    } else {
        currentLocation.innerHTML = `<strong>Status:</strong> ${data.statusSummary || 'Live status available'}`;
        if (data.metadata && data.metadata.lastLiveUpdate) {
            const updateTime = new Date(data.metadata.lastLiveUpdate).toLocaleString();
            delay.innerHTML = `<small>Last updated: ${updateTime}</small>`;
        } else {
            delay.innerHTML = '';
        }
    }
    
    // Display train statistics
    displayTrainStats(data.train);
    
    // Display route information
    displayRouteTable(data.route, data.liveData);
    
    // Show results
    results.classList.remove('hidden');
    results.scrollIntoView({ behavior: 'smooth' });
}

function displayRouteTable(routeInfo, liveData) {
    if (!routeInfo || routeInfo.length === 0) {
        routeTable.innerHTML = '<p>Route information not available</p>';
        return;
    }
    
    // Create header
    const header = document.createElement('div');
    header.className = 'route-item';
    header.style.fontWeight = 'bold';
    header.style.background = '#667eea';
    header.style.color = 'white';
    header.innerHTML = `
        <div class="station-code">Code</div>
        <div class="station-name">Station Name</div>
        <div class="time">Scheduled</div>
        <div class="time">Actual</div>
        <div class="platform">Platform</div>
        <div class="status">Status & Delay</div>
    `;
    
    routeTable.innerHTML = '';
    routeTable.appendChild(header);
    
    // Get live route data if available - handle missing/null cases
    const liveRoute = (liveData && liveData.route && Array.isArray(liveData.route)) ? liveData.route : [];
    
    // Add route items
    routeInfo.forEach((station, index) => {
        const item = document.createElement('div');
        item.className = 'route-item';
        
        // Find corresponding live data for this station - handle missing station data
        const liveStationData = liveRoute.find(lr => 
            lr && lr.station && lr.station.code === station.stationCode
        );
        
        // Determine station status - handle missing live data gracefully
        let isCurrent = false;
        let stationStatus = 'scheduled'; // Default status when no live data
        
        if (liveStationData) {
            // Check if we have actual timing data
            const hasArrival = liveStationData.actualArrival != null;
            const hasDeparture = liveStationData.actualDeparture != null;
            
            if (hasArrival && !hasDeparture && index < routeInfo.length - 1) {
                // Train has arrived but not departed (except for last station)
                isCurrent = true;
                stationStatus = 'current';
            } else if (hasDeparture || (hasArrival && index === routeInfo.length - 1)) {
                // Train has departed or arrived at final destination
                stationStatus = 'completed';
            } else if (hasArrival && index === routeInfo.length - 1) {
                // Final station - train has arrived
                stationStatus = 'completed';
            } else {
                // No actual timing data yet
                stationStatus = 'upcoming';
            }
        } else {
            // No live data available - determine status based on position relative to current location
            if (liveData && liveData.currentLocation && liveData.currentLocation.stationCode) {
                const currentStationCode = liveData.currentLocation.stationCode;
                const currentStationIndex = routeInfo.findIndex(s => s.stationCode === currentStationCode);
                
                if (currentStationIndex >= 0) {
                    if (index < currentStationIndex) {
                        stationStatus = 'completed';
                    } else if (index === currentStationIndex) {
                        stationStatus = 'current';
                        isCurrent = true;
                    } else {
                        stationStatus = 'upcoming';
                    }
                }
            }
        }
        
        if (isCurrent) {
            item.classList.add('current');
        }
        
        // Format scheduled times
        const scheduledArrival = station.scheduledArrival ? 
            formatTime(station.scheduledArrival) : 
            (index === 0 ? 'Start' : '--');
            
        const scheduledDeparture = station.scheduledDeparture ? 
            formatTime(station.scheduledDeparture) : 
            (index === routeInfo.length - 1 ? 'End' : '--');
        
        // Build scheduled times display
        let scheduledDisplay = '';
        if (index === 0) {
            scheduledDisplay = `<strong>Start</strong><br>${scheduledDeparture}`;
        } else if (index === routeInfo.length - 1) {
            scheduledDisplay = `${scheduledArrival}<br><strong>End</strong>`;
        } else {
            scheduledDisplay = `Arr: ${scheduledArrival}<br>Dep: ${scheduledDeparture}`;
        }
        
        // Build actual times and status display
        let actualDisplay = '--';
        let detailedStatus = `<span class="status ${stationStatus}">${getStatusText(stationStatus, index, routeInfo.length)}</span>`;
        
        if (liveStationData) {
            let actualTimes = [];
            let delays = [];
            
            try {
                // Handle actual arrival - with null checks
                if (liveStationData.actualArrival && index > 0) {
                    const actualArr = new Date(liveStationData.actualArrival);
                    if (!isNaN(actualArr.getTime())) {
                        const timeStr = actualArr.toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'});
                        actualTimes.push(`Arr: ${timeStr}`);
                    }
                    
                    // Calculate delay for arrival - handle missing delay data
                    if (typeof liveStationData.delayArrivalMinutes === 'number') {
                        const delayMinutes = liveStationData.delayArrivalMinutes;
                        if (delayMinutes > 0) {
                            delays.push(`Arr: +${delayMinutes}m late`);
                        } else if (delayMinutes < 0) {
                            delays.push(`Arr: ${Math.abs(delayMinutes)}m early`);
                        } else {
                            delays.push(`Arr: On time`);
                        }
                    }
                }
                
                // Handle actual departure - with null checks
                if (liveStationData.actualDeparture && index < routeInfo.length - 1) {
                    const actualDep = new Date(liveStationData.actualDeparture);
                    if (!isNaN(actualDep.getTime())) {
                        const timeStr = actualDep.toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'});
                        actualTimes.push(`Dep: ${timeStr}`);
                    }
                    
                    // Calculate delay for departure - handle missing delay data
                    if (typeof liveStationData.delayDepartureMinutes === 'number') {
                        const delayMinutes = liveStationData.delayDepartureMinutes;
                        if (delayMinutes > 0) {
                            delays.push(`Dep: +${delayMinutes}m late`);
                        } else if (delayMinutes < 0) {
                            delays.push(`Dep: ${Math.abs(delayMinutes)}m early`);
                        } else {
                            delays.push(`Dep: On time`);
                        }
                    }
                }
            } catch (error) {
                console.warn('Error processing live station data for', station.stationCode, error);
            }
            
            // Build actual times display
            if (actualTimes.length > 0) {
                actualDisplay = `<span class="actual-time">${actualTimes.join('<br>')}</span>`;
            } else {
                // Show appropriate message when no actual data available
                if (stationStatus === 'completed') {
                    actualDisplay = '<span class="no-data">Completed</span>';
                } else if (stationStatus === 'current') {
                    actualDisplay = '<span class="no-data">In progress</span>';
                } else {
                    actualDisplay = '<span class="no-data">Scheduled</span>';
                }
            }
            
            // Enhanced status with delays
            if (delays.length > 0) {
                const delayClass = delays.some(d => d.includes('late')) ? 'delay-late' : 
                                 delays.some(d => d.includes('early')) ? 'delay-early' : 'delay-ontime';
                detailedStatus += `<br><small class="${delayClass}">${delays.join('<br>')}</small>`;
            }
            
            // Add departed status - with better error handling
            if (liveStationData.actualDeparture && index < routeInfo.length - 1) {
                try {
                    const depTime = new Date(liveStationData.actualDeparture);
                    if (!isNaN(depTime.getTime())) {
                        const timeStr = depTime.toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'});
                        detailedStatus = `<span class="status departed">DEPARTED</span><br><small class="departed-time">Left at ${timeStr}</small>`;
                        if (delays.length > 0) {
                            const delayClass = delays.some(d => d.includes('late')) ? 'delay-late' : 
                                             delays.some(d => d.includes('early')) ? 'delay-early' : 'delay-ontime';
                            detailedStatus += `<br><small class="${delayClass}">${delays.join('<br>')}</small>`;
                        }
                    }
                } catch (error) {
                    console.warn('Error processing departure time for', station.stationCode, error);
                }
            }
        } else {
            // No live data available - show appropriate fallback messages
            switch (stationStatus) {
                case 'completed':
                    actualDisplay = '<span class="no-data">Completed*</span>';
                    detailedStatus += '<br><small class="no-live-data">*No live data available</small>';
                    break;
                case 'current':
                    actualDisplay = '<span class="no-data">At station*</span>';
                    detailedStatus += '<br><small class="no-live-data">*Based on location data</small>';
                    break;
                default:
                    actualDisplay = '<span class="no-data">Scheduled</span>';
                    break;
            }
        }
        
        item.innerHTML = `
            <div class="station-code">${station.stationCode}</div>
            <div class="station-name">${station.stationName}</div>
            <div class="time scheduled-time">${scheduledDisplay}</div>
            <div class="time actual-time-cell">${actualDisplay}</div>
            <div class="platform">${station.platform || '--'}</div>
            <div class="status-cell">${detailedStatus}</div>
        `;
        
        routeTable.appendChild(item);
    });
}

function displayTrainStats(train) {
    const stats = [
        { label: 'Travel Time', value: formatDuration(train.travelTimeMinutes) },
        { label: 'Total Distance', value: `${train.distanceKm} km` },
        { label: 'Average Speed', value: `${train.avgSpeedKmph} km/h` },
        { label: 'Total Halts', value: train.totalHalts },
        { label: 'Return Train', value: train.returnTrainNumber },
        { label: 'Zone', value: train.zone }
    ];
    
    trainStats.innerHTML = '';
    stats.forEach(stat => {
        const statItem = document.createElement('div');
        statItem.className = 'stat-item';
        statItem.innerHTML = `
            <div class="stat-label">${stat.label}</div>
            <div class="stat-value">${stat.value}</div>
        `;
        trainStats.appendChild(statItem);
    });
}

function getStatusText(status, index, totalStations) {
    switch (status) {
        case 'completed':
            return index === totalStations - 1 ? 'ARRIVED' : 'DEPARTED';
        case 'current':
            return 'AT STATION';
        case 'upcoming':
            return 'UPCOMING';
        case 'scheduled':
            return 'SCHEDULED';
        default:
            return 'NO DATA';
    }
}

function formatDuration(minutes) {
    if (!minutes) return '--';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
}

function formatTime(minutes) {
    if (!minutes && minutes !== 0) return '--';
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function showError(message) {
    errorMessage.textContent = message;
    error.classList.remove('hidden');
    error.scrollIntoView({ behavior: 'smooth' });
}

function hideError() {
    error.classList.add('hidden');
}

function hideResults() {
    results.classList.add('hidden');
}

function clearError() {
    hideError();
}

// Utility function to validate train number
document.getElementById('trainNumber').addEventListener('input', (e) => {
    const value = e.target.value;
    const isValid = /^[0-9]{4,5}$/.test(value);
    
    if (value && !isValid) {
        e.target.style.borderColor = '#dc3545';
        e.target.title = 'Please enter a valid train number (4-5 digits)';
    } else {
        e.target.style.borderColor = '#e1e5e9';
        e.target.title = '';
    }
});

// Auto-focus on train number input
window.addEventListener('load', () => {
    document.getElementById('trainNumber').focus();
});

// Handle API errors more gracefully
async function handleApiResponse(response) {
    const contentType = response.headers.get('content-type');
    
    if (!response.ok) {
        let errorMsg = `Server error (${response.status})`;
        
        if (contentType && contentType.includes('application/json')) {
            try {
                const errorData = await response.json();
                errorMsg = errorData.message || errorData.error || errorMsg;
            } catch (e) {
                // Ignore JSON parsing errors for non-JSON responses
            }
        } else {
            const textError = await response.text();
            if (textError) errorMsg = textError;
        }
        
        throw new Error(errorMsg);
    }
    
    if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid response format from server');
    }
    
    return response.json();
}