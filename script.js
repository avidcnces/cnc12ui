// CNC12 Controller JavaScript

class CNCController {
    constructor() {
        this.position = { x: 0, y: 0, z: 0, a: 0 };
        this.homed = { x: true, y: true, z: 'fault', a: false }; // Default: XYZ homed, A not homed, Z has fault
        this.units = 'mm';
        this.wcs = 'G54';
        this.isRunning = false;
        this.isConnected = false;
        this.feedrateOverride = 100;
        this.spindleOverride = 100;
        this.currentSpindleSpeed = 0;
        this.machineSpeed = 0;
        this.jogMode = 'continuous';
        this.jogSpeed = 'slow';
        this.jogIncrement = 0.1;
        
        // G-code statistics
        this.gcodeStats = {
            estimatedRuntime: 0, // in seconds
            toolChanges: 0,
            toolChangeDetails: [], // Added for list of tool changes
            fileSize: {
                bytes: 0,
                lines: 0
            },
            jobSize: {
                minX: null,
                maxX: null,
                minY: null,
                maxY: null,
                minZ: null,
                maxZ: null
            }
        };
        
        // Coolant and vacuum state
        this.coolantState = 'off'; // 'off', 'flood', 'mist'
        this.vacuumState = false;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateDisplay();
        this.simulateConnection();
        // Setup slide to reset after DOM is ready
        setTimeout(() => this.setupSlideToReset(), 100);
        // Initialize draggable cards with a delay to ensure SortableJS is loaded
        setTimeout(() => this.setupDraggableCards(), 200);
    }

    setupEventListeners() {
        // Theme dropdown
        document.querySelectorAll('[data-theme]').forEach(item => {
            item.addEventListener('click', this.changeTheme.bind(this));
        });

        // Units and WCS selectors
        document.getElementById('unitsSelect').addEventListener('change', this.changeUnits.bind(this));
        document.getElementById('wcsSelect').addEventListener('change', this.changeWCS.bind(this));

        // Machine control buttons
        document.getElementById('cycleStartBtn').addEventListener('click', this.cycleStart.bind(this));
        document.getElementById('stopBtn').addEventListener('click', this.stop.bind(this));
        document.getElementById('feedHoldBtn').addEventListener('click', this.feedHold.bind(this));

        // Slide to reset functionality
        this.setupSlideToReset();

        // Custom override sliders
        this.setupCustomSliders();

        // Override controls (keep for compatibility)
        document.getElementById('feedrateOverride').addEventListener('input', this.updateFeedrateOverride.bind(this));
        document.getElementById('spindleOverride').addEventListener('input', this.updateSpindleOverride.bind(this));

        // Jog controls
        document.getElementById('jogMode').addEventListener('change', this.changeJogMode.bind(this));
        document.getElementById('jogSpeed').addEventListener('change', this.changeJogSpeed.bind(this));
        document.getElementById('jogIncrement').addEventListener('change', this.changeJogIncrement.bind(this));

        // Jog buttons
        document.querySelectorAll('.jog-btn').forEach(btn => {
            btn.addEventListener('mousedown', this.startJog.bind(this));
            btn.addEventListener('mouseup', this.stopJog.bind(this));
            btn.addEventListener('mouseleave', this.stopJog.bind(this));
            btn.addEventListener('touchstart', this.startJog.bind(this));
            btn.addEventListener('touchend', this.stopJog.bind(this));
        });

        // Home button
        document.getElementById('homeXY').addEventListener('click', this.homeXY.bind(this));

        // Coolant controls
        document.getElementById('coolantFloodBtn').addEventListener('click', this.setCoolantFlood.bind(this));
        document.getElementById('coolantMistBtn').addEventListener('click', this.setCoolantMist.bind(this));
        document.getElementById('coolantOffBtn').addEventListener('click', this.setCoolantOff.bind(this));
        // Vacuum controls
        document.getElementById('vacuumOnBtn').addEventListener('click', this.setVacuumOn.bind(this));
        document.getElementById('vacuumOffBtn').addEventListener('click', this.setVacuumOff.bind(this));
        
        // Simulate DRO updates
        setInterval(this.simulateDROUpdates.bind(this), 100);
    }

