import React, { useEffect, useState } from 'react';

interface WelcomeScreenProps {
  welcomeAnimationsEnabled: boolean;
  onOpenSidebar: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ 
  welcomeAnimationsEnabled, 
  onOpenSidebar 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (welcomeAnimationsEnabled) {
      // Запускаем анимацию появления
      setTimeout(() => setIsVisible(true), 200);
      // Показываем контент с задержкой
      setTimeout(() => setShowContent(true), 800);
    } else {
      setIsVisible(true);
      setShowContent(true);
    }
  }, [welcomeAnimationsEnabled]);

  return (
    <div className={`welcome-screen ${welcomeAnimationsEnabled ? '' : 'no-animations'} ${isVisible ? 'visible' : ''}`}>
      {/* Плавающие частицы */}
      <div className="particles-container">
        {Array.from({ length: 15 }, (_, i) => (
          <div 
            key={i} 
            className={`particle particle-${i + 1}`} 
            style={{
              animationDelay: `${i * 0.3}s`,
              left: `${Math.random() * 100}%`,
              animationDuration: `${4 + Math.random() * 6}s`
            }}
          />
        ))}
      </div>

      {/* Анимированные волны на фоне */}
      <div className="animated-waves">
        <div className="wave wave-1"></div>
        <div className="wave wave-2"></div>
        <div className="wave wave-3"></div>
      </div>

      {/* Основной контент */}
      <div className={`content-wrapper ${showContent ? 'show' : ''}`}>
        <div className="title-container">
          <h1 className="animated-title">
            <span className="title-word" style={{animationDelay: '0.2s'}}>Добро</span>
            <span className="title-word" style={{animationDelay: '0.4s'}}>пожаловать</span>
            <span className="title-word" style={{animationDelay: '0.6s'}}>в</span>
            <span className="title-word highlight" style={{animationDelay: '0.8s'}}>H.E.A.R.T!</span>
          </h1>
          
          <div className="title-underline"></div>
        </div>

        <p className="animated-subtitle">
          <span className="subtitle-line" style={{animationDelay: '1.2s'}}>Ваш надежный проводник</span>
          <span className="subtitle-line" style={{animationDelay: '1.4s'}}>в мире трейдинга</span>
        </p>
        
        <button 
          className="open-sidebar-btn animated-button"
          onClick={onOpenSidebar}
          style={{animationDelay: '1.8s'}}
        >
          <span className="button-text">Начать обучение</span>
          <span className="button-icon">→</span>
          <div className="button-ripple"></div>
        </button>

        {/* Дополнительные декоративные элементы */}
        <div className="decorative-elements">
          <div className="floating-icon icon-1">📈</div>
          <div className="floating-icon icon-2">💎</div>
          <div className="floating-icon icon-3">⚡</div>
          <div className="floating-icon icon-4">🎯</div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;