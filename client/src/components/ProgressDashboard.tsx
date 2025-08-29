import React, { useState, useEffect, useMemo } from 'react';
import { Clock, BookOpen, TrendingUp, Award, Eye, Target } from 'lucide-react';

interface LessonProgressData {
  timeSpent: number;
  scrollProgress: number;
  readingSpeed: number;
  completionScore: number;
  visits: number;
  lastVisited: number;
  engagementLevel: 'low' | 'medium' | 'high';
}

interface OverallStats {
  totalLessonsStarted: number;
  totalLessonsCompleted: number;
  totalTimeSpent: number; // in milliseconds
  averageCompletionScore: number;
  averageReadingSpeed: number; // words per minute
  totalVisits: number;
  streak: number; // consecutive days with lesson activity
}

const ProgressDashboard: React.FC = () => {
  const [stats, setStats] = useState<OverallStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<Array<{
    lessonPath: string;
    title: string;
    completionScore: number;
    timeSpent: number;
    lastVisited: number;
  }>>([]);

  // Load and calculate statistics
  useEffect(() => {
    const calculateStats = (): OverallStats => {
      const allKeys = Object.keys(localStorage).filter(key => key.startsWith('lesson_progress_'));
      const progressData: Array<{ path: string; data: LessonProgressData }> = [];
      
      // Parse all lesson progress data
      allKeys.forEach(key => {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          if (data.timeSpent !== undefined) {
            progressData.push({
              path: key.replace('lesson_progress_', ''),
              data
            });
          }
        } catch (e) {
          console.error('Failed to parse lesson progress:', e);
        }
      });

      // Calculate total lessons from lesson structure
      const getTotalLessons = (): number => {
        try {
          const structureKey = localStorage.getItem('lesson_structure_cache');
          if (structureKey) {
            const structure = JSON.parse(structureKey);

            const countLessons = (items: any[]): number => {
              let count = 0;
              items.forEach(item => {
                if (item.type === 'file' && item.name && item.name.endsWith('.md')) {
                  count++;
                } else if (item.children && Array.isArray(item.children)) {
                  count += countLessons(item.children);
                } else if (item.type === 'folder' && item.children) {
                  count += countLessons(item.children);
                }
              });
              return count;
            };

            const totalLessons = countLessons(structure);
            return totalLessons > 0 ? totalLessons : progressData.length;
          }
          return progressData.length;
        } catch (e) {
          console.error('Failed to calculate total lessons:', e);

          // Попробуем получить структуру из API напрямую
          fetch('/api/lessons/structure')
            .then(response => response.json())
            .then(data => {
              if (data.structure) {
                const countLessons = (items: any[]): number => {
                  let count = 0;
                  items.forEach(item => {
                    if (item.type === 'file' && item.name && item.name.endsWith('.md')) {
                      count++;
                    } else if (item.children && Array.isArray(item.children)) {
                      count += countLessons(item.children);
                    }
                  });
                  return count;
                };

                return countLessons(data.structure);
              }
            })
            .catch(() => {});

          return Math.max(5, progressData.length); // Minimum 5 lessons as user mentioned
        }
      };

      const totalLessons = getTotalLessons();

      if (progressData.length === 0) {
        return {
          totalLessonsStarted: totalLessons,
          totalLessonsCompleted: 0,
          totalTimeSpent: 0,
          averageCompletionScore: 0,
          averageReadingSpeed: 0,
          totalVisits: 0,
          streak: 0
        };
      }

      // Calculate statistics
      const totalTimeSpent = progressData.reduce((sum, { data }) => sum + data.timeSpent, 0);
      const totalVisits = progressData.reduce((sum, { data }) => sum + data.visits, 0);
      const completedLessons = progressData.filter(({ data }) => data.completionScore >= 0.8).length;
      
      const averageCompletionScore = progressData.reduce((sum, { data }) => sum + data.completionScore, 0) / progressData.length;
      
      const validReadingSpeeds = progressData.filter(({ data }) => data.readingSpeed > 0);
      const averageReadingSpeed = validReadingSpeeds.length > 0 
        ? validReadingSpeeds.reduce((sum, { data }) => sum + data.readingSpeed, 0) / validReadingSpeeds.length
        : 0;


      // Calculate streak (simplified - consecutive days with activity)
      const sortedByDate = progressData
        .sort((a, b) => b.data.lastVisited - a.data.lastVisited)
        .map(({ data }) => new Date(data.lastVisited).toDateString());
      
      let streak = 0;
      const uniqueDatesSet = new Set(sortedByDate);
      const uniqueDates = Array.from(uniqueDatesSet);
      
      for (let i = 0; i < uniqueDates.length; i++) {
        const date = new Date(uniqueDates[i]);
        const expectedDate = new Date();
        expectedDate.setDate(expectedDate.getDate() - i);
        
        if (date.toDateString() === expectedDate.toDateString()) {
          streak++;
        } else {
          break;
        }
      }

      return {
        totalLessonsStarted: totalLessons,
        totalLessonsCompleted: completedLessons,
        totalTimeSpent,
        averageCompletionScore,
        averageReadingSpeed,
        totalVisits,
        streak
      };
    };

    const getRecentActivity = () => {
      const allKeys = Object.keys(localStorage).filter(key => key.startsWith('lesson_progress_'));
      const recentLessons: Array<{
        lessonPath: string;
        title: string;
        completionScore: number;
        timeSpent: number;
        lastVisited: number;
      }> = [];

      allKeys.forEach(key => {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          if (data.timeSpent !== undefined) {
            const lessonPath = key.replace('lesson_progress_', '');
            const title = lessonPath.split('/').pop()?.replace('.md', '') || 'Unknown Lesson';
            
            recentLessons.push({
              lessonPath,
              title,
              completionScore: data.completionScore,
              timeSpent: data.timeSpent,
              lastVisited: data.lastVisited
            });
          }
        } catch (e) {
          console.error('Failed to parse lesson progress:', e);
        }
      });

      // Sort by last visited and take top 5
      return recentLessons
        .sort((a, b) => b.lastVisited - a.lastVisited)
        .slice(0, 5);
    };

    setStats(calculateStats());
    setRecentActivity(getRecentActivity());
  }, []);

  const formatTime = (milliseconds: number): string => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getCompletionColor = (score: number): string => {
    if (score >= 0.8) return '#4ade80';
    if (score >= 0.5) return '#fbbf24';
    return '#f87171';
  };

  const completionPercentage = useMemo(() => {
    if (!stats || stats.totalLessonsStarted === 0) return 0;
    return Math.round((stats.totalLessonsCompleted / stats.totalLessonsStarted) * 100);
  }, [stats]);

  if (!stats) return null;

  return (
    <div className="progress-dashboard">
      <h2 className="dashboard-title">Your Learning Progress</h2>
      
      {/* Overview Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <BookOpen size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-number">{stats.totalLessonsCompleted}/{stats.totalLessonsStarted}</div>
            <div className="stat-label">Lessons Completed</div>
            {stats.totalLessonsStarted > 0 && (
              <div className="stat-progress">
                <div 
                  className="progress-bar" 
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            )}
          </div>
        </div>



        <div className="stat-card">
          <div className="stat-icon">
            <Award size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-number">{stats.streak}</div>
            <div className="stat-label">Day Streak</div>
          </div>
        </div>
      </div>


      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <div className="recent-activity">
          <h3>Recent Lessons</h3>
          <div className="activity-list">
            {recentActivity.map((lesson, index) => (
              <div key={lesson.lessonPath} className="activity-item">
                <div className="activity-info">
                  <div className="activity-title">{lesson.title}</div>
                  <div className="activity-meta">
                    {formatTime(lesson.timeSpent)} • {new Date(lesson.lastVisited).toLocaleDateString()}
                  </div>
                </div>
                <div 
                  className="completion-indicator"
                  style={{ backgroundColor: getCompletionColor(lesson.completionScore) }}
                  title={`${Math.round(lesson.completionScore * 100)}% complete`}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressDashboard;