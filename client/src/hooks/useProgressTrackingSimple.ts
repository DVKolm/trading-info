import { useState, useEffect, useRef } from 'react';
import { Lesson } from '../types';
import { progressService, ProgressMetrics } from '../services/progressService';

export const useProgressTrackingSimple = (lesson: Lesson | null) => {
  const [isActive, setIsActive] = useState(true);
  const [metrics, setMetrics] = useState<ProgressMetrics | null>(null);
  const sessionStarted = useRef(false);

  // Calculate word count from lesson content
  const getWordCount = (content: string): number => {
    return content.split(/\s+/).filter(word => word.length > 0).length;
  };

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsActive(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Start session when lesson changes
  useEffect(() => {
    if (!lesson || sessionStarted.current) return;

    const wordCount = getWordCount(lesson.content);
    progressService.startSession(lesson.path, wordCount);
    sessionStarted.current = true;

    // Track lesson open event
    progressService.trackEvent('open', lesson.path, {
      wordCount,
      title: lesson.frontmatter?.title
    });

    // Load existing metrics
    progressService.getProgressMetrics(lesson.path)
      .then(setMetrics)
      .catch(console.error);

    return () => {
      if (sessionStarted.current) {
        progressService.endSession(lesson.path)
          .then(finalMetrics => {
            if (finalMetrics) {
              setMetrics(finalMetrics);
            }
          })
          .catch(console.error);
        sessionStarted.current = false;
      }
    };
  }, [lesson]);

  // Update scroll progress
  const updateScrollProgress = (scrollProgress: number) => {
    if (!lesson) return;

    progressService.updateScrollProgress(lesson.path, scrollProgress);
    progressService.trackEvent('scroll', lesson.path, { scrollProgress });
  };

  return {
    isActive,
    metrics,
    updateScrollProgress
  };
};