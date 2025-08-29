import React, { useState, useEffect } from 'react';
import { Award } from 'lucide-react';

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
  streak: number; // consecutive days with lesson activity
}

const ProgressDashboard: React.FC = () => {
  const [stats, setStats] = useState<OverallStats | null>(null);

  // Load and calculate statistics
  useEffect(() => {
    const calculateStats = (): OverallStats => {
      const allKeys = Object.keys(localStorage).filter(key => key.startsWith('lesson_progress_'));
      const progressData: Array<{ path: string; data: LessonProgressData }> = [];
      
      // Parse all lesson progress data
      allKeys.forEach(key => {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          if (data.timeSpent !== undefined && data.lastVisited) {
            progressData.push({
              path: key.replace('lesson_progress_', ''),
              data
            });
          }
        } catch (e) {
          console.error('Failed to parse lesson progress:', e);
        }
      });

      if (progressData.length === 0) {
        return { streak: 0 };
      }

      // Calculate streak (consecutive days with lesson activity)
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

      return { streak };
    };

    setStats(calculateStats());
  }, []);

  if (!stats) return null;

  return (
    <div className="progress-dashboard">
      <h2 className="dashboard-title">Your Learning Progress</h2>
      
      {/* Streak Card */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <Award size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-number">{stats.streak}</div>
            <div className="stat-label">{stats.streak === 1 ? 'Day Streak' : 'Days Streak'}</div>
            <div className="stat-description">
              {stats.streak > 0 
                ? `Great job! Keep your learning streak going!` 
                : 'Start your learning journey today!'
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressDashboard;