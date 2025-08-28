import React, { useState, useEffect } from 'react';
import { WebApp } from '@twa-dev/types';
import Sidebar from './components/Sidebar';
import LessonViewer from './components/LessonViewer';
import SubscriptionCheck from './components/SubscriptionCheck';
import WaterBackground from './components/WaterBackground';
import { LessonStructure, Lesson } from './types';
import './App.css';

declare global {
  interface Window {
    Telegram?: {
      WebApp: WebApp & {
        openTelegramLink?: (url: string) => void;
        openLink?: (url: string) => void;
        ready: () => void;
        expand: () => void;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        initDataUnsafe?: {
          user?: {
            id?: number;
          };
        };
      };
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
  const [lessonHistory, setLessonHistory] = useState<string[]>([]);

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
      
      const telegramUserId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
      
      // Проверяем localStorage сначала
      const savedSubscription = localStorage.getItem('telegram_subscription_verified');
      
      // Если есть сохраненная подписка И есть ID пользователя, проверяем через API
      if (savedSubscription === 'true' && telegramUserId) {
        try {
          const apiUrl = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001');
          const response = await fetch(`${apiUrl}/api/subscription/status/${telegramUserId}`);
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.subscribed) {
              // Подписка подтверждена через API
              setIsSubscribed(true);
              await fetchLessonStructure();
              return;
            } else {
              // Подписка больше не активна, удаляем из localStorage
              localStorage.removeItem('telegram_subscription_verified');
              console.log('Subscription status changed: user is no longer subscribed');
            }
          } else {
            console.error('Failed to check subscription status via API');
          }
        } catch (apiError) {
          console.error('Error checking subscription via API:', apiError);
          // Если API недоступен, доверяем localStorage
          setIsSubscribed(true);
          await fetchLessonStructure();
          return;
        }
      } else if (savedSubscription === 'true' && !telegramUserId) {
        // Нет ID пользователя, но есть сохраненная подписка (может быть тестирование)
        setIsSubscribed(true);
        await fetchLessonStructure();
        return;
      }

      // Если нет сохраненной подписки или API показал, что не подписан
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
      // Add current lesson to history if we have one selected
      if (selectedLesson && selectedLesson.path !== lessonPath) {
        setLessonHistory(prev => [...prev, selectedLesson.path]);
      }
      
      const apiUrl = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001');
      const response = await fetch(`${apiUrl}/api/lessons/content/${lessonPath}`);
      if (!response.ok) {
        throw new Error('Failed to fetch lesson content');
      }
      const lessonData = await response.json();
      setSelectedLesson(lessonData);
      setSidebarOpen(false); // Close sidebar on mobile after selection
      
      // Scroll to top when new lesson loads
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
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

  const handleBackNavigation = async () => {
    if (lessonHistory.length === 0) return;
    
    const previousLessonPath = lessonHistory[lessonHistory.length - 1];
    const newHistory = lessonHistory.slice(0, -1);
    
    try {
      const apiUrl = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001');
      const response = await fetch(`${apiUrl}/api/lessons/content/${previousLessonPath}`);
      if (!response.ok) {
        throw new Error('Failed to fetch lesson content');
      }
      const lessonData = await response.json();
      setSelectedLesson(lessonData);
      setLessonHistory(newHistory);
      
      // Scroll to top when returning to previous lesson
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load previous lesson');
    }
  };

  // Function to get next lesson based on lesson structure
  const getNextLesson = (currentPath: string): string | null => {
    const flattenStructure = (structure: LessonStructure[]): LessonStructure[] => {
      const result: LessonStructure[] = [];
      structure.forEach(item => {
        if (item.type === 'file') {
          result.push(item);
        }
        if (item.children) {
          result.push(...flattenStructure(item.children));
        }
      });
      return result;
    };

    const allLessons = flattenStructure(lessonStructure);
    // Filter main lessons - those that have the lesson number in their path and filename matches pattern
    const mainLessons = allLessons.filter(lesson => {
      // Check if this is a main lesson file (path contains "Урок X" and filename starts with "Урок X")
      const pathMatch = lesson.path.match(/Урок (\d+)/);
      const filenameMatch = lesson.filename?.match(/Урок (\d+)/);
      // Must be in main lesson folder AND be the main lesson file (not additional materials)
      return pathMatch && filenameMatch && pathMatch[1] === filenameMatch[1];
    }).sort((a, b) => {
      const aNum = parseInt(a.path.match(/Урок (\d+)/)?.[1] || '0');
      const bNum = parseInt(b.path.match(/Урок (\d+)/)?.[1] || '0');
      return aNum - bNum;
    });

    const currentIndex = mainLessons.findIndex(lesson => lesson.path === currentPath);
    if (currentIndex >= 0 && currentIndex < mainLessons.length - 1) {
      return mainLessons[currentIndex + 1].path;
    }
    
    return null;
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
            onBack={lessonHistory.length > 0 ? handleBackNavigation : undefined}
            nextLessonPath={getNextLesson(selectedLesson.path)}
          />
        ) : (
          <div className="welcome-screen">
            <WaterBackground />
            <div className="welcome-content">
              <h1>Добро пожаловать в H.E.A.R.T!</h1>
              <p>Ваш надежный проводник в мире трейдинга</p>
              
              <button 
                className="open-sidebar-btn"
                onClick={() => setSidebarOpen(true)}
              >
                Открыть уроки
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
