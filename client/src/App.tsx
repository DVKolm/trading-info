import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { WebApp } from '@twa-dev/types';

// Components
import Sidebar from './components/Sidebar';
import LessonViewer from './components/LessonViewer';
import FloatingActionButton from './components/FloatingActionButton';
import WelcomeScreen from './components/WelcomeScreen';
import LoadingScreen from './components/LoadingScreen';
import ErrorScreen from './components/ErrorScreen';

// Hooks
import { useLessonManagement } from './hooks/useLessonManagement';
import { useSubscriptionManager } from './hooks/useSubscriptionManager';
import { useThemeManager } from './hooks/useThemeManager';
import { useScrollManager } from './hooks/useScrollManager';

// Types
import { Lesson } from './types';

// Styles
import './App.css';

// Lazy load admin components
const AdminPage = lazy(() => import('./pages/AdminPage'));
const UserProfile = lazy(() => import('./components/UserProfile'));

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
  // UI State
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [welcomePageReady, setWelcomePageReady] = useState(false);
  const [welcomeAnimationsEnabled, setWelcomeAnimationsEnabled] = useState(false);
  const [showAdminPage, setShowAdminPage] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);

  // Custom hooks
  const {
    lessonStructure,
    selectedLesson,
    loading,
    error,
    lessonHistory,
    nextLessonPath,
    handleLessonSelect: originalHandleLessonSelect,
    handleBackNavigation,
    handleSearch,
    fetchLessonStructure,
    setSelectedLesson,
    setError
  } = useLessonManagement();

  const {
    isSubscribed,
    handleSubscriptionVerified,
    handleSubscriptionRequired
  } = useSubscriptionManager();

  const { theme, handleThemeChange } = useThemeManager();

  const {
    saveScrollPosition,
    restoreScrollPosition,
    createThrottledScrollHandler,
    scrollToPosition
  } = useScrollManager();

  // Admin logic
  const telegramUserId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  const authorizedUserIds = ['781182099', '5974666109'];
  const isAdmin = telegramUserId && authorizedUserIds.includes(String(telegramUserId));

  // Enhanced lesson selection with scroll management
  const handleLessonSelect = useCallback(async (lessonPath: string, scrollToPos?: number) => {
    // Save scroll position of current lesson before switching
    if (selectedLesson && selectedLesson.path !== lessonPath) {
      saveScrollPosition(selectedLesson.path);
    }

    // Handle lesson selection
    await originalHandleLessonSelect(lessonPath, scrollToPos);
    
    // Close sidebar on mobile after selection
    setSidebarOpen(false);
    
    // Handle scroll position
    const isCached = Boolean(scrollToPos);
    scrollToPosition(scrollToPos || 0, isCached);
  }, [selectedLesson, saveScrollPosition, originalHandleLessonSelect, scrollToPosition]);

  // Subscription requirement handler
  const onSubscriptionRequired = useCallback(() => {
    const message = handleSubscriptionRequired();
    setError(message);
  }, [handleSubscriptionRequired, setError]);

  // Error handlers
  const handleSubscriptionVerifiedLocal = useCallback(() => {
    setError(null);
    handleSubscriptionVerified();
    fetchLessonStructure();
  }, [handleSubscriptionVerified, fetchLessonStructure, setError]);

  const handleRetry = useCallback(() => {
    setError(null);
    fetchLessonStructure();
  }, [setError, fetchLessonStructure]);

  const handleErrorBack = useCallback(() => {
    setError(null);
  }, [setError]);

  // Home navigation
  const handleHomeClick = useCallback(() => {
    if (selectedLesson) {
      saveScrollPosition(selectedLesson.path);
    }
    
    setSelectedLesson(null);
    setSidebarOpen(false);
    
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 50);
  }, [selectedLesson, saveScrollPosition, setSelectedLesson]);

  // Scroll tracking setup
  useEffect(() => {
    if (!selectedLesson) return;

    const throttledScrollHandler = createThrottledScrollHandler(
      selectedLesson,
      (path: string, lesson: Lesson, scrollPosition: number) => {
        // This would be the updateLastReadLesson logic
        // For now, we'll keep it simple
      }
    );

    const handleScroll = () => throttledScrollHandler;

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
  }, [selectedLesson, createThrottledScrollHandler]);

  // Initialize Telegram WebApp
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#1e1e1e');
      tg.setBackgroundColor('#1e1e1e');
    }
  }, []);

  // Handle welcome page loading
  useEffect(() => {
    if (!loading) {
      setTimeout(() => {
        setWelcomePageReady(true);
        setTimeout(() => {
          setWelcomeAnimationsEnabled(true);
        }, 100);
      }, 300);
    }
  }, [loading]);

  // Render loading screen
  if (loading) {
    return (
      <LoadingScreen 
        welcomePageReady={welcomePageReady}
        welcomeAnimationsEnabled={welcomeAnimationsEnabled}
      />
    );
  }

  // Render error screen
  if (error) {
    return (
      <ErrorScreen
        error={error}
        onRetry={handleRetry}
        onBack={handleErrorBack}
        onSubscriptionVerified={handleSubscriptionVerifiedLocal}
      />
    );
  }

  // Render admin page
  if (isAdmin && showAdminPage) {
    return (
      <Suspense fallback={<LoadingScreen welcomePageReady={true} welcomeAnimationsEnabled={false} />}>
        <AdminPage onBack={() => setShowAdminPage(false)} />
      </Suspense>
    );
  }

  // Main app render
  return (
    <div className="app">
      <FloatingActionButton
        theme={theme}
        onThemeChange={handleThemeChange}
        onProfileClick={() => setShowUserProfile(true)}
        onHomeClick={handleHomeClick}
        isAdmin={!!isAdmin}
        onAdminClick={() => setShowAdminPage(true)}
        onUploadClick={() => {
          console.log('Upload clicked');
        }}
      />
      
      {showUserProfile && (
        <Suspense fallback={<LoadingScreen welcomePageReady={true} welcomeAnimationsEnabled={false} />}>
          <UserProfile 
            onClose={() => setShowUserProfile(false)}
            telegramUser={window.Telegram?.WebApp?.initDataUnsafe?.user}
          />
        </Suspense>
      )}
      
      <Sidebar
        structure={lessonStructure}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onLessonSelect={handleLessonSelect}
        onSearch={handleSearch}
        isSubscribed={isSubscribed}
        onSubscriptionRequired={onSubscriptionRequired}
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
          <WelcomeScreen
            welcomeAnimationsEnabled={welcomeAnimationsEnabled}
            onOpenSidebar={() => setSidebarOpen(true)}
          />
        )}
      </main>
    </div>
  );
};

export default App;