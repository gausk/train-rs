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
const runningDays = document.getElementById('runningDays');
const currentLocation = document.getElementById('currentLocation');
const delay = document.getElementById('delay');
const routeTable = document.getElementById('routeTable');
const trainStats = document.getElementById('trainStats');

// Utility functions for time conversion
function formatTimeIST(epochSeconds) {
    if (!epochSeconds) return '--';
    
    const date = new Date(epochSeconds * 1000);
    
    return date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Kolkata'
    });
}

function formatDateTimeIST(epochSeconds) {
    if (!epochSeconds) return '--';
    
    const date = new Date(epochSeconds * 1000);
    
    return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Kolkata'
    });
}

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
    runningDays.textContent = `Running Days: ${data.train.runningDays}`;
    
        // Display current status from live data or general status
        if (data.live_data && data.live_data.currentLocation) {
            const currentLoc = data.live_data.currentLocation;
            
            currentLocation.innerHTML = `
                <div class="current-location-card">
                    <div class="location-details">
                        <div class="station-info">
                            <div class="station-line">
                                <span class="station-display">
                                    ${currentLoc.status} ${currentLoc.stationName ? 
                                        `${currentLoc.stationName} (${currentLoc.stationCode})` : 
                                        currentLoc.stationCode
                                    }
                                </span>
                                ${currentLoc.distanceFromOriginKm ? 
                                    `<span class="distance-inline">• Distance from Origin: ${Math.round(currentLoc.distanceFromOriginKm)}km</span>` : 
                                    ''
                                }
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Show last updated time if available
            if (data.live_data.lastUpdatedAt) {
                // Parse ISO date string to epoch seconds
                const updateTimeEpoch = Math.floor(new Date(data.live_data.lastUpdatedAt).getTime() / 1000);
                const updateTime = formatDateTimeIST(updateTimeEpoch);
                delay.innerHTML = `<div class="update-info"><small>Last updated: ${updateTime} IST</small></div>`;
            } else {
                delay.innerHTML = '';
            }
            delay.className = 'delay';
        } else {
            currentLocation.innerHTML = `
                <div class="no-live-data">
                    <span class="status-badge">No Live Data</span>
                    <p>${data.live_data?.statusSummary || 'Live tracking not available for this train'}</p>
                </div>
            `;
            delay.innerHTML = '';
        }    // Display train statistics
    displayTrainStats(data.train);
    
    // Display route information - Note: route info is now inside live_data
    displayRouteTable(data.live_data?.route || [], data.live_data);
    
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
        <div class="station-code header-cell">Code</div>
        <div class="station-name header-cell">Station Name</div>
        <div class="time header-cell">Scheduled</div>
        <div class="time header-cell">Actual</div>
        <div class="platform header-cell">Platform</div>
        <div class="status header-cell">Status & Delay</div>
    `;
    
    routeTable.innerHTML = '';
    routeTable.appendChild(header);
    
    // Add route items
    routeInfo.forEach((station, index) => {
        const item = document.createElement('div');
        item.className = 'route-item';
        
        // Determine station status based on the status field from the model
        let isCurrent = false;
        let stationStatus = 'scheduled'; // Default status
        
        // Use the status field from the model if available
        if (station.status) {
            switch (station.status) {
                case 'Departed':
                    stationStatus = 'completed';
                    break;
                case 'Arrived':
                    stationStatus = 'current';
                    isCurrent = true;
                    break;
                case 'Upcoming':
                    stationStatus = 'upcoming';
                    break;
                default:
                    stationStatus = 'scheduled';
            }
        } else {
            // Fallback logic based on actual times
            const hasArrival = station.actualArrival != null;
            const hasDeparture = station.actualDeparture != null;
            
            if (hasArrival && !hasDeparture && index < routeInfo.length - 1) {
                isCurrent = true;
                stationStatus = 'current';
            } else if (hasDeparture || (hasArrival && index === routeInfo.length - 1)) {
                stationStatus = 'completed';
            } else if (hasArrival && index === routeInfo.length - 1) {
                stationStatus = 'completed';
            } else {
                stationStatus = 'upcoming';
            }
        }
        
        if (isCurrent) {
            item.classList.add('current');
        }
        
        // Format scheduled times using epoch timestamps
        const scheduledArrival = station.scheduledArrival ? 
            formatTimeIST(station.scheduledArrival) : 
            (index === 0 ? 'Start' : '--');
            
        const scheduledDeparture = station.scheduledDeparture ? 
            formatTimeIST(station.scheduledDeparture) : 
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
        
        // Handle actual arrival and departure times using epoch timestamps
        let actualTimes = [];
        let delays = [];
        
        try {
            // Handle actual arrival
            if (station.actualArrival && index > 0) {
                const actualArrTime = formatTimeIST(station.actualArrival);
                if (actualArrTime !== '--') {
                    actualTimes.push(`Arr: ${actualArrTime}`);
                }
                
                // Calculate delay for arrival if delay data is available
                if (typeof station.delayArrivalMinutes === 'number') {
                    const delayMinutes = station.delayArrivalMinutes;
                    if (delayMinutes > 0) {
                        delays.push(`Arr: +${delayMinutes}m late`);
                    } else if (delayMinutes < 0) {
                        delays.push(`Arr: ${Math.abs(delayMinutes)}m early`);
                    } else {
                        delays.push(`Arr: On time`);
                    }
                }
            }
            
            // Handle actual departure
            if (station.actualDeparture && index < routeInfo.length - 1) {
                const actualDepTime = formatTimeIST(station.actualDeparture);
                if (actualDepTime !== '--') {
                    actualTimes.push(`Dep: ${actualDepTime}`);
                }
                
                // Calculate delay for departure if delay data is available
                if (typeof station.delayDepartureMinutes === 'number') {
                    const delayMinutes = station.delayDepartureMinutes;
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
            console.warn('Error processing station data for', station.station?.code || 'unknown', error);
        }
        
        // Build actual times display
        if (actualTimes.length > 0) {
            actualDisplay = `<span class="actual-time">${actualTimes.join('<br>')}</span>`;
        } else {
            // Show actual times even if no actualTimes array was built
            let fallbackTimes = [];
            
            // Check for actual arrival time
            if (station.actualArrival && index > 0) {
                const actualArrTime = formatTimeIST(station.actualArrival);
                if (actualArrTime !== '--') {
                    fallbackTimes.push(`Arr: ${actualArrTime}`);
                }
            }
            
            // Check for actual departure time
            if (station.actualDeparture && index < routeInfo.length - 1) {
                const actualDepTime = formatTimeIST(station.actualDeparture);
                if (actualDepTime !== '--') {
                    fallbackTimes.push(`Dep: ${actualDepTime}`);
                }
            }
            
            if (fallbackTimes.length > 0) {
                actualDisplay = `<span class="actual-time">${fallbackTimes.join('<br>')}</span>`;
            } else {
                // Only show status messages when there are truly no actual times
                actualDisplay = '<span class="no-data">--</span>';
            }
        }
        
        // Enhanced status with delays
        if (delays.length > 0) {
            const delayClass = delays.some(d => d.includes('late')) ? 'delay-late' : 
                             delays.some(d => d.includes('early')) ? 'delay-early' : 'delay-ontime';
            detailedStatus += `<br><small class="${delayClass}">${delays.join('<br>')}</small>`;
        }
        
        // Add departed status for completed stations
        if (station.actualDeparture && index < routeInfo.length - 1 && stationStatus === 'completed') {
            const depTime = formatTimeIST(station.actualDeparture);
            if (depTime !== '--') {
                detailedStatus = `<span class="status departed">DEPARTED</span><br><small class="departed-time">Left at ${depTime}</small>`;
                if (delays.length > 0) {
                    const delayClass = delays.some(d => d.includes('late')) ? 'delay-late' : 
                                     delays.some(d => d.includes('early')) ? 'delay-early' : 'delay-ontime';
                    detailedStatus += `<br><small class="${delayClass}">${delays.join('<br>')}</small>`;
                }
            }
        }
        
        // Get station name - handle both direct name and station object
        const stationName = station.station?.name || station.stationName || 'Unknown Station';
        const stationCode = station.station?.code || station.stationCode || '--';
        
        item.innerHTML = `
            <div class="station-code" data-label="Code">${stationCode}</div>
            <div class="station-name" data-label="Station">${stationName}</div>
            <div class="time scheduled-time" data-label="Scheduled">${scheduledDisplay}</div>
            <div class="time actual-time-cell" data-label="Actual">${actualDisplay}</div>
            <div class="platform" data-label="Platform">${station.platform || '--'}</div>
            <div class="status-cell" data-label="Status">${detailedStatus}</div>
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
        { label: 'Return Train', value: train.returnTrainNumber || '--' },
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
            return 'ARRIVED';
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