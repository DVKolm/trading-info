const API_URL = process.env.REACT_APP_API_URL || '';

export interface ProgressMetrics {
  timeSpent: number;
  scrollProgress: number;
  readingSpeed: number;
  completionScore: number;
  engagementLevel: 'low' | 'medium' | 'high';
  visits?: number;
  lastVisited?: number;
}

export interface UserStatistics {
  totalLessonsViewed: number;
  totalLessonsCompleted: number;
  totalTimeSpent: number;
  averageReadingSpeed: number;
  currentStreak: number;
  longestStreak: number;
  completionRate: number;
  levelProgress: Record<string, number>;
  recentActivity: Array<{
    lessonPath: string;
    lastVisited: string;
    timeSpent: number;
    completed: boolean;
    completionScore: number;
  }>;
  achievements: string[];
}

export const progressService = {
  /**
   * Start a reading session
   */
  async startSession(lessonPath: string, wordCount: number): Promise<void> {
    const telegramId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (!telegramId) return;

    try {
      await fetch(`${API_URL}/api/progress/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          telegramId: telegramId.toString(),
          lessonPath,
          wordCount: wordCount.toString()
        })
      });
    } catch (error) {
      console.error('Failed to start session:', error);
    }
  },

  /**
   * Update scroll progress
   */
  async updateScrollProgress(lessonPath: string, scrollProgress: number): Promise<void> {
    const telegramId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (!telegramId) return;

    try {
      await fetch(`${API_URL}/api/progress/session/scroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          telegramId: telegramId.toString(),
          lessonPath,
          scrollProgress: scrollProgress.toString()
        })
      });
    } catch (error) {
      console.error('Failed to update scroll progress:', error);
    }
  },

  /**
   * End reading session
   */
  async endSession(lessonPath: string): Promise<ProgressMetrics | null> {
    const telegramId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (!telegramId) return null;

    try {
      const response = await fetch(`${API_URL}/api/progress/session/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          telegramId: telegramId.toString(),
          lessonPath
        })
      });

      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('Failed to end session:', error);
      return null;
    }
  },

  /**
   * Get progress metrics for a lesson
   */
  async getProgressMetrics(lessonPath: string): Promise<ProgressMetrics | null> {
    const telegramId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (!telegramId) return null;

    try {
      const response = await fetch(`${API_URL}/api/progress/metrics/${telegramId}/${encodeURIComponent(lessonPath)}`);
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('Failed to get progress metrics:', error);
      return null;
    }
  },

  /**
   * Track analytics event
   */
  async trackEvent(eventType: string, lessonPath: string, data?: any): Promise<void> {
    const telegramId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (!telegramId) return;

    try {
      await fetch(`${API_URL}/api/progress/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId,
          eventType,
          lessonPath,
          timestamp: Date.now(),
          ...data
        })
      });
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  },

  /**
   * Get user statistics
   */
  async getUserStatistics(): Promise<UserStatistics | null> {
    const telegramId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (!telegramId) return null;

    try {
      const response = await fetch(`${API_URL}/api/statistics/user/${telegramId}`);
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('Failed to get user statistics:', error);
      return null;
    }
  },

  /**
   * Get current learning streak
   */
  async getCurrentStreak(): Promise<number> {
    const telegramId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (!telegramId) return 0;

    try {
      const response = await fetch(`${API_URL}/api/statistics/streak/${telegramId}`);
      if (!response.ok) return 0;
      return await response.json();
    } catch (error) {
      console.error('Failed to get current streak:', error);
      return 0;
    }
  },

  /**
   * Get learning insights
   */
  async getLearningInsights(): Promise<Record<string, any> | null> {
    const telegramId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (!telegramId) return null;

    try {
      const response = await fetch(`${API_URL}/api/statistics/insights/${telegramId}`);
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('Failed to get learning insights:', error);
      return null;
    }
  }
};