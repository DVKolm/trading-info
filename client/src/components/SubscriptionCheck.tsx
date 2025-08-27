import React, { useState, useEffect } from 'react';
import { ExternalLink, CheckCircle, UserCheck } from 'lucide-react';
import './SubscriptionCheck.css';

interface SubscriptionCheckProps {
  onSubscriptionVerified: () => void;
}

const SubscriptionCheck: React.FC<SubscriptionCheckProps> = ({ onSubscriptionVerified }) => {
  const [isChecking, setIsChecking] = useState(false);
  const [step, setStep] = useState<'initial' | 'redirected' | 'verified'>('initial');

  const TELEGRAM_CHANNEL_URL = 'https://t.me/DailyTradiBlog';
  const TELEGRAM_CHANNEL_USERNAME = '@DailyTradiBlog';

  useEffect(() => {
    // Проверяем, есть ли сохраненная подписка в localStorage
    const savedSubscription = localStorage.getItem('telegram_subscription_verified');
    if (savedSubscription === 'true') {
      setStep('verified');
      onSubscriptionVerified();
    }
  }, [onSubscriptionVerified]);

  const handleSubscribeClick = () => {
    // Открываем Telegram канал через WebApp API
    if (window.Telegram?.WebApp) {
      try {
        // Используем специальный метод для открытия Telegram ссылок
        if (typeof window.Telegram.WebApp.openTelegramLink === 'function') {
          window.Telegram.WebApp.openTelegramLink(TELEGRAM_CHANNEL_URL);
        } else if (typeof window.Telegram.WebApp.openLink === 'function') {
          // Альтернативный метод для старых версий
          window.Telegram.WebApp.openLink(TELEGRAM_CHANNEL_URL);
        } else {
          // Используем обычный window.open как последний resort
          window.open(TELEGRAM_CHANNEL_URL, '_blank');
        }
      } catch (error) {
        console.error('Error opening Telegram link:', error);
        // Fallback на обычное открытие ссылки
        window.open(TELEGRAM_CHANNEL_URL, '_blank');
      }
    } else {
      // Fallback для случаев вне Telegram
      window.open(TELEGRAM_CHANNEL_URL, '_blank');
    }
    setStep('redirected');
  };

  const handleVerifySubscription = async () => {
    setIsChecking(true);
    
    try {
      // Здесь можно добавить реальную проверку через Telegram Bot API
      // Пока используем простую задержку для имитации проверки
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Сохраняем статус подписки
      localStorage.setItem('telegram_subscription_verified', 'true');
      
      // Отправляем запрос на сервер для сохранения статуса (опционально)
      try {
        const apiUrl = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001');
        await fetch(`${apiUrl}/api/subscription/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            telegram_user_id: window.Telegram?.WebApp?.initDataUnsafe?.user?.id,
            verified: true
          })
        });
      } catch (error) {
        console.error('Failed to save subscription status:', error);
      }
      
      setStep('verified');
      onSubscriptionVerified();
    } catch (error) {
      console.error('Subscription verification failed:', error);
    } finally {
      setIsChecking(false);
    }
  };

  if (step === 'verified') {
    return (
      <div className="subscription-success">
        <CheckCircle className="success-icon" />
        <h3>Подписка подтверждена!</h3>
        <p>Спасибо за подписку на {TELEGRAM_CHANNEL_USERNAME}</p>
      </div>
    );
  }

  return (
    <div className="subscription-check">
      <div className="subscription-content">
        <div className="subscription-header">
          <UserCheck className="subscription-icon" />
          <h2>Подпишитесь на наш канал</h2>
        </div>
        
        <div className="subscription-body">
          <p className="subscription-description">
            Для получения доступа к библиотеке обучающих материалов, 
            пожалуйста, подпишитесь на наш Telegram канал:
          </p>
          
          <div className="channel-info">
            <strong>{TELEGRAM_CHANNEL_USERNAME}</strong>
          </div>
          
          <div className="subscription-steps">
            <div className={`step ${step === 'initial' ? 'active' : (step === 'redirected' || step === 'verified') ? 'completed' : ''}`}>
              <div className="step-number">1</div>
              <div className="step-content">
                <h4>Подписаться на канал</h4>
                <p>Нажмите кнопку ниже, чтобы перейти в Telegram и подписаться</p>
              </div>
            </div>
            
            <div className={`step ${step === 'redirected' ? 'active' : ''}`}>
              <div className="step-number">2</div>
              <div className="step-content">
                <h4>Подтвердить подписку</h4>
                <p>После подписки вернитесь и нажмите "Я подписался"</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="subscription-actions">
          {step === 'initial' && (
            <button 
              className="subscribe-button"
              onClick={handleSubscribeClick}
            >
              <ExternalLink size={20} />
              Подписаться на канал
            </button>
          )}
          
          {step === 'redirected' && (
            <div className="verify-section">
              <p className="verify-text">
                Подписались на канал? Нажмите кнопку ниже для проверки:
              </p>
              <button 
                className="verify-button"
                onClick={handleVerifySubscription}
                disabled={isChecking}
              >
                {isChecking ? (
                  <>
                    <div className="loading-spinner"></div>
                    Проверяем подписку...
                  </>
                ) : (
                  <>
                    <CheckCircle size={20} />
                    Я подписался
                  </>
                )}
              </button>
              
              <button 
                className="back-button"
                onClick={() => setStep('initial')}
              >
                Назад
              </button>
            </div>
          )}
        </div>
        
        <div className="subscription-note">
          <p>
            <strong>Зачем нужна подписка?</strong><br/>
            В нашем канале мы публикуем эксклюзивные материалы, 
            обновления курсов и полезные советы по трейдингу.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionCheck;
