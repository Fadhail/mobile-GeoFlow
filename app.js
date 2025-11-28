/**
 * GeoFlow Tracker - Advanced Mobile Geolocation Tracking
 * Modern, robust, and well-structured location tracking application
 */

class GeoFlowTracker {
    constructor() {
        // Configuration
        this.config = {
            backendUrl: 'https://k04bfg24-8080.asse.devtunnels.ms/api/v1/tracking/push',
            trackingInterval: (localStorage.getItem('tracking_interval') || 10) * 1000,
            maxDebugLogs: 50,
            geolocationOptions: {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0
            }
        };

        // State
        this.state = {
            isTracking: false,
            isInitialized: false,
            userId: null,
            sessionCount: 0,
            locations: [],
            debugLogs: [],
            lastLocation: null,
            lastError: null,
            userIdSet: false
        };

        // Tracking
        this.trackingInterval = null;
        this.watchId = null;

        // Initialize
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        console.log('%c🚀 GeoFlow Tracker Initializing', 'color: #3498db; font-size: 14px; font-weight: bold;');
        
        this.debug('App started', 'system');
        
        // Setup UI
        this.setupEventListeners();
        this.updateDeviceInfo();
        
        // Check geolocation support
        if (!navigator.geolocation) {
            this.setStatus('❌ Geolocation not supported', 'error');
            this.debug('Geolocation API not available', 'error');
            return;
        }
        
        // Check permissions
        await this.checkPermissions();
        
        // Show user ID modal
        this.showUserIdModal();
    }

    /**
     * Check location permissions
     */
    async checkPermissions() {
        if (!navigator.permissions) {
            this.debug('Permissions API not available', 'warning');
            return;
        }

        try {
            const permission = await navigator.permissions.query({ name: 'geolocation' });
            this.updatePermissionStatus(permission.state);
            
            permission.addEventListener('change', () => {
                this.updatePermissionStatus(permission.state);
            });
        } catch (error) {
            this.debug(`Permission check failed: ${error.message}`, 'warning');
        }
    }

