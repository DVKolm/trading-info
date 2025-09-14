import { useState, useCallback, useEffect } from 'react';

const API_URL = process.env.REACT_APP_API_URL || '';

export const useSubscriptionManagerSimple = () => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkSubscriptionStatus = useCallback(async () => {
    try {
      const telegramUserId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;

      if (!telegramUserId) {
        setIsSubscribed(false);
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/subscription/status/${telegramUserId}`);

      if (response.ok) {
        const data = await response.json();
        setIsSubscribed(data.subscribed || false);
      } else {
        console.error('Failed to check subscription status via API');
        setIsSubscribed(false);
      }
    } catch (error) {
      console.error('Error checking subscription status:', error);
      setIsSubscribed(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubscriptionVerified = useCallback(() => {
    setIsSubscribed(true);
  }, []);

  const handleSubscriptionRequired = useCallback(() => {
    return 'Для доступа к этому уроку требуется подписка на наш Telegram канал';
  }, []);

  // Initialize subscription check
  useEffect(() => {
    checkSubscriptionStatus();
  }, [checkSubscriptionStatus]);

  return {
    isSubscribed,
    loading,
    checkSubscriptionStatus,
    handleSubscriptionVerified,
    handleSubscriptionRequired
  };
};