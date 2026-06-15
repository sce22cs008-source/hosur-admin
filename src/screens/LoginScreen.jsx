import { useState } from 'react';

export default function LoginScreen({ onLogin, onChangeLanguage }) {
  const [phone, setPhone] = useState('');
  const [showPopup, setShowPopup] = useState(false);
  const [userName] = useState('Hosur Admin');
  const [detectedNumber] = useState('9876543210');

  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 10) {
      setPhone(value);
    }
    if (value.length === 10) {
      setTimeout(() => setShowPopup(true), 500);
    }
  };

  const handleUseNumber = (number) => {
    onLogin(number);
  };

  const handleUseAnotherNumber = () => {
    setShowPopup(false);
    setPhone('');
  };

  return (
    <div className="login-screen">
      <div className="login-top-bar">
        <button className="change-lang-btn" onClick={onChangeLanguage} id="change-lang-btn">
          <span className="globe-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
          </span>
          Change Language
        </button>
      </div>

      <div className="login-content">
        <h1 className="login-title">Account Login</h1>
        <p className="login-subtitle">
          Please enter a valid mobile number to access your Hosur Infratech Pagar Book account
        </p>

        <label className="login-label">MOBILE NUMBER</label>

        <div className="phone-input-group">
          <div className="country-code">
            <span className="flag">🇮🇳</span>
            <span>+91</span>
          </div>
          <input
            type="tel"
            className="phone-input"
            placeholder="Enter your 10 digit mobile number"
            value={phone}
            onChange={handlePhoneChange}
            maxLength={10}
            inputMode="numeric"
            id="phone-input"
            autoFocus
          />
        </div>
      </div>

      {/* Verification Popup */}
      {showPopup && (
        <div className="popup-overlay" onClick={() => setShowPopup(false)}>
          <div className="popup-sheet" onClick={(e) => e.stopPropagation()}>
            <h2>Hi, {userName}</h2>
            <p>To continue, please verify mobile number</p>

            <button
              className="btn-use-number"
              onClick={() => handleUseNumber(phone || detectedNumber)}
              id="use-number-btn"
            >
              USE {phone || detectedNumber}
            </button>

            <button
              className="btn-another-number"
              onClick={handleUseAnotherNumber}
              id="use-another-btn"
            >
              USE ANOTHER MOBILE NUMBER
            </button>

            <div className="popup-consent">
              <p>By continuing you consent to share your profile information with Hosur Infratech Pagar Book</p>
              <span className="chevron">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </span>
            </div>

            <div className="popup-verification-tag">
              <span>Instant Verification by</span>
              <span className="brand">TrueVerify</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
