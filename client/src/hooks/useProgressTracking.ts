import { useState, useEffect, useCallback, useRef } from 'react';
import { Lesson } from '../types';

interface ReadingSession {
  startTime: number;
  activeTime: number;
  lastActivityTime: number;
  scrollProgress: number;
  wordCount: number;
  lessonPath: string;
  engagementPoints: number;
}

interface ProgressMetrics {
  timeSpent: number; // in milliseconds
  scrollProgress: number; // 0-100
  readingSpeed: number; // words per minute
  completionScore: number; // 0-1
  visits: number;
  lastVisited: number;
  engagementLevel: 'low' | 'medium' | 'high';
}

interface TrackingEvent {
  lessonPath: string;
  eventType: 'open' | 'scroll' | 'section_visit' | 'complete' | 'close';
  timestamp: number;
  data?: any;
}

const WORDS_PER_MINUTE_AVERAGE = 200;
const ENGAGEMENT_THRESHOLDS = {
  TIME_MULTIPLIER: 0.4,
  SCROLL_MULTIPLIER: 0.4,
  ENGAGEMENT_MULTIPLIER: 0.2,
  COMPLETION_TIME_THRESHOLD: 5 * 60 * 1000, // 5 minutes minimum
  COMPLETION_SCROLL_THRESHOLD: 80, // 80% scroll minimum
};

