import React, { useEffect, useState } from 'react';
import { useLastReadLesson } from '../hooks/useLastReadLesson';

interface WelcomeScreenProps {
  welcomeAnimationsEnabled: boolean;
  onOpenSidebar: () => void;
  onContinueLearning?: (lessonPath: string, scrollPosition: number) => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ 
  welcomeAnimationsEnabled, 
  onOpenSidebar,
  onContinueLearning
}) => {
  const [isVisible, setIsVisible] = useState(!welcomeAnimationsEnabled);
  const [showContent, setShowContent] = useState(!welcomeAnimationsEnabled);
  const { lastReadLesson, isReturningUser } = useLastReadLesson();

  useEffect(() => {
    if (welcomeAnimationsEnabled) {
      // Запускаем анимацию появления только один раз
      setIsVisible(false);
      setShowContent(false);
      
      const visibleTimer = setTimeout(() => setIsVisible(true), 100);
      const contentTimer = setTimeout(() => setShowContent(true), 300);
      
      return () => {
        clearTimeout(visibleTimer);
        clearTimeout(contentTimer);
      };
    } else {
      // Для отключенных анимаций - показывать сразу
      setIsVisible(true);
      setShowContent(true);
    }
  }, [welcomeAnimationsEnabled]);

  const handleContinueLearning = () => {
    if (lastReadLesson && onContinueLearning) {
      onContinueLearning(lastReadLesson.path, lastReadLesson.scrollPosition);
    }
  };

  return (
    <div className={`welcome-screen ${welcomeAnimationsEnabled ? '' : 'no-animations'} ${isVisible ? 'visible' : ''}`}>
      {/* Плавающие частицы - только при включенных анимациях */}
      {welcomeAnimationsEnabled && isVisible && (
        <div className="particles-container">
          {Array.from({ length: 12 }, (_, i) => (
            <div 
              key={i} 
              className={`particle particle-${i + 1}`} 
              style={{
                animationDelay: `${Math.random() * 8}s`,
                left: `${10 + Math.random() * 80}%`,
                animationDuration: `${6 + Math.random() * 4}s`
              }}
            />
          ))}
        </div>
      )}

      {/* Анимированные волны на фоне - только при анимациях */}
      {welcomeAnimationsEnabled && (
        <div className="animated-waves">
          <div className="wave wave-1"></div>
          <div className="wave wave-2"></div>
          <div className="wave wave-3"></div>
        </div>
      )}

      {/* Основной контент */}
      <div className={`content-wrapper ${showContent ? 'show' : ''}`}>
        <div className="title-container">
          <h1 className="animated-title">
            {welcomeAnimationsEnabled ? (
              <>
                <span className="title-word" style={{animationDelay: '0.2s'}}>Добро</span>
                <span className="title-word" style={{animationDelay: '0.4s'}}>пожаловать</span>
                <span className="title-word" style={{animationDelay: '0.6s'}}>в</span>
                <span className="title-word highlight" style={{animationDelay: '0.8s'}}>H.E.A.R.T!</span>
              </>
            ) : (
              <>
                <span>Добро пожаловать в </span>
                <span className="highlight">H.E.A.R.T!</span>
              </>
            )}
          </h1>
          
          {welcomeAnimationsEnabled && <div className="title-underline"></div>}
        </div>

        <p className="animated-subtitle">
          {welcomeAnimationsEnabled ? (
            <>
              <span className="subtitle-line" style={{animationDelay: '1.2s'}}>Ваш надежный проводник</span>
              <span className="subtitle-line" style={{animationDelay: '1.4s'}}>в мире трейдинга</span>
            </>
          ) : (
            <>
              <span>Ваш надежный проводник</span>
              <span>в мире трейдинга</span>
            </>
          )}
        </p>
        
        <button 
          className="open-sidebar-btn animated-button"
          onClick={isReturningUser ? handleContinueLearning : onOpenSidebar}
          style={{animationDelay: '1.8s'}}
        >
          <span className="button-text">
            {isReturningUser ? 'Продолжить обучение' : 'Начать обучение'}
          </span>
          <span className="button-icon">→</span>
          <div className="button-ripple"></div>
        </button>
        
        {isReturningUser && lastReadLesson && (
          <div className="last-lesson-info" style={{animationDelay: '2s'}}>
            <span className="last-lesson-text">
              Последний урок: {lastReadLesson.title}
            </span>
          </div>
        )}

      </div>
    </div>
  );
};

export default WelcomeScreen;