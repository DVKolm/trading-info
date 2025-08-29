import React, { useState, useEffect } from 'react';
import { ArrowRight, X } from 'lucide-react';

interface LessonContinueNotificationProps {
  isVisible: boolean;
  onContinue: () => void;
  onDismiss: () => void;
  lessonTitle: string;
}

const LessonContinueNotification: React.FC<LessonContinueNotificationProps> = ({
  isVisible,
  onContinue,
  onDismiss,
  lessonTitle
}) => {
  const [countdown, setCountdown] = useState(10);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!isVisible) {
      setCountdown(10);
      setIsAnimating(false);
      return;
    }

    setIsAnimating(true);

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onContinue(); // Auto-continue after 10 seconds
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isVisible, onContinue]);

  if (!isVisible) return null;

  return (
    <div className={`lesson-continue-notification ${isAnimating ? 'visible' : ''}`}>
      <div className="notification-content">
        <div className="notification-text">
          <span className="notification-title">Continue reading?</span>
          <span className="notification-lesson">"{lessonTitle}"</span>
        </div>
        <div className="notification-actions">
          <div className="countdown-indicator">
            <div 
              className="countdown-progress" 
              style={{ 
                width: `${(countdown / 10) * 100}%`,
                animationDuration: `${countdown}s`
              }}
            />
            <span className="countdown-text">{countdown}s</span>
          </div>
          <button 
            onClick={onContinue}
            className="continue-action-btn"
            title="Continue reading"
          >
            <ArrowRight size={16} />
          </button>
          <button 
            onClick={onDismiss}
            className="dismiss-action-btn"
            title="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LessonContinueNotification;