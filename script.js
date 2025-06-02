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
            jobSize: {
                minX: null,
                maxX: null,
                minY: null,
                maxY: null,
                minZ: null,
                maxZ: null
            }
        };
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateDisplay();
        this.simulateConnection();
    }

    setupEventListeners() {
        // Dark mode toggle
        const darkModeToggle = document.getElementById('darkModeToggle');
        darkModeToggle.addEventListener('change', this.toggleDarkMode.bind(this));

        // Units and WCS selectors
        document.getElementById('unitsSelect').addEventListener('change', this.changeUnits.bind(this));
        document.getElementById('wcsSelect').addEventListener('change', this.changeWCS.bind(this));

        // Machine control buttons
        document.getElementById('cycleStartBtn').addEventListener('click', this.cycleStart.bind(this));
        document.getElementById('stopBtn').addEventListener('click', this.stop.bind(this));
        document.getElementById('feedHoldBtn').addEventListener('click', this.feedHold.bind(this));
        document.getElementById('resetBtn').addEventListener('click', this.reset.bind(this));

        // Override controls
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

        // Simulate DRO updates
        setInterval(this.simulateDROUpdates.bind(this), 100);
    }

    toggleDarkMode() {
        const darkModeToggle = document.getElementById('darkModeToggle');
        const html = document.documentElement;
        
        if (darkModeToggle.checked) {
            html.setAttribute('data-bs-theme', 'dark');
            localStorage.setItem('darkMode', 'true');
        } else {
            html.setAttribute('data-bs-theme', 'light');
            localStorage.setItem('darkMode', 'false');
        }
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
        this.animateButton(document.getElementById('resetBtn'));
        this.updateDisplay();
        console.log('Machine reset');
    }

    updateFeedrateOverride(event) {
        this.feedrateOverride = event.target.value;
        document.getElementById('feedrateValue').textContent = `${this.feedrateOverride}%`;
    }

    updateSpindleOverride(event) {
        this.spindleOverride = event.target.value;
        document.getElementById('spindleValue').textContent = `${this.spindleOverride}%`;
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
            estimatedRuntime: 3720, // 1 hour 2 minutes in seconds
            toolChanges: 3,
            toolChangeDetails: [ // Added example tool change details
                { toolNumber: 1, line: 150, description: "Roughing Endmill 6mm" },
                { toolNumber: 2, line: 450, description: "Finishing Ballnose 3mm" },
                { toolNumber: 3, line: 780, description: "Drill 2mm" }
            ],
            jobSize: {
                minX: -25.4,
                maxX: 76.2,
                minY: -12.7,
                maxY: 50.8,
                minZ: -6.35,
                maxZ: 0
            }
        };
        this.updateStatisticsDisplay();
    }

    updateStatisticsDisplay() {
        // Update basic statistics
        const hours = Math.floor(this.gcodeStats.estimatedRuntime / 3600);
        const minutes = Math.floor((this.gcodeStats.estimatedRuntime % 3600) / 60);
        const seconds = this.gcodeStats.estimatedRuntime % 60;
        const runtimeText = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        document.getElementById('estimatedRuntime').textContent = runtimeText;

        // Update job size and tool changes
        if (this.gcodeStats.jobSize.minX !== null) {
            const unit = this.units;
            
            // Calculate sizes
            const xSizeVal = this.gcodeStats.jobSize.maxX - this.gcodeStats.jobSize.minX;
            const ySizeVal = this.gcodeStats.jobSize.maxY - this.gcodeStats.jobSize.minY;
            const zDepthVal = Math.abs(this.gcodeStats.jobSize.maxZ - this.gcodeStats.jobSize.minZ);

            // Combined Job Size Display (in the top row)
            document.getElementById('jobSizeDisplay').textContent = 
                `${xSizeVal.toFixed(2)} × ${ySizeVal.toFixed(2)} × ${zDepthVal.toFixed(2)} ${unit}`;

            // Tool Changes Card
            document.getElementById('toolChanges').textContent = this.gcodeStats.toolChanges;
            const toolChangesListEl = document.getElementById('toolChangesList');
            toolChangesListEl.innerHTML = ''; // Clear previous list

            if (this.gcodeStats.toolChangeDetails && this.gcodeStats.toolChangeDetails.length > 0) {
                const ul = document.createElement('ul');
                ul.classList.add('list-unstyled', 'mb-0', 'small');
                this.gcodeStats.toolChangeDetails.forEach(tc => {
                    const li = document.createElement('li');
                    li.innerHTML = `<i class="bi bi-arrow-right-short"></i> T${tc.toolNumber} (Line ${tc.line}): ${tc.description || 'No description'}`;
                    ul.appendChild(li);
                });
                toolChangesListEl.appendChild(ul);
            } else {
                toolChangesListEl.innerHTML = '<div class="text-muted small">No tool changes</div>';
            }

        } else {
            // No G-code loaded - reset displays
            document.getElementById('jobSizeDisplay').textContent = '-- × -- × --';
            
            document.getElementById('toolChanges').textContent = '0';
            document.getElementById('toolChangesList').innerHTML = '<div class="text-muted small">No tool changes</div>';
        }
    }

    // Load dark mode preference
    loadDarkModePreference() {
        const darkMode = localStorage.getItem('darkMode');
        const darkModeToggle = document.getElementById('darkModeToggle');
        const html = document.documentElement;
        
        if (darkMode === 'true') {
            darkModeToggle.checked = true;
            html.setAttribute('data-bs-theme', 'dark');
        }
    }
}

// Initialize the controller when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const controller = new CNCController();
    controller.loadDarkModePreference();
    
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
