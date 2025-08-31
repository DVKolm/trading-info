import { useState, useCallback, useEffect } from 'react';
import { useLocalStorageBatch } from './useLocalStorageBatch';

export const useSubscriptionManager = () => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { getLocalStorageItem, removeLocalStorageItem } = useLocalStorageBatch();

  const checkSubscriptionStatus = useCallback(async () => {
    try {
      const telegramUserId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
      
      // Check localStorage first
      const savedSubscriptionData = getLocalStorageItem('telegram_subscription_verified');
      
      if (savedSubscriptionData) {
        try {
          const subscriptionData = JSON.parse(savedSubscriptionData);
          const now = Date.now();
          
          // Check if subscription expired (5 minutes)
          if (subscriptionData.timestamp && (now - subscriptionData.timestamp) > 5 * 60 * 1000) {
            removeLocalStorageItem('telegram_subscription_verified');
            setIsSubscribed(false);
            return;
          }
        } catch (e) {
          // Old format data, remove it
          removeLocalStorageItem('telegram_subscription_verified');
        }
      }
      
      // If there's saved subscription AND user ID, check via API
      if (savedSubscriptionData && telegramUserId) {
        try {
          const apiUrl = process.env.REACT_APP_API_URL || '';
          const response = await fetch(`${apiUrl}/api/subscription/status/${telegramUserId}`);
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.subscribed) {
              // Subscription confirmed via API - update timestamp
              const subscriptionData = {
                verified: true,
                timestamp: Date.now()
              };
              localStorage.setItem('telegram_subscription_verified', JSON.stringify(subscriptionData));
              setIsSubscribed(true);
              return;
            } else {
              // Subscription no longer active
              removeLocalStorageItem('telegram_subscription_verified');
              setIsSubscribed(false);
              return;
            }
          } else {
            console.error('Failed to check subscription status via API');
          }
        } catch (apiError) {
          console.error('Error checking subscription via API:', apiError);
          // If API unavailable, trust localStorage if cache not expired
          if (savedSubscriptionData) {
            setIsSubscribed(true);
            return;
          }
        }
      } else if (savedSubscriptionData && !telegramUserId) {
        // No user ID - cannot verify subscription
        console.warn('No telegram user ID - cannot verify subscription');
        removeLocalStorageItem('telegram_subscription_verified');
        setIsSubscribed(false);
        return;
      }

      // If no saved subscription or API showed unsubscribed
      setIsSubscribed(false);
    } catch (error) {
      console.error('Error checking subscription status:', error);
      setIsSubscribed(false);
    }
  }, [getLocalStorageItem, removeLocalStorageItem]);

  const handleSubscriptionVerified = useCallback(() => {
    setIsSubscribed(true);
  }, []);

  const handleSubscriptionRequired = useCallback(() => {
    // This will be handled by the parent component to show subscription check
    return 'Для доступа к этому уроку требуется подписка на наш Telegram канал';
  }, []);

  // Initialize subscription check
  useEffect(() => {
    checkSubscriptionStatus();
  }, [checkSubscriptionStatus]);

  return {
    isSubscribed,
    checkSubscriptionStatus,
    handleSubscriptionVerified,
    handleSubscriptionRequired
  };
};