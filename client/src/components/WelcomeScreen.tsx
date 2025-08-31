import React from 'react';

interface WelcomeScreenProps {
  welcomeAnimationsEnabled: boolean;
  onOpenSidebar: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ 
  welcomeAnimationsEnabled, 
  onOpenSidebar 
}) => {
  return (
    <div className={`welcome-screen ${welcomeAnimationsEnabled ? '' : 'no-animations'}`}>
      <h1>Добро пожаловать в H.E.A.R.T!</h1>
      <p>Ваш надежный проводник в мире трейдинга</p>
      
      <button 
        className="open-sidebar-btn"
        onClick={onOpenSidebar}
      >
        Начать обучение
      </button>
    </div>
  );
};

export default WelcomeScreen;