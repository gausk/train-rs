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
        <div class="time">Arrival</div>
        <div class="time">Departure</div>
        <div class="platform">Platform</div>
        <div class="status">Status</div>
    `;
    
    routeTable.innerHTML = '';
    routeTable.appendChild(header);
    
    // Get live route data if available
    const liveRoute = liveData && liveData.route ? liveData.route : [];
    
    // Add route items
    routeInfo.forEach((station, index) => {
        const item = document.createElement('div');
        item.className = 'route-item';
        
        // Find corresponding live data for this station
        const liveStationData = liveRoute.find(lr => lr.station.code === station.stationCode);
        
        // Determine if this is the current station (from live data)
        let isCurrent = false;
        let stationStatus = 'upcoming';
        
        if (liveStationData) {
            if (liveStationData.actualArrival && !liveStationData.actualDeparture) {
                isCurrent = true;
                stationStatus = 'current';
            } else if (liveStationData.actualDeparture) {
                stationStatus = 'completed';
            }
        }
        
        if (isCurrent) {
            item.classList.add('current');
        }
        
        // Format times
        const arrivalTime = station.scheduledArrival ? 
            formatTime(station.scheduledArrival) : 
            (index === 0 ? 'Start' : '--');
            
        const departureTime = station.scheduledDeparture ? 
            formatTime(station.scheduledDeparture) : 
            (index === routeInfo.length - 1 ? 'End' : '--');
        
        // Show actual times if available
        let displayArrival = arrivalTime;
        let displayDeparture = departureTime;
        
        if (liveStationData) {
            if (liveStationData.actualArrival) {
                const actualArr = new Date(liveStationData.actualArrival).toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'});
                displayArrival = `${arrivalTime}<br><small class="actual-time">Act: ${actualArr}</small>`;
            }
            if (liveStationData.actualDeparture) {
                const actualDep = new Date(liveStationData.actualDeparture).toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'});
                displayDeparture = `${departureTime}<br><small class="actual-time">Act: ${actualDep}</small>`;
            }
        }
        
        // Status display
        let statusHtml = `<span class="status ${stationStatus}">${stationStatus.toUpperCase()}</span>`;
        if (liveStationData && (liveStationData.delayArrivalMinutes || liveStationData.delayDepartureMinutes)) {
            const delay = liveStationData.delayArrivalMinutes || liveStationData.delayDepartureMinutes;
            statusHtml += `<br><small class="delay-info">+${delay}min</small>`;
        }
        
        item.innerHTML = `
            <div class="station-code">${station.stationCode}</div>
            <div class="station-name">${station.stationName}</div>
            <div class="time">${displayArrival}</div>
            <div class="time">${displayDeparture}</div>
            <div class="platform">${station.platform || '--'}</div>
            <div class="status-cell">${statusHtml}</div>
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