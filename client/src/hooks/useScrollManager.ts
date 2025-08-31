import { useState, useCallback, useMemo, useRef } from 'react';
import { Lesson } from '../types';
import { useLocalStorageBatch } from './useLocalStorageBatch';

export const useScrollManager = () => {
  const [scrollPositions, setScrollPositions] = useState<Map<string, number>>(new Map());
  const { batchedLocalStorageSet, getLocalStorageItem } = useLocalStorageBatch();

  const saveScrollPosition = useCallback((lessonPath: string) => {
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
  }, [batchedLocalStorageSet]);

  const restoreScrollPosition = useCallback((lessonPath: string) => {
    // Load from localStorage first
    const savedPositions = getLocalStorageItem('lesson_scroll_positions');
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
  }, [scrollPositions, getLocalStorageItem]);

  // Throttled scroll handler for better performance
  const createThrottledScrollHandler = useMemo(() => {
    let isThrottled = false;
    
    return (selectedLesson: Lesson, updateLastReadLesson: (path: string, lesson: Lesson, scrollPosition: number) => void) => {
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
      }, 250); // Throttle to every 250ms
    };
  }, [batchedLocalStorageSet]);

  const scrollToPosition = useCallback((scrollPosition: number, cached: boolean = false) => {
    if (scrollPosition <= 0) {
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
      }, cached ? 50 : 100);
      return;
    }

    // For saved positions, wait for content to load and try multiple times
    let attempts = 0;
    const maxAttempts = cached ? 5 : 10; // Fewer attempts for cached content
    const interval = cached ? 50 : 100; // Faster interval for cached content
    
    const scrollInterval = setInterval(() => {
      const lessonViewer = document.querySelector('.lesson-viewer');
      const mainContent = document.querySelector('.main-content');
      
      const container = lessonViewer || mainContent || document.body;
      const containerHeight = container.scrollHeight;
      
      if (containerHeight > scrollPosition || attempts >= maxAttempts) {
        if (lessonViewer) {
          lessonViewer.scrollTop = scrollPosition;
        } else if (mainContent) {
          mainContent.scrollTop = scrollPosition;
        } else {
          window.scrollTo(0, scrollPosition);
        }
        clearInterval(scrollInterval);
      }
      attempts++;
    }, interval);
  }, []);

  return {
    scrollPositions,
    saveScrollPosition,
    restoreScrollPosition,
    createThrottledScrollHandler,
    scrollToPosition
  };
};