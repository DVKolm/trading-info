import React, { Suspense } from 'react';

const SubscriptionCheck = React.lazy(() => import('./SubscriptionCheck'));

interface ErrorScreenProps {
  error: string;
  onRetry: () => void;
  onBack: () => void;
  onSubscriptionVerified: () => void;
}

const ErrorScreen: React.FC<ErrorScreenProps> = ({ 
  error, 
  onRetry, 
  onBack, 
  onSubscriptionVerified 
}) => {
  const isSubscriptionError = error.includes('подписка') || error.includes('Telegram');
  
  if (isSubscriptionError) {
    return (
      <Suspense fallback={<div className="loading-container"><div className="loading-text">Loading...</div></div>}>
        <SubscriptionCheck 
          onSubscriptionVerified={onSubscriptionVerified}
          onBack={onBack}
        />
      </Suspense>
    );
  }
  
  return (
    <div className="error-container">
      <div className="error-message">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={onRetry} className="retry-button">
          Retry
        </button>
      </div>
    </div>
  );
};

export default ErrorScreen;