    changeTheme(event) {
        event.preventDefault();
        const theme = event.target.dataset.theme;
        const html = document.documentElement;
        
        html.setAttribute('data-bs-theme', theme);
        localStorage.setItem('theme', theme);
        
        // Update dropdown button text
        const dropdownButton = document.getElementById('themeDropdown');
        const icon = event.target.querySelector('i').cloneNode(true);
        dropdownButton.innerHTML = '';
        dropdownButton.appendChild(icon);
        dropdownButton.appendChild(document.createTextNode(' ' + event.target.textContent.trim()));
        
        console.log(`Theme changed to: ${theme}`);
    }

    changeUnits(event) {
        this.units = event.target.value;
        this.updateDisplay();
        this.updateStatisticsDisplay(); // Update statistics with new units
        console.log(`Units changed to: ${this.units}`);
    }

    changeWCS(event) {
        this.wcs = event.target.value;
        console.log(`WCS changed to: ${this.wcs}`);
    }

    cycleStart() {
        this.isRunning = true;
        this.animateButton(document.getElementById('cycleStartBtn'));
        this.simulateMachineRunning();
        console.log('Cycle started');
    }

    stop() {
        this.isRunning = false;
        this.machineSpeed = 0;
        this.currentSpindleSpeed = 0;
        this.animateButton(document.getElementById('stopBtn'));
        this.updateSpeedDisplays();
        console.log('Machine stopped');
    }

    feedHold() {
        this.animateButton(document.getElementById('feedHoldBtn'));
        console.log('Feed hold activated');
    }

    reset() {
        this.isRunning = false;
        this.machineSpeed = 0;
        this.currentSpindleSpeed = 0;
        this.position = { x: 0, y: 0, z: 0, a: 0 };
        this.feedrateOverride = 100;
        this.spindleOverride = 100;
        
        // Reset UI elements
        document.getElementById('feedrateOverride').value = 100;
        document.getElementById('spindleOverride').value = 100;
        document.getElementById('feedrateValue').textContent = '100%';
        document.getElementById('spindleValue').textContent = '100%';
        
        this.animateButton(document.getElementById('resetBtn'));
        this.updateDisplay();
        console.log('Machine reset');
    }

    updateFeedrateOverride(event) {
        this.feedrateOverride = event.target.value;
        this.updateCustomSlider('feedrate', this.feedrateOverride);
    }

    updateSpindleOverride(event) {
        this.spindleOverride = event.target.value;
        this.updateCustomSlider('spindle', this.spindleOverride);
    }

    changeJogMode(event) {
        this.jogMode = event.target.value;
        console.log(`Jog mode changed to: ${this.jogMode}`);
    }

    changeJogSpeed(event) {
        this.jogSpeed = event.target.value;
        console.log(`Jog speed changed to: ${this.jogSpeed}`);
    }

    changeJogIncrement(event) {
        this.jogIncrement = parseFloat(event.target.value);
        console.log(`Jog increment changed to: ${this.jogIncrement}`);
    }

    startJog(event) {
        const btn = event.target.closest('.jog-btn');
        if (!btn) return;
        
        btn.classList.add('btn-pressed');
        const axis = btn.dataset.axis;
        const direction = btn.dataset.direction;
        
        this.jogActive = true;
        this.performJog(direction);
        
        if (this.jogMode === 'continuous') {
            this.jogInterval = setInterval(() => {
                if (this.jogActive) {
                    this.performJog(direction);
                }
            }, 100);
        }
        
        console.log(`Jogging ${direction}`);
    }

