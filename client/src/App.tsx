import React, { useState, useEffect } from 'react';
import { WebApp } from '@twa-dev/types';
import Sidebar from './components/Sidebar';
import LessonViewer from './components/LessonViewer';
import SubscriptionCheck from './components/SubscriptionCheck';
import { LessonStructure, Lesson } from './types';
import './App.css';

declare global {
  interface Window {
    Telegram?: {
      WebApp: WebApp;
    };
  }
}

const App: React.FC = () => {
  const [lessonStructure, setLessonStructure] = useState<LessonStructure[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [checkingSubscription, setCheckingSubscription] = useState(true);

  useEffect(() => {
    // Initialize Telegram WebApp
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      
      // Set theme
      tg.setHeaderColor('#1e1e1e');
      tg.setBackgroundColor('#1e1e1e');
    }

    // Check subscription status first
    checkSubscriptionStatus();
  }, []);

  const checkSubscriptionStatus = async () => {
    try {
      setCheckingSubscription(true);
      
      // Проверяем localStorage
      const savedSubscription = localStorage.getItem('telegram_subscription_verified');
      if (savedSubscription === 'true') {
        setIsSubscribed(true);
        await fetchLessonStructure();
        return;
      }

      // Если в localStorage нет подтверждения, проверяем через API (опционально)
      const telegramUserId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
      if (telegramUserId) {
        const apiUrl = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001');
        const response = await fetch(`${apiUrl}/api/subscription/status/${telegramUserId}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.subscribed) {
            setIsSubscribed(true);
            localStorage.setItem('telegram_subscription_verified', 'true');
            await fetchLessonStructure();
            return;
          }
        }
      }
      
      // Если подписка не подтверждена
      setIsSubscribed(false);
    } catch (error) {
      console.error('Error checking subscription status:', error);
      setIsSubscribed(false);
    } finally {
      setCheckingSubscription(false);
    }
  };

  const fetchLessonStructure = async () => {
    try {
      setLoading(true);
      const apiUrl = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001');
      const response = await fetch(`${apiUrl}/api/lessons/structure`);
      if (!response.ok) {
        throw new Error('Failed to fetch lesson structure');
      }
      const data = await response.json();
      setLessonStructure(data.structure);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleLessonSelect = async (lessonPath: string) => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001');
      const response = await fetch(`${apiUrl}/api/lessons/content/${lessonPath}`);
      if (!response.ok) {
        throw new Error('Failed to fetch lesson content');
      }
      const lessonData = await response.json();
      setSelectedLesson(lessonData);
      setSidebarOpen(false); // Close sidebar on mobile after selection
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lesson');
    }
  };

  const handleSearch = async (query: string): Promise<any[]> => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001');
      const response = await fetch(`${apiUrl}/api/lessons/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error('Search failed');
      }
      const data = await response.json();
      return data.results;
    } catch (err) {
      console.error('Search error:', err);
      return [];
    }
  };

  const handleSubscriptionVerified = () => {
    setIsSubscribed(true);
    fetchLessonStructure();
  };

  if (checkingSubscription) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Checking subscription...</div>
      </div>
    );
  }

  if (!isSubscribed) {
    return <SubscriptionCheck onSubscriptionVerified={handleSubscriptionVerified} />;
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading lessons...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-message">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={fetchLessonStructure} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar
        structure={lessonStructure}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLessonSelect={handleLessonSelect}
        onSearch={handleSearch}
      />
      
      <main className={`main-content ${sidebarOpen ? 'sidebar-open' : ''}`}>
        {selectedLesson ? (
          <LessonViewer 
            lesson={selectedLesson} 
            onNavigateToLesson={handleLessonSelect}
          />
        ) : (
          <div className="welcome-screen">
            <h1>Welcome to Learning App</h1>
            <p>Select a lesson from the sidebar to get started</p>
            <button 
              className="open-sidebar-btn"
              onClick={() => setSidebarOpen(true)}
            >
              Open Lessons
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
