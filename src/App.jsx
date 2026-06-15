import React, { Component, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import DashboardScreen from './screens/DashboardScreen';
import SplashScreen from './screens/SplashScreen';
import './index.css';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  componentDidCatch(error, errorInfo) {
    this.setState({ hasError: true, error: error, errorInfo: errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: '#ffebee', color: '#c62828', minHeight: '100vh', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
          <h2>Something went wrong!</h2>
          <p>{this.state.error && this.state.error.toString()}</p>
          <details style={{ marginTop: '10px' }}>
            <summary>Stack Trace</summary>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardScreen />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