    stopJog(event) {
        const btn = event.target.closest('.jog-btn');
        if (!btn) return;
        
        btn.classList.remove('btn-pressed');
        this.jogActive = false;
        
        if (this.jogInterval) {
            clearInterval(this.jogInterval);
            this.jogInterval = null;
        }
    }

    performJog(direction) {
        const speed = this.jogSpeed === 'fast' ? 2 : 1;
        const increment = this.jogMode === 'incremental' ? this.jogIncrement : 0.1 * speed;
        
        switch (direction) {
            case 'x+':
                this.position.x += increment;
                break;
            case 'x-':
                this.position.x -= increment;
                break;
            case 'y+':
                this.position.y += increment;
                break;
            case 'y-':
                this.position.y -= increment;
                break;
            case 'z+':
                this.position.z += increment;
                break;
            case 'z-':
                this.position.z -= increment;
                break;
            case 'a+':
                this.position.a += increment;
                break;
            case 'a-':
                this.position.a -= increment;
                break;
            case 'x+y+':
                this.position.x += increment * 0.707;
                this.position.y += increment * 0.707;
                break;
            case 'x-y+':
                this.position.x -= increment * 0.707;
                this.position.y += increment * 0.707;
                break;
            case 'x+y-':
                this.position.x += increment * 0.707;
                this.position.y -= increment * 0.707;
                break;
            case 'x-y-':
                this.position.x -= increment * 0.707;
                this.position.y -= increment * 0.707;
                break;
        }
        
        this.updateDRODisplay();
    }

    homeXY() {
        this.position.x = 0;
        this.position.y = 0;
        this.homed.x = true;
        this.homed.y = true;
        this.animateButton(document.getElementById('homeXY'));
        this.updateDRODisplay();
        console.log('XY homed');
    }

    animateButton(button) {
        button.classList.add('btn-pressed');
        setTimeout(() => {
            button.classList.remove('btn-pressed');
        }, 200);
    }

    simulateConnection() {
        // Simulate connection status
        this.isConnected = true;
        // You could add connection status indicators here
        
        // Simulate some G-code statistics for demonstration
        this.simulateGcodeStats();
    }

    simulateGcodeStats() {
        // Simulate G-code statistics with realistic values
        this.gcodeStats = {
            estimatedRuntime: 4560, // 1 hour 16 minutes in seconds
            toolChanges: 5,
            toolChangeDetails: [ // Added more tool change details for testing scroll
                { toolNumber: 1, line: 89, description: "Face Mill 25mm" },
                { toolNumber: 2, line: 245, description: "Roughing Endmill 8mm" },
                { toolNumber: 3, line: 567, description: "Finishing Endmill 6mm" },
                { toolNumber: 4, line: 834, description: "Ballnose 4mm R2" },
                { toolNumber: 5, line: 1156, description: "Drill 3.2mm" }
            ],
            fileSize: {
                bytes: 67840, // ~66.2 KB
                lines: 1789
            },
            jobSize: {
                minX: -42.5,
                maxX: 87.3,
                minY: -28.9,
                maxY: 45.6,
                minZ: -12.7,
                maxZ: 2.0
            }
        };
        this.updateStatisticsDisplay();
    }

    updateDisplay() {
        this.updateDRODisplay();
        this.updateSpeedDisplays();
        this.updateCoolantButtons();
        this.updateVacuumButtons();
    }

    updateDRODisplay() {
        // Update DRO with current position
        const precision = this.units === 'mm' ? 3 : 4;
        document.getElementById('droX').value = this.position.x.toFixed(precision);
        document.getElementById('droY').value = this.position.y.toFixed(precision);
        document.getElementById('droZ').value = this.position.z.toFixed(precision);
        document.getElementById('droA').value = this.position.a.toFixed(precision);

        // Update homed status badges
        this.updateHomedStatus('X', this.homed.x);
        this.updateHomedStatus('Y', this.homed.y);
        this.updateHomedStatus('Z', this.homed.z);
        this.updateHomedStatus('A', this.homed.a);
    }

