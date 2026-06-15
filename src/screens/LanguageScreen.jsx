import { useState } from 'react';

const LANGUAGES = [
  { id: 'hi', name: 'हिंदी' },
  { id: 'en', name: 'English' },
  { id: 'gu', name: 'ગુજરાતી' },
  { id: 'hinglish', name: 'Hinglish' },
  { id: 'mr', name: 'मराठी' },
  { id: 'pa', name: 'ਪੰਜਾਬੀ' },
  { id: 'bn', name: 'বাংলা' },
  { id: 'te', name: 'తెలుగు' },
  { id: 'ta', name: 'தமிழ்' },
  { id: 'kn', name: 'ಕನ್ನಡ' },
  { id: 'or', name: 'ଓଡ଼ିଆ' },
];

export default function LanguageScreen({ onSave, onClose }) {
  const [selected, setSelected] = useState('en');

  const handleSave = () => {
    onSave(selected);
  };

  return (
    <div className="language-screen">
      <div className="language-header">
        <h1>Select Language</h1>
        <button className="language-close-btn" onClick={onClose} id="lang-close-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <p className="language-subtitle">
        Please select a language that you can read and understand comfortably
      </p>

      <div className="language-list">
        {LANGUAGES.map((lang) => (
          <div
            key={lang.id}
            className={`language-option ${selected === lang.id ? 'selected' : ''}`}
            onClick={() => setSelected(lang.id)}
            id={`lang-option-${lang.id}`}
          >
            <span className="language-option-name">{lang.name}</span>
            {selected === lang.id && (
              <div className="language-check">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="language-save-container">
        <button className="btn-save" onClick={handleSave} id="lang-save-btn">
          Save
        </button>
      </div>
    </div>
  );
}
