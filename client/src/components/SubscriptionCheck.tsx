import React, { useState, useEffect } from 'react';
import { ExternalLink, CheckCircle, UserCheck } from 'lucide-react';
import './SubscriptionCheck.css';

interface SubscriptionCheckProps {
  onSubscriptionVerified: () => void;
  onBack?: () => void;
}

const SubscriptionCheck: React.FC<SubscriptionCheckProps> = ({ onSubscriptionVerified, onBack }) => {
  const [isChecking, setIsChecking] = useState(false);
  const [step, setStep] = useState<'initial' | 'redirected' | 'verified'>('initial');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const TELEGRAM_CHANNEL_URL = 'https://t.me/DailyTradiBlog';
  const TELEGRAM_CHANNEL_USERNAME = '@H.E.A.R.T.';

  useEffect(() => {
    // Проверяем, есть ли сохраненная подписка в localStorage
    const savedSubscription = localStorage.getItem('telegram_subscription_verified');
    if (savedSubscription) {
      try {
        const subscriptionData = JSON.parse(savedSubscription);
        // Проверяем, прошло ли 5 минут с момента верификации
        const minutesSinceVerification = (Date.now() - subscriptionData.timestamp) / (1000 * 60);
        
        if (subscriptionData.verified && minutesSinceVerification < 5) {
          setStep('verified');
          onSubscriptionVerified();
        } else {
          // Подписка истекла, удаляем из localStorage
          localStorage.removeItem('telegram_subscription_verified');
        }
      } catch (error) {
        // Старый формат или поврежденные данные, удаляем
        localStorage.removeItem('telegram_subscription_verified');
      }
    }
  }, [onSubscriptionVerified]);

  const handleSubscribeClick = () => {
    // Очищаем предыдущие ошибки
    setErrorMessage(null);
    
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
    setErrorMessage(null);
    
    try {
      let telegramUserId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
      
      
      if (!telegramUserId) {
        setErrorMessage('Не удалось получить данные пользователя Telegram. Попробуйте перезагрузить приложение.');
        return;
      }
      
      // Отправляем запрос на сервер для проверки подписки
      const apiUrl = process.env.REACT_APP_API_URL || '';
      
      const requestBody = {
        telegram_user_id: telegramUserId
      };
      
      const response = await fetch(`${apiUrl}/api/subscription/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.verified) {
        // Пользователь подписан
        const subscriptionData = {
          verified: true,
          timestamp: Date.now()
        };
        localStorage.setItem('telegram_subscription_verified', JSON.stringify(subscriptionData));
        setStep('verified');
        onSubscriptionVerified();
      } else {
        // Пользователь не подписан
        localStorage.removeItem('telegram_subscription_verified');
        
        let errorMessage = 'Вы не подписаны на канал @DailyTradiBlog.';
        
        if (result.message && !result.message.includes('not subscribed')) {
          errorMessage = result.message;
        } else if (result.error) {
          errorMessage = `Ошибка: ${result.error}`;
        }
        
        setErrorMessage(errorMessage);
        setStep('initial');
      }
    } catch (error) {
      console.error('Subscription verification failed:', error);
      localStorage.removeItem('telegram_subscription_verified');
      
      
      setErrorMessage('Произошла ошибка при проверке подписки. Проверьте подключение к интернету и попробуйте снова.');
      setStep('initial');
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
        
        {errorMessage && (
          <div className="error-message">
            <p>{errorMessage}</p>
            <button 
              className="close-error-button"
              onClick={() => setErrorMessage(null)}
            >
              ✕
            </button>
          </div>
        )}

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
                  'Проверяем подписку...'
                ) : (
                  'Я подписался'
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

        {onBack && (
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <button 
              className="back-button"
              onClick={onBack}
              style={{
                background: 'transparent',
                color: 'rgba(255, 255, 255, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              ← Вернуться к урокам
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionCheck;