    updateHomedStatus(axis, status) {
        const badge = document.getElementById(`homed${axis}`);
        if (status === true) {
            badge.textContent = 'Homed';
            badge.className = 'badge bg-success ms-2 dro-homed-badge';
        } else if (status === 'fault') {
            badge.textContent = 'Fault';
            badge.className = 'badge bg-danger ms-2 dro-homed-badge';
        } else {
            badge.textContent = 'Not Homed';
            badge.className = 'badge bg-warning ms-2 dro-homed-badge';
        }
    }

    updateStatisticsDisplay() {
        // Update runtime display
        const hours = Math.floor(this.gcodeStats.estimatedRuntime / 3600);
        const minutes = Math.floor((this.gcodeStats.estimatedRuntime % 3600) / 60);
        const seconds = this.gcodeStats.estimatedRuntime % 60;
        const runtimeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('estimatedRuntime').textContent = runtimeStr;

        // Update job size display
        if (this.gcodeStats.jobSize.minX !== null && this.gcodeStats.jobSize.maxX !== null) {
            const xSize = (this.gcodeStats.jobSize.maxX - this.gcodeStats.jobSize.minX).toFixed(1);
            const ySize = (this.gcodeStats.jobSize.maxY - this.gcodeStats.jobSize.minY).toFixed(1);
            const zSize = (this.gcodeStats.jobSize.maxZ - this.gcodeStats.jobSize.minZ).toFixed(1);
            const units = this.units;
            document.getElementById('jobSizeDisplay').textContent = `${xSize} × ${ySize} × ${zSize} ${units}`;
        } else {
            document.getElementById('jobSizeDisplay').textContent = '-- × -- × --';
        }

        // Update file size display
        const fileSizeKb = (this.gcodeStats.fileSize.bytes / 1024).toFixed(1);
        document.getElementById('fileSizeKb').textContent = `${fileSizeKb} KB`;
        document.getElementById('fileSizeLines').textContent = `${this.gcodeStats.fileSize.lines} lines`;

        // Update tool changes display
        document.getElementById('toolChanges').textContent = this.gcodeStats.toolChanges;
        
        const toolChangesList = document.getElementById('toolChangesList');
        if (this.gcodeStats.toolChangeDetails && this.gcodeStats.toolChangeDetails.length > 0) {
            toolChangesList.innerHTML = this.gcodeStats.toolChangeDetails
                .map(tool => `<div class="small">T${tool.number}: ${tool.description}</div>`)
                .join('');
        } else {
            toolChangesList.innerHTML = '<div class="text-muted small">No tool changes</div>';
        }
    }

    simulateDROUpdates() {
        // Add small random fluctuations to simulate real machine behavior
        if (this.isRunning) {
            const fluctuation = 0.001; // 0.001mm fluctuation
            this.position.x += (Math.random() - 0.5) * fluctuation;
            this.position.y += (Math.random() - 0.5) * fluctuation;
            this.position.z += (Math.random() - 0.5) * fluctuation;
            this.updateDRODisplay();
        }
    }

    simulateMachineRunning() {
        if (this.isRunning) {
            // Simulate varying machine speed and spindle speed
            this.machineSpeed = Math.floor(Math.random() * 1000 + 500); // 500-1500 mm/min
            this.currentSpindleSpeed = Math.floor(Math.random() * 2000 + 8000); // 8000-10000 RPM
            this.updateSpeedDisplays();
            
            // Continue simulation
            setTimeout(() => {
                if (this.isRunning) {
                    this.simulateMachineRunning();
                }
            }, 1000 + Math.random() * 2000); // Update every 1-3 seconds
        }
    }

    updateSpeedDisplays() {
        const units = this.units === 'mm' ? 'mm/min' : 'in/min';
        document.getElementById('machineSpeed').textContent = `${this.machineSpeed} ${units}`;
        document.getElementById('currentSpindleSpeed').textContent = `${this.currentSpindleSpeed} RPM`;
    }

