import React, { useState, useRef, useEffect } from 'react';
import { Settings, User, Sun, Moon, X, Shield, Upload, Home } from 'lucide-react';

interface FloatingActionButtonProps {
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  onProfileClick: () => void;
  onHomeClick: () => void;
  isAdmin?: boolean;
  onAdminClick?: () => void;
  onUploadClick?: () => void;
}

const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({ 
  theme, 
  onThemeChange, 
  onProfileClick,
  onHomeClick,
  isAdmin,
  onAdminClick,
  onUploadClick 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);

  // Close FAB when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleFAB = () => {
    setIsOpen(!isOpen);
  };

  const handleThemeToggle = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    onThemeChange(newTheme);
    setIsOpen(false);
  };

  const handleProfileClick = () => {
    onProfileClick();
    setIsOpen(false);
  };

  const handleAdminClick = () => {
    if (onAdminClick) {
      onAdminClick();
      setIsOpen(false);
    }
  };

  const handleUploadClick = () => {
    if (onUploadClick) {
      onUploadClick();
      setIsOpen(false);
    }
  };

  const handleHomeClick = () => {
    onHomeClick();
    setIsOpen(false);
  };

  return (
    <div className={`floating-action-button ${isOpen ? 'open' : ''}`} ref={fabRef}>
      {/* Action Buttons */}
      <div className={`fab-actions ${isOpen ? 'visible' : ''}`}>
        <button 
          className="fab-action home-button"
          onClick={handleHomeClick}
          title="Домой"
        >
          <Home size={20} />
        </button>
        
        <button 
          className="fab-action theme-toggle"
          onClick={handleThemeToggle}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
        
        <button 
          className="fab-action profile-button"
          onClick={handleProfileClick}
          title="View Profile"
        >
          <User size={20} />
        </button>
        
        {isAdmin && (
          <button 
            className="fab-action admin-upload-button"
            onClick={handleAdminClick}
            title="Admin Media Panel"
          >
            <Upload size={20} />
          </button>
        )}
      </div>

      {/* Main FAB Button */}
      <button 
        className={`fab-main ${isOpen ? 'rotated' : ''}`}
        onClick={toggleFAB}
        title="Settings"
      >
        {isOpen ? <X size={24} /> : <Settings size={24} />}
      </button>

      {/* Background Overlay */}
      {isOpen && <div className="fab-overlay" onClick={() => setIsOpen(false)} />}
    </div>
  );
};

export default FloatingActionButton;