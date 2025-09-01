import { useState, useEffect } from 'react';

interface LastReadLesson {
  path: string;
  title: string;
  timestamp: number;
  scrollPosition: number;
}

export const useLastReadLesson = () => {
  const [lastReadLesson, setLastReadLesson] = useState<LastReadLesson | null>(null);
  const [isReturningUser, setIsReturningUser] = useState(false);

  useEffect(() => {
    const loadLastReadLesson = () => {
      try {
        const stored = localStorage.getItem('last_read_lesson');
        if (stored) {
          const lesson: LastReadLesson = JSON.parse(stored);
          
          // Check if the lesson was read recently (within last 30 days)
          const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
          
          if (lesson.timestamp > thirtyDaysAgo) {
            setLastReadLesson(lesson);
            setIsReturningUser(true);
          } else {
            // Clear old data
            localStorage.removeItem('last_read_lesson');
          }
        }
      } catch (error) {
        console.warn('Failed to load last read lesson:', error);
        localStorage.removeItem('last_read_lesson');
      }
    };

    loadLastReadLesson();
  }, []);

  const clearLastReadLesson = () => {
    localStorage.removeItem('last_read_lesson');
    setLastReadLesson(null);
    setIsReturningUser(false);
  };

  return {
    lastReadLesson,
    isReturningUser,
    clearLastReadLesson
  };
};