    // Coolant control methods
    setCoolantFlood() {
        this.coolantState = 'flood';
        this.updateCoolantButtons();
        this.animateButton(document.getElementById('coolantFloodBtn'));
        console.log('Coolant flood activated');
    }
    setCoolantMist() {
        this.coolantState = 'mist';
        this.updateCoolantButtons();
        this.animateButton(document.getElementById('coolantMistBtn'));
        console.log('Coolant mist activated');
    }
    setCoolantOff() {
        this.coolantState = 'off';
        this.updateCoolantButtons();
        this.animateButton(document.getElementById('coolantOffBtn'));
        console.log('Coolant turned off');
    }
    // Vacuum control methods
    setVacuumOn() {
        this.vacuumState = true;
        this.updateVacuumButtons();
        this.animateButton(document.getElementById('vacuumOnBtn'));
        console.log('Vacuum turned on');
    }
    setVacuumOff() {
        this.vacuumState = false;
        this.updateVacuumButtons();
        this.animateButton(document.getElementById('vacuumOffBtn'));
        console.log('Vacuum turned off');
    }
    // Update button states for coolant controls
    updateCoolantButtons() {
        const floodBtn = document.getElementById('coolantFloodBtn');
        const mistBtn = document.getElementById('coolantMistBtn');
        const offBtn = document.getElementById('coolantOffBtn');
        // Reset all buttons to outline style
        floodBtn.className = 'btn btn-outline-primary w-100';
        mistBtn.className = 'btn btn-outline-info w-100';
        offBtn.className = 'btn btn-outline-secondary w-100';
        // Highlight the active button
        switch (this.coolantState) {
            case 'flood':
                floodBtn.className = 'btn btn-primary w-100';
                break;
            case 'mist':
                mistBtn.className = 'btn btn-info w-100';
                break;
            case 'off':
                offBtn.className = 'btn btn-secondary w-100';
                break;
        }
    }
    // Update button states for vacuum controls
    updateVacuumButtons() {
        const onBtn = document.getElementById('vacuumOnBtn');
        const offBtn = document.getElementById('vacuumOffBtn');
        if (this.vacuumState) {
            onBtn.className = 'btn btn-success w-100';
            offBtn.className = 'btn btn-outline-danger w-100';
        } else {
            onBtn.className = 'btn btn-outline-success w-100';
            offBtn.className = 'btn btn-danger w-100';
        }
    }

    // Load dark mode preference
    loadThemePreference() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        const html = document.documentElement;
        const dropdownButton = document.getElementById('themeDropdown');
        
        html.setAttribute('data-bs-theme', savedTheme);
        
        // Update dropdown button to show current theme
        const themeIcons = {
            light: '<i class="bi bi-sun-fill me-1"></i>',
            dark: '<i class="bi bi-moon-fill me-1"></i>',
            red: '<i class="bi bi-circle-fill me-1" style="color: #dc3545;"></i>'
        };
        
        const themeNames = {
            light: 'Light',
            dark: 'Dark', 
            red: 'Red'
        };
        
