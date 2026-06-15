import { useState } from 'react';

export default function BusinessDetailsScreen({ onContinue, onBack }) {
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');

  const isFormValid = name.trim().length > 0;

  const handleContinue = () => {
    onContinue({
      name: name.trim(),
      businessName: businessName.trim(),
      email: email.trim(),
    });
  };

  return (
    <div className="business-screen">
      <div className="business-header">
        <button className="back-btn" onClick={onBack} id="business-back-btn">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
      </div>

      <div className="business-content">
        <h1 className="business-title">Business Details</h1>
        <p className="business-subtitle">
          Please provide details as asked below for unique account creation
        </p>

        <div className="form-group">
          <input
            type="text"
            className="form-input"
            placeholder="Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            id="input-name"
            autoFocus
          />
        </div>

        <div className="form-group">
          <input
            type="text"
            className="form-input"
            placeholder="Business Name"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            id="input-business-name"
          />
        </div>

        <div className="form-group">
          <input
            type="email"
            className="form-input"
            placeholder="Business Email ID"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            id="input-email"
          />
        </div>
      </div>

      <div className="business-footer">
        <p className="terms-text">
          By continuing you agree to <a href="#" id="terms-link">Terms & Conditions</a>
        </p>
        <button
          className="btn-continue"
          onClick={handleContinue}
          disabled={!isFormValid}
          id="continue-btn"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
