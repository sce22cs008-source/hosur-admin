import { useState, useEffect } from 'react';

export default function SplashScreen({ onComplete }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onComplete, 500); // give it time to fade out nicely
    }, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="splash-screen" style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.5s ease' }}>
      <div className="splash-logo-container">
        <img src="/hosur-logo.png.jpeg" alt="Hosur Infratech" className="splash-logo" />
        <h1 className="splash-title">HOSUR INFRATECH</h1>
        <div className="splash-subtitle">Management Portal</div>
        
        <div className="loading-bar-container">
          <div className="loading-bar"></div>
        </div>
      </div>
    </div>
  );
}