        dropdownButton.innerHTML = themeIcons[savedTheme] + themeNames[savedTheme];
    }

    // Setup custom pill-shaped sliders
    setupCustomSliders() {
        this.setupCustomSlider('feedrate', 'feedrateOverride', 'feedrateThumb', 'feedrateTrack');
        this.setupCustomSlider('spindle', 'spindleOverride', 'spindleThumb', 'spindleTrack');
    }

    setupCustomSlider(type, inputId, thumbId, trackId) {
        const input = document.getElementById(inputId);
        const thumb = document.getElementById(thumbId);
        const track = document.getElementById(trackId);
        
        if (!input || !thumb || !track) return;

        let isDragging = false;
        let startX = 0;
        let startValue = parseInt(input.value);
        let trackRect = null;

        // Initialize position and color
        this.updateCustomSlider(type, parseInt(input.value));

        // Mouse events
        thumb.addEventListener('mousedown', startDrag);
        track.addEventListener('mousedown', jumpToPosition);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', endDrag);

        // Touch events
        thumb.addEventListener('touchstart', startDrag, { passive: false });
        track.addEventListener('touchstart', jumpToPosition, { passive: false });
        document.addEventListener('touchmove', drag, { passive: false });
        document.addEventListener('touchend', endDrag);

        function startDrag(e) {
            if (e.target !== thumb && !thumb.contains(e.target)) return;
            
            isDragging = true;
            startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
            startValue = parseInt(input.value);
            trackRect = track.getBoundingClientRect();
            
            e.preventDefault();
            e.stopPropagation();
        }

        function jumpToPosition(e) {
            if (e.target === thumb || thumb.contains(e.target)) return;
            
            const rect = track.getBoundingClientRect();
            const clickX = (e.type.includes('touch') ? e.touches[0].clientX : e.clientX) - rect.left;
            const thumbWidth = 80;
            const availableWidth = rect.width - thumbWidth - 8; // Account for margins
            
            // Calculate percentage based on click position
            const percentage = Math.max(0, Math.min(1, (clickX - thumbWidth/2) / availableWidth));
            const newValue = Math.round(10 + percentage * 190);
            
            input.value = newValue;
            input.dispatchEvent(new Event('input'));
        }

        function drag(e) {
            if (!isDragging || !trackRect) return;
            
            const currentX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
            const deltaX = currentX - startX;
            
            // Calculate available width for dragging
            const thumbWidth = 80;
            const availableWidth = trackRect.width - thumbWidth - 8;
            
            // Convert delta pixels to value change
            const valueRange = 190; // 200 - 10
            const deltaValue = (deltaX / availableWidth) * valueRange;
            
            // Calculate new value
            const newValue = Math.round(Math.max(10, Math.min(200, startValue + deltaValue)));
            
            if (newValue !== parseInt(input.value)) {
                input.value = newValue;
                input.dispatchEvent(new Event('input'));
            }
            
            e.preventDefault();
        }

        function endDrag() {
            isDragging = false;
            trackRect = null;
        }
    }

    updateCustomSlider(type, value) {
        const thumbId = type === 'feedrate' ? 'feedrateThumb' : 'spindleThumb';
        const trackId = type === 'feedrate' ? 'feedrateTrack' : 'spindleTrack';
        
        const thumb = document.getElementById(thumbId);
        const track = document.getElementById(trackId);
        
        if (!thumb || !track) return;

        // Update value display
        const valueSpan = thumb.querySelector('.slider-value');
        if (valueSpan) {
            valueSpan.textContent = `${value}%`;
        }

        // Calculate position more accurately
        const trackRect = track.getBoundingClientRect();
        const trackWidth = trackRect.width || track.offsetWidth;
        const thumbWidth = 80;
        const margin = 4;
        const availableWidth = trackWidth - thumbWidth - (margin * 2);
        
        // Value 10-200 maps to position 0 to availableWidth
        const percentage = (value - 10) / 190;
        const position = margin + (percentage * availableWidth);
        
        // Apply position without transition during drag for smoother movement
        const wasDragging = thumb.style.transition === 'none';
        if (!wasDragging) {
            thumb.style.transition = 'none';
        }
        
        thumb.style.left = `${Math.round(position)}px`;
        
        // Restore transition after a frame
        if (!wasDragging) {
            requestAnimationFrame(() => {
                thumb.style.transition = 'box-shadow 0.2s ease, transform 0.1s ease';
            });
        }

        // Update color based on distance from 100%
        const distance = Math.abs(value - 100);
        thumb.classList.remove('warning', 'danger');
        
        if (distance <= 10) {
            // Normal - gray
        } else if (distance <= 30) {
            thumb.classList.add('warning');
        } else {
            thumb.classList.add('danger');
        }

        // Update property for backward compatibility
        if (type === 'feedrate') {
            this.feedrateOverride = value;
        } else {
            this.spindleOverride = value;
        }
    }

    setupSlideToReset() {
        const thumb = document.getElementById('resetSlider');
        const track = document.getElementById('resetTrack');
        
        if (!thumb || !track) {
            console.log('Slide to reset elements not found');
            return;
        }
        
        console.log('Setting up slide to reset functionality');
        
        const thumbWidth = 42; // Fixed width from CSS
        let maxDistance = 0;
        
        // Calculate max distance on resize and initially
        const updateMaxDistance = () => {
            maxDistance = track.offsetWidth - thumbWidth - 8; // 8px for padding (4px each side)
            console.log('Max distance:', maxDistance);
        };
        
        updateMaxDistance();
        window.addEventListener('resize', updateMaxDistance);
        
        let isDragging = false;
        let startX = 0;
        let currentX = 0;

        // Mouse events
        thumb.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', endDrag);

        // Touch events for mobile
        thumb.addEventListener('touchstart', startDrag);
        document.addEventListener('touchmove', drag);
        document.addEventListener('touchend', endDrag);

        const self = this; // Store reference to 'this'

        function startDrag(e) {
            console.log('Start drag');
            isDragging = true;
            startX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
            track.classList.add('sliding');
            e.preventDefault();
        }

        function drag(e) {
            if (!isDragging) return;
            
            const clientX = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX;
            const deltaX = clientX - startX;
            currentX = Math.max(0, Math.min(deltaX, maxDistance));
            
            thumb.style.transform = `translateX(${currentX}px)`;
            
            // Update background progress
            const progress = maxDistance > 0 ? (currentX / maxDistance) * 100 : 0;
            track.style.backgroundSize = `${progress}% 100%`;
            
            e.preventDefault();
        }

        function endDrag(e) {
            if (!isDragging) return;
            isDragging = false;
            
            const progress = maxDistance > 0 ? (currentX / maxDistance) * 100 : 0;
            console.log('End drag, progress:', progress);
            
            if (progress >= 80) { // 80% threshold for activation
                console.log('Reset triggered!');
                // Complete the slide
                thumb.style.transform = `translateX(${maxDistance}px)`;
                track.style.backgroundSize = '100% 100%';
                track.classList.add('completed');
                track.classList.add('reset-complete');
                
                // Trigger reset after short delay
                setTimeout(() => {
                    self.reset(); // Use stored reference
                    resetSlider();
                }, 300);
            } else {
                // Reset to start position
                resetSlider();
            }
            
            track.classList.remove('sliding');
        }

        function resetSlider() {
            thumb.style.transform = 'translateX(0px)';
            track.style.backgroundSize = '0% 100%';
            track.classList.remove('completed', 'reset-complete');
            currentX = 0;
        }
    }

    reset() {
        console.log('Machine Reset triggered via slide');
        this.isRunning = false;
        this.machineSpeed = 0;
        this.currentSpindleSpeed = 0;
        this.position = { x: 0, y: 0, z: 0, a: 0 };
        this.feedrateOverride = 100;
        this.spindleOverride = 100;
        
        // Reset UI elements
        document.getElementById('feedrateOverride').value = 100;
        document.getElementById('spindleOverride').value = 100;
        document.getElementById('feedrateValue').textContent = '100%';
        document.getElementById('spindleValue').textContent = '100%';
        
        this.updateDisplay();
        this.showNotification('Machine Reset Complete', 'success');
    }

    showNotification(message, type = 'info') {
        console.log(`${type.toUpperCase()}: ${message}`);
        
        // Create and show notification
        const notification = document.createElement('div');
        notification.className = `alert alert-${type === 'success' ? 'success' : 'info'} position-fixed`;
        notification.style.cssText = 'top: 80px; right: 20px; z-index: 9999; min-width: 250px;';
        notification.innerHTML = `
            <i class="bi bi-${type === 'success' ? 'check-circle' : 'info-circle'} me-2"></i>
            ${message}
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // Draggable Cards functionality
    setupDraggableCards() {
        const sortableContainer = document.getElementById('sortable-cards');
        
        if (!sortableContainer) {
            console.warn('Sortable container not found');
            return;
        }
        
        // Check if SortableJS is loaded
        if (typeof Sortable === 'undefined') {
            console.warn('SortableJS library not loaded');
            return;
        }
        
        console.log('Initializing SortableJS...');
        
        // Initialize SortableJS
        const sortable = Sortable.create(sortableContainer, {
            handle: '.drag-handle',
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            animation: 150,
            onEnd: (evt) => {
                console.log('Card moved from', evt.oldIndex, 'to', evt.newIndex);
                // Save the new order
                this.saveCardOrder();
            }
        });
        
        console.log('SortableJS initialized successfully');
        
        // Load saved order on initialization
        this.loadCardOrder();
    }

    saveCardOrder() {
        const cards = document.querySelectorAll('#sortable-cards .card[data-card-id]');
        const order = Array.from(cards).map(card => card.dataset.cardId);
        localStorage.setItem('cncControllerCardOrder', JSON.stringify(order));
    }

    loadCardOrder() {
        const savedOrder = localStorage.getItem('cncControllerCardOrder');
        
        if (!savedOrder) {
            return; // No saved order, keep default
        }
        
        try {
            const order = JSON.parse(savedOrder);
            const container = document.getElementById('sortable-cards');
            
            if (!container || !Array.isArray(order)) {
                return;
            }
            
            // Reorder cards based on saved order
            order.forEach(cardId => {
                const card = container.querySelector(`[data-card-id="${cardId}"]`);
                if (card) {
                    container.appendChild(card);
                }
            });
        } catch (error) {
            console.warn('Failed to load card order:', error);
        }
    }
}

// Initialize the controller when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const controller = new CNCController();
    controller.loadThemePreference();
    
    // Expose controller to global scope for debugging
    window.cncController = controller;
    
    console.log('CNC12 Controller initialized');
});

// Keyboard shortcuts
document.addEventListener('keydown', (event) => {
    if (event.target.tagName.toLowerCase() === 'input') return;
    
    switch (event.code) {
        case 'Space':
            event.preventDefault();
            document.getElementById('cycleStartBtn').click();
            break;
        case 'Escape':
            event.preventDefault();
            document.getElementById('stopBtn').click();
            break;
        case 'KeyH':
            if (event.ctrlKey) {
                event.preventDefault();
                document.getElementById('homeXY').click();
            }
            break;
        case 'ArrowUp':
            if (event.shiftKey) {
                event.preventDefault();
                // Simulate Y+ jog
                const yPlusBtn = document.querySelector('[data-direction="y+"]');
                if (yPlusBtn) yPlusBtn.click();
            }
            break;
        case 'ArrowDown':
            if (event.shiftKey) {
                event.preventDefault();
                // Simulate Y- jog
                const yMinusBtn = document.querySelector('[data-direction="y-"]');
                if (yMinusBtn) yMinusBtn.click();
            }
            break;
        case 'ArrowLeft':
            if (event.shiftKey) {
                event.preventDefault();
                // Simulate X- jog
                const xMinusBtn = document.querySelector('[data-direction="x-"]');
                if (xMinusBtn) xMinusBtn.click();
            }
            break;
        case 'ArrowRight':
            if (event.shiftKey) {
                event.preventDefault();
                // Simulate X+ jog
                const xPlusBtn = document.querySelector('[data-direction="x+"]');
                if (xPlusBtn) xPlusBtn.click();
            }
            break;
    }
});

// Prevent context menu on jog buttons for better touch experience
document.querySelectorAll('.jog-btn').forEach(btn => {
    btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
});
