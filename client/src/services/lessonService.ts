import { LessonStructure, Lesson, SearchResult } from '../types';

const API_URL = process.env.REACT_APP_API_URL || '';

export const lessonService = {
  /**
   * Fetch lesson structure from the server - backend handles transformation
   */
  async fetchLessonStructure(): Promise<LessonStructure[]> {
    try {
      const response = await fetch(`${API_URL}/api/lessons/structure`);
      if (!response.ok) {
        throw new Error(`Failed to fetch lesson structure: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Backend now returns properly formatted structure
      return data.structure || data;
    } catch (error) {
      console.error('Error fetching lesson structure:', error);
      throw error instanceof Error ? error : new Error('Unknown error fetching lesson structure');
    }
  },

  /**
   * Fetch specific lesson content - backend handles caching
   */
  async fetchLessonContent(lessonPath: string): Promise<Lesson> {
    const telegramId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    const url = telegramId
      ? `${API_URL}/api/lessons/content/${lessonPath}?telegramId=${telegramId}`
      : `${API_URL}/api/lessons/content/${lessonPath}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch lesson content');
    }
    return await response.json();
  },

  /**
   * Search lessons
   */
  async searchLessons(query: string): Promise<SearchResult[]> {
    const response = await fetch(`${API_URL}/api/lessons/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error('Search failed');
    }
    const data = await response.json();
    return data.results.filter((result: any) => result.type === 'lesson' || result.type === 'file');
  },

  /**
   * Check if user has access to a lesson
   */
  async checkLessonAccess(lessonPath: string): Promise<boolean> {
    const telegramId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    const response = await fetch(
      `${API_URL}/api/subscription/access/check?telegramId=${telegramId || ''}&lessonPath=${encodeURIComponent(lessonPath)}`
    );
    if (!response.ok) return false;
    const data = await response.json();
    return data.hasAccess;
  }
};