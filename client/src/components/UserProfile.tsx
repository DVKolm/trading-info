import React, { Suspense } from 'react';
import { X, User } from 'lucide-react';

// Lazy load the progress dashboard
const ProgressDashboard = React.lazy(() => import('./ProgressDashboard'));

interface UserProfileProps {
  onClose: () => void;
  telegramUser?: {
    id?: number;
    first_name?: string;
    last_name?: string;
    username?: string;
  };
}

const UserProfile: React.FC<UserProfileProps> = ({ onClose, telegramUser }) => {
  const displayName = telegramUser?.username 
    ? `@${telegramUser.username}`
    : telegramUser?.first_name
    ? `${telegramUser.first_name}${telegramUser.last_name ? ' ' + telegramUser.last_name : ''}`
    : 'Student';
  return (
    <div className="user-profile-overlay">
      <div className="user-profile-modal">
        <div className="profile-header">
          <div className="profile-title">
            <User size={24} />
            <h2>Your Profile</h2>
          </div>
          <button 
            className="close-button" 
            onClick={onClose}
            title="Close Profile"
          >
            <X size={20} />
          </button>
        </div>

        <div className="profile-content">
          {/* User Info Section */}
          <div className="user-info-section">
            <div className="user-avatar">
              <User size={48} />
            </div>
            <div className="user-details">
              <h3>{displayName}</h3>
              <div className="user-badges">
                <span className="badge">Learner</span>
              </div>
            </div>
          </div>

          {/* Progress Dashboard */}
          <div className="progress-section">
            <Suspense fallback={
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                minHeight: '60px',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)'
              }}>
                <div>Loading...</div>
              </div>
            }>
              <ProgressDashboard />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;