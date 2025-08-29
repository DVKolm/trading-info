import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { WebApp } from '@twa-dev/types';
import Sidebar from './components/Sidebar';
import LessonViewer from './components/LessonViewer';
import ThemeToggle from './components/ThemeToggle';
import { LessonStructure, Lesson } from './types';
import './App.css';

// Lazy load только SubscriptionCheck, так как он нужен редко
const SubscriptionCheck = lazy(() => import('./components/SubscriptionCheck'));

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

// Lesson cache to prevent duplicate API calls
const lessonCache = new Map<string, Lesson>();

// Debounced localStorage operations
let localStorageQueue = new Map<string, any>();
let localStorageTimer: NodeJS.Timeout | null = null;

const batchedLocalStorageSet = (key: string, value: any) => {
  localStorageQueue.set(key, value);
  
  if (localStorageTimer) {
    clearTimeout(localStorageTimer);
  }
  
  localStorageTimer = setTimeout(() => {
    localStorageQueue.forEach((val, k) => {
      try {
        localStorage.setItem(k, typeof val === 'string' ? val : JSON.stringify(val));
      } catch (error) {
        console.error(`Error saving to localStorage key "${k}":`, error);
      }
    });
    localStorageQueue.clear();
    localStorageTimer = null;
  }, 500); // Batch localStorage writes every 500ms
};