export const useProgressTracking = (lesson: Lesson | null) => {
  const [currentSession, setCurrentSession] = useState<ReadingSession | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [metrics, setMetrics] = useState<ProgressMetrics | null>(null);
  const lastScrollPosition = useRef(0);
  const engagementTimer = useRef<NodeJS.Timeout | null>(null);
  const sessionTimer = useRef<NodeJS.Timeout | null>(null);

  // Calculate word count from lesson content
  const getWordCount = useCallback((content: string): number => {
    return content.split(/\s+/).filter(word => word.length > 0).length;
  }, []);

  // Track visibility changes (tab switching)
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isNowActive = !document.hidden;
      setIsActive(isNowActive);
      
      if (!currentSession) return;

      const now = Date.now();
      if (isNowActive) {
        // Resume timing
        setCurrentSession(prev => prev ? {
          ...prev,
          lastActivityTime: now
        } : null);
      } else {
        // Pause timing and save current active time
        setCurrentSession(prev => prev ? {
          ...prev,
          activeTime: prev.activeTime + (now - prev.lastActivityTime)
        } : null);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [currentSession]);

  // Start/restart session when lesson changes
  useEffect(() => {
    if (!lesson) {
      endSession();
      return;
    }

    const wordCount = getWordCount(lesson.content);
    const now = Date.now();
    
    // Load existing progress
    const savedProgress = localStorage.getItem(`lesson_progress_${lesson.path}`);
    let existingMetrics: ProgressMetrics | null = null;
    
    if (savedProgress) {
      try {
        existingMetrics = JSON.parse(savedProgress);
      } catch (e) {
        console.error('Failed to parse saved progress:', e);
      }
    }

    // Start new session
    const newSession: ReadingSession = {
      startTime: now,
      activeTime: 0,
      lastActivityTime: now,
      scrollProgress: 0,
      wordCount,
      lessonPath: lesson.path,
      engagementPoints: 0
    };

    setCurrentSession(newSession);
    setMetrics(existingMetrics);

    // Track lesson open event
    trackEvent({
      lessonPath: lesson.path,
      eventType: 'open',
      timestamp: now,
      data: { wordCount, title: lesson.frontmatter?.title }
    });

    // Update visit count
    const updatedMetrics: ProgressMetrics = {
      timeSpent: existingMetrics?.timeSpent || 0,
      scrollProgress: existingMetrics?.scrollProgress || 0,
      readingSpeed: existingMetrics?.readingSpeed || 0,
      completionScore: existingMetrics?.completionScore || 0,
      visits: (existingMetrics?.visits || 0) + 1,
      lastVisited: now,
      engagementLevel: existingMetrics?.engagementLevel || 'low'
    };
    
    setMetrics(updatedMetrics);
    saveProgress(lesson.path, updatedMetrics);

  }, [lesson, getWordCount]);

  // Auto-save session progress every 10 seconds
  useEffect(() => {
    if (!currentSession || !isActive) return;

    sessionTimer.current = setInterval(() => {
      const now = Date.now();
      const updatedSession = {
        ...currentSession,
        activeTime: currentSession.activeTime + (now - currentSession.lastActivityTime),
        lastActivityTime: now
      };
      
      setCurrentSession(updatedSession);
      updateMetricsFromSession(updatedSession);
    }, 10000);

    return () => {
      if (sessionTimer.current) {
        clearInterval(sessionTimer.current);
      }
    };
  }, [currentSession, isActive]);

  // Handle scroll tracking
  const handleScroll = useCallback((scrollPosition: number, maxScroll: number) => {
    if (!currentSession || !isActive) return;

    const scrollPercent = maxScroll > 0 ? Math.min((scrollPosition / maxScroll) * 100, 100) : 0;
    const now = Date.now();
    
    // Detect slow scroll (engagement indicator)
    const scrollDelta = Math.abs(scrollPosition - lastScrollPosition.current);
    const timeSinceLastScroll = now - (currentSession.lastActivityTime || now);
    const scrollSpeed = timeSinceLastScroll > 0 ? scrollDelta / timeSinceLastScroll : 0;
    
    // Award engagement points for slow, deliberate scrolling
    let engagementPoints = currentSession.engagementPoints;
    if (scrollSpeed < 0.5 && timeSinceLastScroll > 2000) { // Slow scroll for more than 2 seconds
      engagementPoints += 1;
    }

    const updatedSession = {
      ...currentSession,
      scrollProgress: Math.max(currentSession.scrollProgress, scrollPercent),
      lastActivityTime: now,
      engagementPoints
    };
    
    setCurrentSession(updatedSession);
    lastScrollPosition.current = scrollPosition;

    // Track significant scroll events
    if (scrollPercent > currentSession.scrollProgress + 10) {
      trackEvent({
        lessonPath: currentSession.lessonPath,
        eventType: 'scroll',
        timestamp: now,
        data: { scrollPercent: Math.round(scrollPercent) }
      });
    }

    // Check for completion
    checkCompletion(updatedSession);
  }, [currentSession, isActive]);

  // Award engagement points for staying in one section
  const awardEngagementForTimeSpent = useCallback(() => {
    if (!currentSession || !isActive) return;

    setCurrentSession(prev => prev ? {
      ...prev,
      engagementPoints: prev.engagementPoints + 2 // Award points for sustained attention
    } : null);
  }, [currentSession, isActive]);

  // Set up engagement timer for long stays
  useEffect(() => {
    if (!currentSession || !isActive) return;

    engagementTimer.current = setTimeout(awardEngagementForTimeSpent, 30000); // 30 seconds

    return () => {
      if (engagementTimer.current) {
        clearTimeout(engagementTimer.current);
      }
    };
  }, [currentSession, awardEngagementForTimeSpent, isActive]);

  const updateMetricsFromSession = useCallback((session: ReadingSession) => {
    if (!session) return;

    const totalTime = session.activeTime + (isActive ? Date.now() - session.lastActivityTime : 0);
    const readingSpeed = totalTime > 0 ? (session.wordCount / (totalTime / 60000)) : 0; // WPM
    
    const completionScore = calculateCompletionScore({
      timeSpent: totalTime,
      scrollProgress: session.scrollProgress,
      engagementPoints: session.engagementPoints,
      wordCount: session.wordCount
    });

    const engagementLevel = getEngagementLevel(completionScore, session.engagementPoints);

    const updatedMetrics: ProgressMetrics = {
      timeSpent: totalTime,
      scrollProgress: session.scrollProgress,
      readingSpeed,
      completionScore,
      visits: metrics?.visits || 1,
      lastVisited: session.startTime,
      engagementLevel
    };

    setMetrics(updatedMetrics);
    saveProgress(session.lessonPath, updatedMetrics);
  }, [isActive, metrics]);

  const calculateCompletionScore = useCallback(({
    timeSpent,
    scrollProgress,
    engagementPoints,
    wordCount
  }: {
    timeSpent: number;
    scrollProgress: number;
    engagementPoints: number;
    wordCount: number;
  }): number => {
    // Expected reading time based on word count
    const expectedReadingTime = (wordCount / WORDS_PER_MINUTE_AVERAGE) * 60000;
    
    const timeScore = Math.min(timeSpent / expectedReadingTime, 1) * ENGAGEMENT_THRESHOLDS.TIME_MULTIPLIER;
    const scrollScore = (scrollProgress / 100) * ENGAGEMENT_THRESHOLDS.SCROLL_MULTIPLIER;
    const engagementScore = Math.min(engagementPoints / 10, 1) * ENGAGEMENT_THRESHOLDS.ENGAGEMENT_MULTIPLIER;
    
    return Math.min(timeScore + scrollScore + engagementScore, 1);
  }, []);

  const getEngagementLevel = useCallback((completionScore: number, engagementPoints: number): 'low' | 'medium' | 'high' => {
    if (completionScore > 0.7 && engagementPoints > 5) return 'high';
    if (completionScore > 0.4 && engagementPoints > 2) return 'medium';
    return 'low';
  }, []);

  const checkCompletion = useCallback((session: ReadingSession) => {
    const totalTime = session.activeTime + (isActive ? Date.now() - session.lastActivityTime : 0);
    
    if (totalTime >= ENGAGEMENT_THRESHOLDS.COMPLETION_TIME_THRESHOLD && 
        session.scrollProgress >= ENGAGEMENT_THRESHOLDS.COMPLETION_SCROLL_THRESHOLD) {
      
      trackEvent({
        lessonPath: session.lessonPath,
        eventType: 'complete',
        timestamp: Date.now(),
        data: { 
          timeSpent: totalTime, 
          scrollProgress: session.scrollProgress,
          engagementPoints: session.engagementPoints
        }
      });
    }
  }, [isActive]);

  const endSession = useCallback(() => {
    if (currentSession) {
      const now = Date.now();
      const finalSession = {
        ...currentSession,
        activeTime: currentSession.activeTime + (isActive ? now - currentSession.lastActivityTime : 0)
      };
      
      updateMetricsFromSession(finalSession);
      
      trackEvent({
        lessonPath: currentSession.lessonPath,
        eventType: 'close',
        timestamp: now,
        data: { 
          totalTime: finalSession.activeTime,
          scrollProgress: finalSession.scrollProgress,
          engagementPoints: finalSession.engagementPoints
        }
      });
    }
    
    setCurrentSession(null);
    
    if (sessionTimer.current) {
      clearInterval(sessionTimer.current);
    }
    if (engagementTimer.current) {
      clearTimeout(engagementTimer.current);
    }
  }, [currentSession, isActive, updateMetricsFromSession]);

  const trackEvent = useCallback((event: TrackingEvent) => {
    try {
      // Save to localStorage
      const existingEvents = JSON.parse(localStorage.getItem('lesson_events') || '[]');
      existingEvents.push(event);
      
      // Keep only last 1000 events to prevent storage bloat
      if (existingEvents.length > 1000) {
        existingEvents.splice(0, existingEvents.length - 1000);
      }
      
      localStorage.setItem('lesson_events', JSON.stringify(existingEvents));
      
      // TODO: Send to server API for analytics
      // This would be implemented when you have a backend analytics endpoint
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  }, []);

  const saveProgress = useCallback((lessonPath: string, progressMetrics: ProgressMetrics) => {
    try {
      localStorage.setItem(`lesson_progress_${lessonPath}`, JSON.stringify(progressMetrics));
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  }, []);

  const getProgress = useCallback((lessonPath: string): ProgressMetrics | null => {
    try {
      const saved = localStorage.getItem(`lesson_progress_${lessonPath}`);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.error('Failed to load progress:', error);
      return null;
    }
  }, []);

  const markAsComplete = useCallback(() => {
    if (!currentSession) return;

    const now = Date.now();
    trackEvent({
      lessonPath: currentSession.lessonPath,
      eventType: 'complete',
      timestamp: now,
      data: { manualCompletion: true }
    });

    const updatedMetrics: ProgressMetrics = {
      ...metrics!,
      completionScore: 1.0,
      lastVisited: now
    };

    setMetrics(updatedMetrics);
    saveProgress(currentSession.lessonPath, updatedMetrics);
  }, [currentSession, metrics, trackEvent, saveProgress]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endSession();
    };
  }, [endSession]);

  return {
    currentSession,
    metrics,
    isActive,
    handleScroll,
    markAsComplete,
    getProgress,
    endSession
  };
};