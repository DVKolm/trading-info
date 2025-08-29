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
    if (savedSubscription === 'true') {
      setStep('verified');
      onSubscriptionVerified();
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
      const telegramUserId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
      
      console.log('Telegram User ID:', telegramUserId); // Debug
      console.log('Telegram WebApp data:', window.Telegram?.WebApp?.initDataUnsafe); // Debug
      
      if (!telegramUserId) {
        // В режиме разработки - для тестирования
        if (process.env.NODE_ENV === 'development') {
          console.log('Development mode: simulating subscription verification');
          localStorage.setItem('telegram_subscription_verified', 'true');
          setStep('verified');
          onSubscriptionVerified();
          return;
        }
        
        setErrorMessage('Не удалось получить данные пользователя Telegram. Попробуйте перезагрузить приложение.');
        return;
      }
      
      // Отправляем запрос на сервер для проверки подписки
      const apiUrl = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001');
      console.log('API URL:', apiUrl); // Debug
      
      const requestBody = {
        telegram_user_id: telegramUserId,
        verified: true
      };
      console.log('Request body:', requestBody); // Debug
      
      const response = await fetch(`${apiUrl}/api/subscription/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log('Response status:', response.status); // Debug
      console.log('Response headers:', response.headers); // Debug
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Server response:', result); // Debug
      
      if (result.verified) {
        // Пользователь подписан
        localStorage.setItem('telegram_subscription_verified', 'true');
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
      
      // В режиме разработки - для тестирования  
      if (process.env.NODE_ENV === 'development') {
        console.log('Development mode: API error, simulating successful verification for testing');
        localStorage.setItem('telegram_subscription_verified', 'true');
        setStep('verified');
        onSubscriptionVerified();
        return;
      }
      
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
                  <>
                    <div className="loading-spinner"></div>
                    <span>Проверяем подписку...</span>
                  </>
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