    /**
     * Update permission status display
     */
    updatePermissionStatus(state) {
        const el = document.getElementById('permissionStatus');
        if (!el) return;

        const states = {
            'granted': '✓ Granted',
            'denied': '✗ Denied',
            'prompt': '? Prompt'
        };
        
        el.textContent = states[state] || 'Unknown';
        this.debug(`Permission state: ${state}`, 'info');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Control buttons
        document.getElementById('startBtn')?.addEventListener('click', () => this.startTracking());
        document.getElementById('stopBtn')?.addEventListener('click', () => this.stopTracking());
        
        // User ID Modal
        document.getElementById('submitUserIdBtn')?.addEventListener('click', () => this.submitUserId());
        document.getElementById('userIdInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.submitUserId();
        });
        document.getElementById('userIdInput')?.addEventListener('input', (e) => {
            this.validateUserIdInput(e.target.value);
        });
    }

    /**
     * Show user ID modal
     */
    showUserIdModal() {
        const modal = document.getElementById('userIdModal');
        const input = document.getElementById('userIdInput');
        
        if (modal) {
            modal.style.display = 'flex';
            input?.focus();
        }
        
        this.debug('User ID modal shown', 'info');
    }

    /**
     * Hide user ID modal
     */
    hideUserIdModal() {
        const modal = document.getElementById('userIdModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * Validate user ID input format
     */
    validateUserIdInput(value) {
        const validationMessage = document.getElementById('validationMessage');
        const submitBtn = document.getElementById('submitUserIdBtn');
        
        if (!validationMessage || !submitBtn) return;

        // Clear message
        validationMessage.textContent = '';
        validationMessage.className = 'validation-message';

        if (!value) {
            submitBtn.disabled = true;
            return;
        }

        // Check format: only alphanumeric, underscore, hyphen
        const validFormat = /^[a-zA-Z0-9_-]+$/.test(value);
        if (!validFormat) {
            validationMessage.textContent = '⚠️ Only letters, numbers, underscores, and hyphens allowed';
            validationMessage.className = 'validation-message error';
            submitBtn.disabled = true;
            return;
        }

        // Check length
        if (value.length < 3) {
            validationMessage.textContent = '⚠️ User ID must be at least 3 characters';
            validationMessage.className = 'validation-message warning';
            submitBtn.disabled = true;
            return;
        }

        if (value.length > 50) {
            validationMessage.textContent = '⚠️ User ID must not exceed 50 characters';
            validationMessage.className = 'validation-message error';
            submitBtn.disabled = true;
            return;
        }

        // All good
        validationMessage.textContent = '✓ Valid User ID';
        validationMessage.className = 'validation-message success';
        submitBtn.disabled = false;
    }

    /**
     * Submit and validate user ID
     */
    async submitUserId() {
        const input = document.getElementById('userIdInput');
        const userId = input?.value.trim();

        if (!userId) {
            this.showValidationError('Please enter a User ID');
            return;
        }

        // Validate format
        if (!/^[a-zA-Z0-9_-]+$/.test(userId) || userId.length < 3 || userId.length > 50) {
            this.showValidationError('Invalid User ID format');
            return;
        }

        this.debug(`Checking User ID availability: ${userId}`, 'info');
        this.setStatus('🔄 Checking User ID...', 'info');

        try {
            // Check if user ID already exists
            const historyUrl = `${this.config.backendUrl.replace('/push', '')}/history/${userId}`;
            const response = await fetch(historyUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                
                // If we get data with any tracking records, user ID is taken
                if (data && Array.isArray(data) && data.length > 0) {
                    this.showValidationError(`❌ User ID '${userId}' already exists with ${data.length} tracking records. Please use a different User ID.`);
                    this.debug(`User ID '${userId}' already in use`, 'warning');
                    return;
                }
            }

            // User ID is available
            this.state.userId = userId;
            this.state.userIdSet = true;
            this.state.sessionCount = parseInt(localStorage.getItem(`session_count_${userId}`) || 0);
            
            localStorage.setItem('current_user_id', userId);
            
            this.debug(`✓ User ID '${userId}' verified and set`, 'success');
            this.setStatus('✓ Ready to track', 'success');
            this.updateDeviceInfo();
            this.hideUserIdModal();
            
            // Mark as initialized
            this.state.isInitialized = true;

        } catch (error) {
            // If error checking, allow user to proceed (might be backend temporarily unavailable)
            // But warn them
            this.debug(`⚠️ Could not verify User ID online: ${error.message}`, 'warning');
            
            // Check locally if this user ID has been used before
            const localData = JSON.parse(localStorage.getItem(`tracking_data_${userId}`) || '[]');
            if (localData.length > 0) {
                this.showValidationError(`❌ User ID '${userId}' already used locally. Please use a different User ID.`);
                return;
            }

            // Allow proceeding with warning
            this.state.userId = userId;
            this.state.userIdSet = true;
            localStorage.setItem('current_user_id', userId);
            this.updateDeviceInfo();
            this.hideUserIdModal();
            this.state.isInitialized = true;
            this.setStatus('⚠️ Offline mode - Ready to track', 'warning');
            this.debug(`User ID set to '${userId}' (offline validation)`, 'info');
        }
    }

    /**
     * Show validation error message
     */
    showValidationError(message) {
        const validationMessage = document.getElementById('validationMessage');
        if (validationMessage) {
            validationMessage.textContent = message;
            validationMessage.className = 'validation-message error';
        }
        this.setStatus(message, 'error');
        this.debug(message, 'error');
    }

    /**
     * Start location tracking
     */
    startTracking() {
        if (!this.state.userIdSet) {
            this.debug('User ID not set. Please set User ID first.', 'error');
            this.setStatus('❌ Please set User ID first', 'error');
            this.showUserIdModal();
            return;
        }

        if (this.state.isTracking) {
            this.debug('Tracking already active', 'warning');
            return;
        }

        this.setStatus('🔄 Starting...', 'info');
        this.state.isTracking = true;
        this.state.sessionCount++;
        
        document.getElementById('startBtn').disabled = true;
        document.getElementById('stopBtn').disabled = false;
        
        // Use watchPosition instead of polling with getCurrentPosition
        // watchPosition continuously monitors location without violating browser security
        if (navigator.geolocation) {
            this.watchId = navigator.geolocation.watchPosition(
                (position) => this.onLocationSuccess(position),
                (error) => this.onLocationError(error),
                this.config.geolocationOptions
            );
            
            this.debug('Using watchPosition for continuous tracking', 'info');
        }

        this.debug(`Tracking started (Watch active)`, 'success');
        this.setStatus('🟢 Tracking active', 'success');
        localStorage.setItem(`session_count_${this.state.userId}`, this.state.sessionCount);
        this.updateSessionCount();
    }

    /**
     * Stop location tracking
     */
    stopTracking() {
        if (!this.state.isTracking) {
            this.debug('Tracking not active', 'warning');
            return;
        }

        // Clear watch position
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
            this.debug('Cleared watchPosition', 'info');
        }

        // Clear interval if it exists
        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
            this.trackingInterval = null;
        }

        this.state.isTracking = false;
        
        document.getElementById('startBtn').disabled = false;
        document.getElementById('stopBtn').disabled = true;
        
        this.debug('Tracking stopped', 'info');
        this.setStatus('⏸️ Tracking stopped', 'info');
    }

    /**
     * Get current location
     */
    getLocation() {
        if (!navigator.geolocation) {
            this.debug('Geolocation API not available', 'error');
            return;
        }

        this.debug('Requesting location...', 'info');
        
        navigator.geolocation.getCurrentPosition(
            (position) => this.onLocationSuccess(position),
            (error) => this.onLocationError(error),
            this.config.geolocationOptions
        );
    }

    /**
     * Handle successful location retrieval
     */
    onLocationSuccess(position) {
        const { latitude, longitude, accuracy, altitude, heading, speed } = position.coords;
        const timestamp = new Date().toISOString();

        const locationData = {
            latitude,
            longitude,
            accuracy,
            altitude,
            heading,
            speed,
            timestamp
        };

        this.state.lastLocation = locationData;
        this.debug(
            `📍 Location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (±${accuracy.toFixed(0)}m)`,
            'success'
        );

        // Update UI
        this.updateLocationDisplay(locationData);
        
        // Send to backend
        this.sendToBackend(locationData);
    }

    /**
     * Handle location retrieval error
     */
    onLocationError(error) {
        const errorMessages = {
            1: '🔒 Permission denied - Enable location access',
            2: '📡 Position unavailable - Check GPS signal',
            3: '⏱️ Location request timeout',
            'default': '❌ Unknown geolocation error'
        };

        const message = errorMessages[error.code] || errorMessages.default;
        this.debug(message, 'error');
        this.setStatus(message, 'error');

        // Don't stop tracking on timeout, but do on permission denial
        if (error.code === 1) {
            this.stopTracking();
        }
    }

    /**
     * Send location data to backend
     */
    async sendToBackend(locationData) {
        const payload = {
            user_id: this.state.userId,
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            accuracy: locationData.accuracy,
            timestamp: locationData.timestamp
        };

        try {
            this.debug(`📤 Sending to: ${this.config.backendUrl}`, 'info');
            
            const response = await fetch(this.config.backendUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload),
                timeout: 10000 // 10 second timeout
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.debug(`✅ Data sent successfully (ID: ${data.id})`, 'success');
            
            // Add to local log
            this.addLocationLog(locationData);

        } catch (error) {
            const errorMsg = error.message || 'Unknown error';
            this.debug(`⚠️ Backend error: ${errorMsg}`, 'warning');
            this.debug(`📍 URL: ${this.config.backendUrl}`, 'warning');
            
            // Still add to local log even if backend fails
            this.addLocationLog(locationData);
        }
    }

    /**
     * Update location display in UI
     */
    updateLocationDisplay(data) {
        document.getElementById('currentLat').textContent = data.latitude.toFixed(6);
        document.getElementById('currentLon').textContent = data.longitude.toFixed(6);
        document.getElementById('currentAccuracy').textContent = `${data.accuracy.toFixed(0)}m`;
        document.getElementById('accuracyStatus').textContent = `${data.accuracy.toFixed(0)}m`;
        document.getElementById('currentTime').textContent = new Date(data.timestamp).toLocaleTimeString();
        document.getElementById('lastUpdateTime').textContent = new Date(data.timestamp).toLocaleTimeString();
    }

    /**
     * Add location to internal tracking
     */
    addLocationLog(data) {
        this.state.locations.push(data);
    }

    /**
     * Update device information
     */
    updateDeviceInfo() {
        document.getElementById('userID').textContent = this.state.userId;
        document.getElementById('deviceInfo').textContent = this.getDeviceInfo();
        document.getElementById('sessionCount').textContent = this.state.sessionCount;
    }

    /**
     * Get device information
     */
    getDeviceInfo() {
        const ua = navigator.userAgent;
        if (ua.includes('iPhone')) return 'iPhone';
        if (ua.includes('iPad')) return 'iPad';
        if (ua.includes('Android')) return 'Android';
        if (ua.includes('Windows')) return 'Windows';
        if (ua.includes('Mac')) return 'macOS';
        return 'Unknown Device';
    }

    /**
     * Get or create user ID
     */
    getUserId() {
        // Try to get from localStorage
        const savedUserId = localStorage.getItem('current_user_id');
        return savedUserId || null;
    }

    /**
     * Update session count display
     */
    updateSessionCount() {
        document.getElementById('sessionCount').textContent = this.state.sessionCount;
    }

    /**
     * Set status message
     */
    setStatus(message, type = 'info') {
        const statusText = document.getElementById('statusText');
        const statusDot = document.getElementById('statusDot');
        
        if (statusText) statusText.textContent = message;
        if (statusDot) {
            statusDot.className = `status-dot status-${type}`;
        }

        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    /**
     * Add debug log (simplified - no UI display)
     */
    debug(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const log = `[${timestamp}] ${message}`;
        
        this.state.debugLogs.push({ message, type, timestamp });
        if (this.state.debugLogs.length > this.config.maxDebugLogs) {
            this.state.debugLogs.shift();
        }

        const styles = {
            'info': 'color: #3498db;',
            'success': 'color: #27ae60; font-weight: bold;',
            'warning': 'color: #f39c12; font-weight: bold;',
            'error': 'color: #e74c3c; font-weight: bold;',
            'system': 'color: #95a5a6; font-style: italic;'
        };
        console.log(`%c${log}`, styles[type] || styles.info);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.geoflowTracker = new GeoFlowTracker();
});
