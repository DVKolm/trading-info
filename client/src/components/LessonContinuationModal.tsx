import React, { useState, useEffect } from 'react';

interface LessonContinuationModalProps {
  isOpen: boolean;
  onContinue: () => void;
  onStartOver: () => void;
  lessonTitle: string;
}

const LessonContinuationModal: React.FC<LessonContinuationModalProps> = ({
  isOpen,
  onContinue,
  onStartOver,
  lessonTitle
}) => {
  const [countdown, setCountdown] = useState(15);

  useEffect(() => {
    if (!isOpen) {
      setCountdown(15);
      return;
    }

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onContinue(); // Auto-continue after 15 seconds
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, onContinue]);

  if (!isOpen) return null;

  return (
    <div className="lesson-continuation-overlay">
      <div className="lesson-continuation-modal">
        <div className="modal-header">
          <h3>Продолжить урок?</h3>
        </div>
        <div className="modal-content">
          <p>Вы ранее начинали изучение урока:</p>
          <p className="lesson-title">"{lessonTitle}"</p>
          <p>Хотите продолжить с места остановки или начать заново?</p>
          <p className="countdown-text">Автоматическое продолжение через: {countdown} сек</p>
        </div>
        <div className="modal-actions">
          <button 
            className="btn-continue" 
            onClick={onContinue}
          >
            Продолжить
          </button>
          <button 
            className="btn-start-over" 
            onClick={onStartOver}
          >
            Начать заново
          </button>
        </div>
      </div>
    </div>
  );
};

export default LessonContinuationModal;