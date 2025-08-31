import { LessonStructure, Lesson, SearchResult } from '../types';

const API_URL = process.env.REACT_APP_API_URL || '';

// ✅ FIX: Bounded LRU cache to prevent memory leaks
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number = 50) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// ✅ FIX: Bounded cache instead of unlimited Map
const lessonCache = new LRUCache<string, Lesson>(50); // Max 50 lessons

export const lessonService = {
  async fetchLessonStructure(): Promise<LessonStructure[]> {
    const response = await fetch(`${API_URL}/api/lessons/structure`);
    if (!response.ok) {
      throw new Error('Failed to fetch lesson structure');
    }
    const data = await response.json();
    return data.structure;
  },

  async fetchLessonContent(lessonPath: string): Promise<Lesson> {
    // Check cache first
    const cachedLesson = lessonCache.get(lessonPath);
    if (cachedLesson) {
      return cachedLesson;
    }

    const response = await fetch(`${API_URL}/api/lessons/content/${lessonPath}`);
    if (!response.ok) {
      throw new Error('Failed to fetch lesson content');
    }
    const lessonData = await response.json();
    
    // ✅ FIX: Cache with bounded size
    lessonCache.set(lessonPath, lessonData);
    
    return lessonData;
  },

  async searchLessons(query: string): Promise<SearchResult[]> {
    const response = await fetch(`${API_URL}/api/lessons/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error('Search failed');
    }
    const data = await response.json();
    return data.results.filter((result: any) => result.type === 'lesson' || result.type === 'file');
  },

  async preloadLesson(lessonPath: string): Promise<void> {
    if (lessonCache.get(lessonPath)) return;

    try {
      const response = await fetch(`${API_URL}/api/lessons/content/${lessonPath}`);
      if (response.ok) {
        const lessonData = await response.json();
        lessonCache.set(lessonPath, lessonData);
      }
    } catch (error) {
      // Silently fail for preloading
    }
  },

  clearCache(): void {
    lessonCache.clear();
  },

  getCachedLesson(lessonPath: string): Lesson | undefined {
    return lessonCache.get(lessonPath);
  },

  // ✅ FIX: Add cache size monitoring
  getCacheSize(): number {
    return lessonCache.size();
  }
};