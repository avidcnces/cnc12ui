# CNC12 Controller UI

A modern, responsive Bootstrap-based user interface for CNC machine control, designed specifically for CNC12 systems.

## Features

### Left Panel (Control Panel)

#### Digital Readout (DRO)
- **XYZ and A axis position display** with high precision
- **Units selector**: Switch between Millimeters and Inches
- **WCS selector**: Choose between G54, G55, G56, G57, G58, G59 coordinate systems
- **Real-time position updates** with simulated machine behavior

#### Machine Control
- **Cycle Start**: Begin program execution
- **Stop**: Emergency stop functionality
- **Feed Hold**: Pause current operation
- **Reset**: Reset machine state and position

#### Override Controls
- **Feed Rate Override**: 10% to 200% control with real-time slider
- **Spindle Override**: 10% to 200% control with real-time slider
- **Current Spindle Speed display**: Live RPM readout
- **Machine Speed display**: Current movement speed in mm/min or in/min

#### Jog Controls
- **Joystick-style XY controls**: 9-button directional pad with diagonal movement
- **Z-axis controls**: Up/down movement buttons
- **A-axis controls**: Rotational movement (clockwise/counterclockwise)
- **Operating modes**:
  - Continuous: Hold button for continuous movement
  - Incremental: Single step movement per button press
- **Speed settings**: Fast and Slow modes
- **Increment settings**: 0.01, 0.1, 1.0, 10.0 units
- **Home function**: Return XY to zero position

### Right Panel (Visualization & Stats)

#### G-code Preview
- **Tabbed interface** with 2D and 3D view options
- **2D View**: Top-down toolpath visualization
- **3D View**: Three-dimensional part preview
- **Ready for G-code file integration**

#### G-code Statistics
- **Estimated Runtime**: Calculated program execution time
- **Tool Changes**: Number of tool change operations
- **Distance Cut**: Total cutting distance calculation

### User Interface Features

#### Dark/Light Mode
- **Toggle switch** in the navigation bar
- **Persistent setting**: Remembers preference in localStorage
- **Smooth transitions** between themes

#### Responsive Design
- **Mobile-friendly**: Adapts to different screen sizes
- **Touch-optimized**: Enhanced for tablet and touchscreen use
- **Keyboard shortcuts**: Space (Cycle Start), Escape (Stop), Ctrl+H (Home), Shift+Arrows (Jog)

## Technical Implementation

### Technologies Used
- **Bootstrap 5.3**: Modern responsive framework
- **Bootstrap Icons**: Comprehensive icon library
- **Vanilla JavaScript**: No framework dependencies
- **CSS Grid & Flexbox**: Advanced layout techniques
- **LocalStorage**: Persistent user preferences

### Browser Compatibility
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Usage

### Getting Started
1. Open `index.html` in a modern web browser
2. The interface will load with default settings
3. Use the dark/light mode toggle in the top navigation

### Jog Controls
- **Continuous Mode**: Hold jog buttons for continuous movement
- **Incremental Mode**: Click jog buttons for precise step movement
- **Speed Control**: Switch between fast and slow movement speeds
- **Increment Selection**: Choose step size for incremental mode

### Override Controls
- **Drag sliders** to adjust feed rate and spindle speed overrides
- **Real-time feedback** shows percentage values
- **Live displays** show current spindle speed and machine movement speed

### Keyboard Shortcuts
- `Spacebar`: Cycle Start
- `Escape`: Stop
- `Ctrl + H`: Home XY axes
- `Shift + Arrow Keys`: Jog in corresponding direction

## Customization

### Adding Real CNC Integration
To connect this UI to an actual CNC controller:

1. **WebSocket Connection**: Replace simulation functions with real WebSocket communication
2. **API Integration**: Connect to your CNC controller's REST API
3. **Real DRO Updates**: Replace `simulateDROUpdates()` with actual position polling
4. **Command Execution**: Replace console.log statements with actual G-code commands

### Styling Customization
- Modify `styles.css` to change colors, sizes, and layout
- Update CSS custom properties (`:root` variables) for theme adjustments
- Add your company branding to the navigation bar

### Feature Extensions
- **File Upload**: Add G-code file loading functionality
- **Program Editor**: Integrate a G-code editor
- **Tool Library**: Add tool management features
- **Macro Buttons**: Create custom function buttons
- **Alarm System**: Add error and alarm displays

## File Structure
```
CNC12 UI 1/
├── index.html      # Main HTML structure
├── styles.css      # Custom CSS styling
├── script.js       # JavaScript functionality
└── README.md       # This documentation
```

## Development Notes

### Simulation Features
The current implementation includes simulation for:
- DRO position updates with realistic fluctuations
- Machine running states with varying speeds
- Jog movement with proper axis calculations
- Override control responses

### Future Enhancements
- G-code parser integration
- Real-time toolpath visualization
- Advanced statistics and analytics
- Network connectivity status
- Multi-machine support
- Historical data logging

## License
This project is designed for CNC12 controller systems. Please ensure compliance with your CNC software licensing when integrating with actual hardware.

## Support
For technical support or feature requests, please consult your CNC12 system documentation or contact your system integrator.
