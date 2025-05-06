# Architecture Overview

## Overview

This application is a zombie-themed robot management platform that enables control and monitoring of physical robots or a demo mode with simulated robots. The system provides an interface for users to interact with robots, manage their movements, monitor their status, and coordinate multi-robot operations including elevator integration for multi-floor navigation.

The application uses a client-server architecture with a TypeScript/JavaScript backend, a web-based frontend, and various protocols for robot communication including REST API and WebSockets for real-time data exchange.

## System Architecture

The system follows a three-tier architecture:

1. **Frontend**: A React-based web application using modern UI components from Radix UI and styling with Tailwind CSS
2. **Backend**: A Node.js server using Express for API endpoints and WebSockets for real-time communication
3. **Robot Integration Layer**: Scripts and protocols for communicating with physical robots or a simulation layer for demo purposes

### Core Technologies

- **Frontend**: React, Tailwind CSS, Radix UI, Shadcn components
- **Backend**: Node.js, Express
- **Database**: PostgreSQL with Drizzle ORM for schema management
- **Authentication**: Session-based authentication with password hashing using scrypt
- **Real-time Communication**: WebSockets for live updates between robots and the server
- **Robot Integration**: REST API and WebSocket protocols for robot communication

## Key Components

### User Management System

The platform implements a role-based access control system with admin and regular user roles. User credentials are stored securely with password hashing using the scrypt algorithm. Several utility scripts (`add-admin-user.js`, `create-test-user.js`, etc.) are included to manage users.

### Robot Communication Layer

Two primary methods are provided for robot communication:

1. **REST API**: Handles registration, status updates, position updates, and command execution through HTTP endpoints
2. **WebSocket**: Provides real-time bidirectional communication for more efficient data exchange, especially for position tracking and sensor data

Example client implementations are provided in `robot-client.js` (REST) and `robot-ws-client.js` (WebSocket).

### Robot AI Modules

The system includes several Python modules for robot management:

- **Core Module** (`robot-ai-core.py`): Main entry point providing robot control and autonomous capabilities
- **Camera Module** (`robot-ai-camera-module.py`): Camera feed processing and video streaming
- **Map Visualization** (`robot-ai-map-visualizer.py`): Map data processing and visualization
- **Elevator Controller** (`robot-ai-elevator-controller.py`, `robot-ai-elevator-module.py`): Multi-floor navigation
- **Door Control** (`robot-ai-door-module.py`): Automatic door management
- **Task Queue** (`robot-ai-task-queue.py`): FIFO queue for robot task management
- **IoT Integration** (`robot-ai-iot-module.py`): Communication with IoT devices

### Installer and Deployment Tools

Multiple installation methods are provided:

- Simple batch installers (`install-simple.bat`, `install-minimal.bat`)
- Python installers (`robot-ai-installer.py`, `minimal-installer.py`, `robot-uploader.py`)
- Shell scripts (`auto-installer.sh`, `remote-installer.sh`)
- Self-extracting installers (`robot-ai-self-extractor.py`, `robot-ai-single-file-installer.py`)

These tools handle different deployment scenarios, including Android-based robots with content URI considerations.

### Storage Layer

The application uses two storage mechanisms:

1. **PostgreSQL Database**: Primary data storage using Drizzle ORM for schema management
2. **Memory Storage**: A fallback/alternative storage mechanism for development or when database access is limited

## Data Flow

### User Authentication Flow

1. User provides credentials via the login interface
2. Server validates credentials and creates a session
3. Session token is stored in cookies and used for subsequent requests
4. Access to protected resources is controlled based on user role

### Robot Registration Flow

1. Robot client connects to the server via REST API or WebSocket
2. Robot provides identifying information (serial number, model)
3. Server registers the robot if not already registered
4. Server assigns a template ID if specified

### Robot Communication Flow

#### REST API Method:
1. Robot client makes HTTP requests to update status, position, or send sensor data
2. Server processes the updates and stores relevant data
3. Frontend polls for updates or receives push notifications for changes

#### WebSocket Method:
1. Robot establishes a persistent WebSocket connection
2. Real-time data is streamed in both directions
3. Server processes incoming data and broadcasts relevant updates to connected clients
4. Frontend maintains its own WebSocket connection to receive real-time updates

### Task Assignment Flow

1. User creates a task for a robot through the frontend
2. Server adds the task to the robot's queue
3. Robot receives task assignment through WebSocket or by polling the REST API
4. Robot executes the task and reports progress/completion
5. Server updates task status and notifies the frontend

## External Dependencies

The application has the following key external dependencies:

1. **Radix UI Components**: Comprehensive set of accessible UI components
2. **Tailwind CSS**: Utility-first CSS framework for styling
3. **Drizzle ORM**: Database ORM for PostgreSQL
4. **TanStack React Query**: Data fetching and state management
5. **Axios**: HTTP client for API requests
6. **WebSocket**: Real-time communication protocol
7. **Express.js**: Web server framework
8. **Connect-PG-Simple**: PostgreSQL session store for Express

## Deployment Strategy

The application supports multiple deployment strategies:

### Web Application Deployment

The application is configured to be deployed on:
- Replit: Configuration in `.replit` file with Node.js and PostgreSQL modules
- Standard Node.js hosting: Build script in `package.json` for production deployment

### Robot Client Deployment

Multiple deployment methods for robot clients:

1. **Direct Installation**: Scripts to install directly on the robot's system
2. **Android-Based Robots**: Special installers for Android-based robots dealing with content URI restrictions
3. **Remote Installation**: Tools to deploy and configure robot clients remotely

### Development Environment

The repository includes development tools:
- TypeScript configuration
- Vite for frontend building
- ESBuild for server bundling
- Drizzle for database schema management and migrations

## Security Considerations

1. **Authentication**: Password hashing with scrypt and salt
2. **Authorization**: Role-based access control
3. **Robot Communication**: Secret key authorization for robot API access
4. **Data Protection**: Secure storage of robot credentials and user data

## Future Extensibility

The architecture is designed to be extensible in several ways:

1. **New Robot Types**: The template system allows for different robot configurations
2. **Additional Modules**: The modular Python scripts can be extended with new functionality
3. **Enhanced Visualization**: The map visualization module can be extended with new features
4. **Multi-environment Operation**: Support for different deployment scenarios (Android, Linux, Windows)

## Limitations and Constraints

1. **Physical Robot Compatibility**: Requires compatible robot hardware for full functionality
2. **Networking Requirements**: Robots must be on the same network as the server or have internet access
3. **Android Permissions**: Android-based robots require appropriate storage permissions