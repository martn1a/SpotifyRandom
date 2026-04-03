# Sunnet 2.6 Cloud - React App Execution Guide

## Overview
This guide provides step-by-step instructions for executing a React application in the Sunnet 2.6 Cloud environment.

## Prerequisites
- Node.js (v14 or higher)
- npm or yarn package manager
- Sunnet 2.6 Cloud account and CLI installed
- Git for version control

## Getting Started

### 1. Install Dependencies
```bash
npm install
# or
yarn install
```

### 2. Configure Environment Variables
Create a `.env` file in the project root:
```plaintext
REACT_APP_API_URL=https://api.sunnet.cloud
REACT_APP_ENVIRONMENT=production
```

### 3. Build the Application
```bash
npm run build
# or
yarn build
```

### 4. Deploy to Sunnet 2.6 Cloud
```bash
sunnet deploy ./build --environment production
```

### 5. Verify Deployment
Visit the provided Sunnet Cloud URL to verify your React application is running correctly.

## Development Mode

To run the application locally during development:
```bash
npm start
# or
yarn start
```

The application will be available at `http://localhost:3000`.

## Troubleshooting
- Clear node_modules and reinstall if you encounter dependency issues
- Check Sunnet Cloud console logs for deployment errors
- Verify environment variables are correctly configured

## Additional Resources
- [Sunnet 2.6 Documentation](https://sunnet.cloud/docs)
- [React Documentation](https://react.dev)
- [Create React App Guide](https://create-react-app.dev)