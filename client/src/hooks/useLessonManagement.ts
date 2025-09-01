import { useState, useCallback, useMemo, useEffect } from 'react';
import { LessonStructure, Lesson } from '../types';
import { lessonService } from '../services/lessonService';
import { useLocalStorageBatch } from './useLocalStorageBatch';
import { fixCorruptedRussianText, sanitizeLessonTitle, cleanupCorruptedLessonData } from '../utils/encodingUtils';

export const useLessonManagement = () => {
  const [lessonStructure, setLessonStructure] = useState<LessonStructure[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lessonHistory, setLessonHistory] = useState<string[]>([]);
  
  const { batchedLocalStorageSet } = useLocalStorageBatch();

  // Extract title from lesson content
  const extractTitleFromContent = useCallback((content: string, fallbackTitle?: string): string => {
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('# ') || trimmed.startsWith('## ')) {
        const extractedTitle = trimmed.replace(/^#+\s*/, '').trim();
        return fixCorruptedRussianText(extractedTitle);
      }
    }
    return sanitizeLessonTitle(fallbackTitle || 'Урок');
  }, []);

  // Update last read lesson
  const updateLastReadLesson = useCallback((path: string, lesson: Lesson, scrollPosition: number) => {
    const rawTitle = lesson.frontmatter?.title || 
                     extractTitleFromContent(lesson.content) ||
                     path.split('/').pop()?.replace('.md', '') || 
                     'Урок';
    
    const title = sanitizeLessonTitle(rawTitle);
    
    const lastRead = {
      path,
      title,
      timestamp: Date.now(),
      scrollPosition
    };
    
    batchedLocalStorageSet('last_read_lesson', lastRead);
  }, [extractTitleFromContent, batchedLocalStorageSet]);

  // Fetch lesson structure
  const fetchLessonStructure = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Clean up corrupted lesson data
      cleanupCorruptedLessonData();
      
      const structure = await lessonService.fetchLessonStructure();
      setLessonStructure(structure);
      
      // Add loading delay for better UX
      setTimeout(() => {
        setLoading(false);
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  }, []);

  // Handle lesson selection
  const handleLessonSelect = useCallback(async (lessonPath: string, scrollToPosition?: number) => {
    try {
      setError(null);
      
      // Save current lesson to history
      if (selectedLesson && selectedLesson.path !== lessonPath) {
        setLessonHistory(prev => [...prev, selectedLesson.path]);
      }
      
      const lessonData = await lessonService.fetchLessonContent(lessonPath);
      setSelectedLesson(lessonData);
      updateLastReadLesson(lessonPath, lessonData, scrollToPosition || 0);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lesson');
    }
  }, [selectedLesson, updateLastReadLesson]);

  // Handle back navigation
  const handleBackNavigation = useCallback(async () => {
    if (lessonHistory.length === 0) return;
    
    const previousLessonPath = lessonHistory[lessonHistory.length - 1];
    const newHistory = lessonHistory.slice(0, -1);
    
    try {
      const lessonData = await lessonService.fetchLessonContent(previousLessonPath);
      setSelectedLesson(lessonData);
      setLessonHistory(newHistory);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load previous lesson');
    }
  }, [lessonHistory]);

  // Search lessons
  const handleSearch = useCallback(async (query: string) => {
    try {
      return await lessonService.searchLessons(query);
    } catch (err) {
      console.error('Search error:', err);
      return [];
    }
  }, []);

  // Helper function to get ordered lessons (ALL lessons, not just same tier)
  const getOrderedLessons = useCallback(() => {
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
    
    // Filter main lesson files only (not checklists, settings, etc.)
    const filteredLessons = allLessons.filter(lesson => {
      // Skip non-markdown files
      if (!lesson.filename?.endsWith('.md')) return false;
      
      // Skip obvious non-lesson files (like checklists)
      if (lesson.filename.includes('Чек-лист') || lesson.filename.includes('Настройки') || lesson.filename.includes('Сигналы')) {
        return false;
      }
      
      // Check if it has lesson number in the path
      const pathMatch = lesson.path.match(/Урок (\d+)/);
      if (!pathMatch) return false;
      
      // Check if filename also has lesson number
      const filenameMatch = lesson.filename.match(/Урок (\d+)/);
      if (!filenameMatch) return false;
      
      // Check if it's the main lesson file (same lesson number in path and filename)
      const isMainLesson = pathMatch[1] === filenameMatch[1];
      return isMainLesson;
    });
    
    
    // Sort by lesson number (across ALL tiers)
    const sortedLessons = filteredLessons.sort((a, b) => {
      const aNum = parseInt(a.path.match(/Урок (\d+)/)?.[1] || '0');
      const bNum = parseInt(b.path.match(/Урок (\d+)/)?.[1] || '0');
      return aNum - bNum;
    });
    
    return sortedLessons;
  }, [lessonStructure]);

  // Get next lesson path
  const getNextLesson = useMemo(() => {
    return (currentPath: string): string | null => {
      const allLessons = getOrderedLessons();
      const currentIndex = allLessons.findIndex(lesson => lesson.path === currentPath);
      
      if (currentIndex >= 0 && currentIndex < allLessons.length - 1) {
        const nextLesson = allLessons[currentIndex + 1];
        return nextLesson.path;
      }
      
      return null;
    };
  }, [getOrderedLessons]);

  // Get previous lesson path
  const getPrevLesson = useMemo(() => {
    return (currentPath: string): string | null => {
      const allLessons = getOrderedLessons();
      const currentIndex = allLessons.findIndex(lesson => lesson.path === currentPath);
      
      if (currentIndex > 0) {
        const prevLesson = allLessons[currentIndex - 1];
        return prevLesson.path;
      }
      
      return null;
    };
  }, [getOrderedLessons]);

  // Memoize lesson paths
  const nextLessonPath = useMemo(() => {
    if (!selectedLesson) return null;
    
    return getNextLesson(selectedLesson.path);
  }, [selectedLesson, getNextLesson]);

  const prevLessonPath = useMemo(() => {
    if (!selectedLesson) return null;
    
    return getPrevLesson(selectedLesson.path);
  }, [selectedLesson, getPrevLesson]);

  // Preload next lesson for better UX
  useEffect(() => {
    if (!nextLessonPath) return;

    const preloadTimer = setTimeout(() => {
      lessonService.preloadLesson(nextLessonPath);
    }, 2000);

    return () => clearTimeout(preloadTimer);
  }, [nextLessonPath]);

  // Initialize
  useEffect(() => {
    fetchLessonStructure();
  }, [fetchLessonStructure]);

  return {
    // State
    lessonStructure,
    selectedLesson,
    loading,
    error,
    lessonHistory,
    nextLessonPath,
    prevLessonPath,
    
    // Actions
    handleLessonSelect,
    handleBackNavigation,
    handleSearch,
    fetchLessonStructure,
    setSelectedLesson,
    setError
  };
};