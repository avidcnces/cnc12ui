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
