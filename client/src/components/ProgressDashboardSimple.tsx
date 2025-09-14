import React, { useState, useEffect } from 'react';
import { Award } from 'lucide-react';
import { progressService, UserStatistics } from '../services/progressService';

const ProgressDashboardSimple: React.FC = () => {
  const [stats, setStats] = useState<UserStatistics | null>(null);
  const [loading, setLoading] = useState(true);

  // Load statistics from backend
  useEffect(() => {
    const loadStats = async () => {
      try {
        const statistics = await progressService.getUserStatistics();
        setStats(statistics);
      } catch (error) {
        console.error('Failed to load statistics:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  if (loading) {
    return <div className="progress-dashboard">Loading statistics...</div>;
  }

  if (!stats) {
    return (
      <div className="progress-dashboard">
        <h2 className="dashboard-title">Your Learning Progress</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <Award size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-number">0</div>
              <div className="stat-label">Days Streak</div>
              <div className="stat-description">
                Start your learning journey today!
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            <div className="stat-number">{stats.currentStreak}</div>
            <div className="stat-label">{stats.currentStreak === 1 ? 'Day Streak' : 'Days Streak'}</div>
            <div className="stat-description">
              {stats.currentStreak > 0
                ? `Great job! Keep your learning streak going!`
                : 'Start your learning journey today!'
              }
            </div>
          </div>
        </div>

        {/* Lessons Completed */}
        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-number">{stats.totalLessonsCompleted}</div>
            <div className="stat-label">Lessons Completed</div>
            <div className="stat-description">
              Out of {stats.totalLessonsViewed} lessons viewed
            </div>
          </div>
        </div>

        {/* Reading Speed */}
        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-number">{Math.round(stats.averageReadingSpeed)}</div>
            <div className="stat-label">Words per Minute</div>
            <div className="stat-description">
              {stats.averageReadingSpeed > 200 ? 'Fast reader!' : 'Keep practicing!'}
            </div>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-number">{Math.round(stats.completionRate)}%</div>
            <div className="stat-label">Completion Rate</div>
            <div className="stat-description">
              {stats.completionRate > 80 ? 'Excellent!' : 'Room for improvement'}
            </div>
          </div>
        </div>
      </div>

      {/* Achievements */}
      {stats.achievements.length > 0 && (
        <div className="achievements-section">
          <h3>Achievements</h3>
          <div className="achievements-grid">
            {stats.achievements.map((achievement, index) => (
              <div key={index} className="achievement-badge">
                {achievement.replace(/_/g, ' ')}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressDashboardSimple;