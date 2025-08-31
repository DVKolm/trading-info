import React from 'react';

interface LoadingScreenProps {
  welcomePageReady: boolean;
  welcomeAnimationsEnabled: boolean;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  welcomePageReady, 
  welcomeAnimationsEnabled 
}) => {
  return (
    <>
      <div className="loading-container">
        <div className="loading-text">Loading lessons...</div>
      </div>
      
      {/* Hidden preload of welcome page */}
      {welcomePageReady && (
        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', opacity: 0 }}>
          <div className={`welcome-screen ${welcomeAnimationsEnabled ? '' : 'no-animations'}`}>
            <h1>Добро пожаловать в H.E.A.R.T!</h1>
            <p>Ваш надежный проводник в мире трейдинга</p>
          </div>
        </div>
      )}
    </>
  );
};

export default LoadingScreen;