const App: React.FC = () => {
  const [lessonStructure, setLessonStructure] = useState<LessonStructure[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [lessonHistory, setLessonHistory] = useState<string[]>([]);
  const [scrollPositions, setScrollPositions] = useState<Map<string, number>>(new Map());
  const [lastReadLesson, setLastReadLesson] = useState<{path: string, title: string, timestamp: number, scrollPosition: number} | null>(null);
  const [showContinueReading, setShowContinueReading] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [welcomePageReady, setWelcomePageReady] = useState(false);
  const [welcomeAnimationsEnabled, setWelcomeAnimationsEnabled] = useState(false);

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

    // Always load lesson structure first, then check subscription
    fetchLessonStructure();
    checkSubscriptionStatus();
    loadLastReadLesson();
    loadTheme();
  }, []);

  // Throttled scroll handler for better performance
  const throttledScrollHandler = useMemo(() => {
    let isThrottled = false;
    return (selectedLesson: Lesson) => {
      if (isThrottled) return;
      
      isThrottled = true;
      setTimeout(() => {
        const lessonViewer = document.querySelector('.lesson-viewer');
        const mainContent = document.querySelector('.main-content');
        const scrollTop = lessonViewer?.scrollTop || mainContent?.scrollTop || window.pageYOffset;
        
        if (scrollTop > 100) { // Only save if scrolled significantly
          setScrollPositions(prev => {
            const newPositions = new Map(prev);
            newPositions.set(selectedLesson.path, scrollTop);
            
            // Save to localStorage (batched)
            const positionsObj = Object.fromEntries(newPositions);
            batchedLocalStorageSet('lesson_scroll_positions', positionsObj);
            
            // Update last read lesson info
            updateLastReadLesson(selectedLesson.path, selectedLesson, scrollTop);
            
            return newPositions;
          });
        }
        isThrottled = false;
      }, 250); // Throttle to every 250ms instead of debouncing
    };
  }, []);

  // Set up scroll tracking when lesson changes
  useEffect(() => {
    if (!selectedLesson) return;

    const handleScroll = () => throttledScrollHandler(selectedLesson);

    const lessonViewer = document.querySelector('.lesson-viewer');
    const mainContent = document.querySelector('.main-content');
    
    if (lessonViewer) {
      lessonViewer.addEventListener('scroll', handleScroll, { passive: true });
    } else if (mainContent) {
      mainContent.addEventListener('scroll', handleScroll, { passive: true });
    } else {
      window.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      if (lessonViewer) {
        lessonViewer.removeEventListener('scroll', handleScroll);
      } else if (mainContent) {
        mainContent.removeEventListener('scroll', handleScroll);
      } else {
        window.removeEventListener('scroll', handleScroll);
      }
    };
  }, [selectedLesson, throttledScrollHandler]);

  const checkSubscriptionStatus = async () => {
    try {
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
          return;
        }
      } else if (savedSubscription === 'true' && !telegramUserId) {
        // Нет ID пользователя, но есть сохраненная подписка (может быть тестирование)
        setIsSubscribed(true);
        return;
      }

      // Если нет сохраненной подписки или API показал, что не подписан
      setIsSubscribed(false);
    } catch (error) {
      console.error('Error checking subscription status:', error);
      setIsSubscribed(false);
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
      
      // Добавляем небольшую задержку для предзагрузки welcome page
      setTimeout(() => {
        setWelcomePageReady(true);
        // Ещё небольшая задержка перед скрытием loading screen и включением анимаций
        setTimeout(() => {
          setLoading(false);
          // Включаем анимации только после того, как loading исчез
          setTimeout(() => {
            setWelcomeAnimationsEnabled(true);
          }, 100);
        }, 300);
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  const saveScrollPosition = (lessonPath: string) => {
    const lessonViewer = document.querySelector('.lesson-viewer');
    const mainContent = document.querySelector('.main-content');
    
    const scrollTop = lessonViewer?.scrollTop || mainContent?.scrollTop || window.pageYOffset;
    
    setScrollPositions(prev => {
      const newPositions = new Map(prev);
      newPositions.set(lessonPath, scrollTop);
      
      // Save to localStorage (batched)
      const positionsObj = Object.fromEntries(newPositions);
      batchedLocalStorageSet('lesson_scroll_positions', positionsObj);
      
      return newPositions;
    });
  };

  const restoreScrollPosition = (lessonPath: string) => {
    // Load from localStorage first
    const savedPositions = localStorage.getItem('lesson_scroll_positions');
    let currentPositions = scrollPositions;
    
    if (savedPositions) {
      try {
        const positionsObj = JSON.parse(savedPositions);
        currentPositions = new Map(Object.entries(positionsObj).map(([k, v]) => [k, Number(v)]));
        setScrollPositions(currentPositions);
      } catch (error) {
        console.error('Error loading scroll positions from localStorage:', error);
      }
    }

    const savedPosition = currentPositions.get(lessonPath);
    // Don't restore position automatically - let the global continue reading handle it
  };

  const handleLessonSelect = useCallback(async (lessonPath: string, scrollToPosition?: number) => {
    try {
      // Save scroll position of current lesson before switching
      if (selectedLesson && selectedLesson.path !== lessonPath) {
        saveScrollPosition(selectedLesson.path);
        setLessonHistory(prev => [...prev, selectedLesson.path]);
      }
      
      // Check cache first
      const cachedLesson = lessonCache.get(lessonPath);
      if (cachedLesson) {
        setSelectedLesson(cachedLesson);
        setSidebarOpen(false);
        updateLastReadLesson(lessonPath, cachedLesson, scrollToPosition || 0);
        
        // Scroll to specified position or top (cached content)
        if (scrollToPosition && scrollToPosition > 0) {
          // For saved positions with cached content, still wait for render
          let attempts = 0;
          const maxAttempts = 5; // Fewer attempts since content is cached
          const scrollInterval = setInterval(() => {
            const lessonViewer = document.querySelector('.lesson-viewer');
            const mainContent = document.querySelector('.main-content');
            
            const container = lessonViewer || mainContent || document.body;
            const containerHeight = container.scrollHeight;
            
            if (containerHeight > scrollToPosition || attempts >= maxAttempts) {
              if (lessonViewer) {
                lessonViewer.scrollTop = scrollToPosition;
              } else if (mainContent) {
                mainContent.scrollTop = scrollToPosition;
              } else {
                window.scrollTo(0, scrollToPosition);
              }
              clearInterval(scrollInterval);
            }
            attempts++;
          }, 50); // Faster interval for cached content
        } else {
          // Scroll to top for new lessons
          setTimeout(() => {
            const lessonViewer = document.querySelector('.lesson-viewer');
            const mainContent = document.querySelector('.main-content');
            
            if (lessonViewer) {
              lessonViewer.scrollTop = 0;
            } else if (mainContent) {
              mainContent.scrollTop = 0;
            } else {
              window.scrollTo(0, 0);
            }
          }, 50);
        }
        return;
      }
      
      const apiUrl = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001');
      const response = await fetch(`${apiUrl}/api/lessons/content/${lessonPath}`);
      if (!response.ok) {
        throw new Error('Failed to fetch lesson content');
      }
      const lessonData = await response.json();
      
      // Cache the lesson
      lessonCache.set(lessonPath, lessonData);
      
      setSelectedLesson(lessonData);
      setSidebarOpen(false); // Close sidebar on mobile after selection
      
      // Update last read lesson
      updateLastReadLesson(lessonPath, lessonData, scrollToPosition || 0);
      
      // Scroll to specified position or top (wait for content to load)
      if (scrollToPosition && scrollToPosition > 0) {
        // For saved positions, wait longer and try multiple times
        let attempts = 0;
        const maxAttempts = 10;
        const scrollInterval = setInterval(() => {
          const lessonViewer = document.querySelector('.lesson-viewer');
          const mainContent = document.querySelector('.main-content');
          
          // Check if content is loaded (has sufficient height)
          const container = lessonViewer || mainContent || document.body;
          const containerHeight = container.scrollHeight;
          
          if (containerHeight > scrollToPosition || attempts >= maxAttempts) {
            if (lessonViewer) {
              lessonViewer.scrollTop = scrollToPosition;
            } else if (mainContent) {
              mainContent.scrollTop = scrollToPosition;
            } else {
              window.scrollTo(0, scrollToPosition);
            }
            clearInterval(scrollInterval);
          }
          attempts++;
        }, 100);
      } else {
        // For new lessons, scroll to top immediately
        setTimeout(() => {
          const lessonViewer = document.querySelector('.lesson-viewer');
          const mainContent = document.querySelector('.main-content');
          
          if (lessonViewer) {
            lessonViewer.scrollTop = 0;
          } else if (mainContent) {
            mainContent.scrollTop = 0;
          } else {
            window.scrollTo(0, 0);
          }
        }, 100);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lesson');
    }
  }, [selectedLesson?.path]);

  const handleSearch = useCallback(async (query: string): Promise<any[]> => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001');
      const response = await fetch(`${apiUrl}/api/lessons/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error('Search failed');
      }
      const data = await response.json();
      // Filter out folders, only show files
      const filteredResults = data.results.filter((result: any) => result.type === 'lesson' || result.type === 'file');
      return filteredResults;
    } catch (err) {
      console.error('Search error:', err);
      return [];
    }
  }, []);

  const handleSubscriptionVerified = () => {
    setIsSubscribed(true);
    fetchLessonStructure();
  };

  const handleBackNavigation = async () => {
    if (lessonHistory.length === 0) return;
    
    // Save current scroll position
    if (selectedLesson) {
      saveScrollPosition(selectedLesson.path);
    }
    
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
      
      // Restore scroll position for previous lesson
      restoreScrollPosition(previousLessonPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load previous lesson');
    }
  };

  // Memoized function to get next lesson based on lesson structure - stay within the same tier
  const getNextLesson = useMemo(() => {
    return (currentPath: string): string | null => {
      // Determine which tier the current lesson belongs to
      const isFreeTier = currentPath.includes('Начальный уровень') || currentPath.includes('📚');
      const isPremiumTier = currentPath.includes('Средний уровень') || currentPath.includes('🎓');
      
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
      
      // Filter lessons from the same tier only
      const sameTierLessons = allLessons.filter(lesson => {
        // Check if this is a main lesson file (path contains "Урок X" and filename starts with "Урок X")
        const pathMatch = lesson.path.match(/Урок (\d+)/);
        const filenameMatch = lesson.filename?.match(/Урок (\d+)/);
        const isMainLesson = pathMatch && filenameMatch && pathMatch[1] === filenameMatch[1];
        
        if (!isMainLesson) return false;
        
        // Filter by tier
        if (isFreeTier) {
          return lesson.path.includes('Начальный уровень') || lesson.path.includes('📚');
        } else if (isPremiumTier) {
          return lesson.path.includes('Средний уровень') || lesson.path.includes('🎓');
        }
        
        return false;
      }).sort((a, b) => {
        const aNum = parseInt(a.path.match(/Урок (\d+)/)?.[1] || '0');
        const bNum = parseInt(b.path.match(/Урок (\d+)/)?.[1] || '0');
        return aNum - bNum;
      });

      const currentIndex = sameTierLessons.findIndex(lesson => lesson.path === currentPath);
      if (currentIndex >= 0 && currentIndex < sameTierLessons.length - 1) {
        return sameTierLessons[currentIndex + 1].path;
      }
      
      return null;
    };
  }, [lessonStructure]);

  // Memoize next lesson path
  const nextLessonPath = useMemo(() => {
    return selectedLesson ? getNextLesson(selectedLesson.path) : null;
  }, [selectedLesson?.path, getNextLesson]);

  // Preload next lesson for better UX
  useEffect(() => {
    if (!nextLessonPath || lessonCache.has(nextLessonPath)) return;

    const preloadTimer = setTimeout(async () => {
      try {
        const apiUrl = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001');
        const response = await fetch(`${apiUrl}/api/lessons/content/${nextLessonPath}`);
        if (response.ok) {
          const lessonData = await response.json();
          lessonCache.set(nextLessonPath, lessonData);
          console.log('Preloaded next lesson:', nextLessonPath);
        }
      } catch (error) {
        console.log('Failed to preload next lesson:', error);
      }
    }, 2000); // Preload after 2 seconds of viewing current lesson

    return () => clearTimeout(preloadTimer);
  }, [nextLessonPath]);

  const loadLastReadLesson = () => {
    try {
      const savedLastRead = localStorage.getItem('last_read_lesson');
      if (savedLastRead) {
        const lastRead = JSON.parse(savedLastRead);
        // Show continue reading if it was read within last 7 days and has significant progress
        const daysSinceRead = (Date.now() - lastRead.timestamp) / (1000 * 60 * 60 * 24);
        if (daysSinceRead <= 7 && lastRead.scrollPosition > 200) {
          setLastReadLesson(lastRead);
          setShowContinueReading(true);
        }
      }
    } catch (error) {
      console.error('Error loading last read lesson:', error);
    }
  };

  const extractTitleFromContent = (content: string, fallbackTitle?: string): string => {
    // Try to extract title from content
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      // Look for H1 or H2 headers
      if (trimmed.startsWith('# ') || trimmed.startsWith('## ')) {
        return trimmed.replace(/^#+\s*/, '').trim();
      }
    }
    return fallbackTitle || 'Урок';
  };

  const updateLastReadLesson = (path: string, lesson: Lesson, scrollPosition: number) => {
    const title = lesson.frontmatter?.title || 
                 extractTitleFromContent(lesson.content) ||
                 path.split('/').pop()?.replace('.md', '') || 
                 'Урок';
    
    const lastRead = {
      path,
      title,
      timestamp: Date.now(),
      scrollPosition
    };
    
    try {
      batchedLocalStorageSet('last_read_lesson', lastRead);
      setLastReadLesson(lastRead);
    } catch (error) {
      console.error('Error saving last read lesson:', error);
    }
  };

  const handleContinueReading = () => {
    if (lastReadLesson) {
      handleLessonSelect(lastReadLesson.path, lastReadLesson.scrollPosition);
      setShowContinueReading(false);
    }
  };

  const handleDismissContinueReading = () => {
    setShowContinueReading(false);
  };

  const loadTheme = () => {
    try {
      const savedTheme = localStorage.getItem('app_theme') as 'light' | 'dark';
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
        setTheme(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
      } else {
        // Default to dark theme
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    }
  };

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    try {
      batchedLocalStorageSet('app_theme', newTheme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  if (loading) {
    return (
      <>
        <div className="loading-container">
          <div className="loading-spinner">Loading lessons...</div>
        </div>
        {/* Скрытая предзагрузка welcome page */}
        {welcomePageReady && (
          <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', opacity: 0 }}>
            <div className={`welcome-screen ${welcomeAnimationsEnabled ? '' : 'no-animations'}`}>
              <h1>Добро пожаловать в H.E.A.R.T!</h1>
              <p>Ваш надежный проводник в мире трейдинга</p>
            </div>
          </div>
        )}
      </>
    );
  }

  if (error) {
    const isSubscriptionError = error.includes('подписка') || error.includes('Telegram');
    
    if (isSubscriptionError) {
      return (
        <Suspense fallback={<div className="loading-container"><div className="loading-spinner">Loading...</div></div>}>
          <SubscriptionCheck 
            onSubscriptionVerified={() => {
              setError(null);
              handleSubscriptionVerified();
            }}
            onBack={() => setError(null)}
          />
        </Suspense>
      );
    }
    
    return (
      <div className="error-container">
        <div className="error-message">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => {
            setError(null);
            fetchLessonStructure();
          }} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <ThemeToggle theme={theme} onThemeChange={handleThemeChange} />
      <Sidebar
        structure={lessonStructure}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLessonSelect={handleLessonSelect}
        onSearch={handleSearch}
        isSubscribed={isSubscribed}
        onSubscriptionRequired={() => setError('Для доступа к этому уроку требуется подписка на наш Telegram канал')}
      />
      
      <main className={`main-content ${sidebarOpen ? 'sidebar-open' : ''}`}>
        {selectedLesson ? (
          <LessonViewer 
            lesson={selectedLesson} 
            onNavigateToLesson={handleLessonSelect}
            onBack={lessonHistory.length > 0 ? handleBackNavigation : undefined}
            nextLessonPath={nextLessonPath}
          />
        ) : (
          <div className={`welcome-screen ${welcomeAnimationsEnabled ? '' : 'no-animations'}`}>
            {/* Global Continue Reading Panel */}
            {showContinueReading && lastReadLesson && (
              <div className="global-continue-reading">
                <div className="continue-reading-card">
                  <div className="continue-reading-info">
                    <span className="lesson-title">{lastReadLesson.title}</span>
                  </div>
                  <div className="continue-reading-actions">
                    <button 
                      className="continue-btn"
                      onClick={handleContinueReading}
                    >
                      Продолжить
                    </button>
                    <button 
                      className="dismiss-btn"
                      onClick={handleDismissContinueReading}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            )}

            <h1>Добро пожаловать в H.E.A.R.T!</h1>
            <p>Ваш надежный проводник в мире трейдинга</p>
            
            <button 
              className="open-sidebar-btn"
              onClick={() => setSidebarOpen(true)}
            >
              Начать обучение
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
