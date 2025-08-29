import React from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, onThemeChange }) => {
  const toggleTheme = () => {
    onThemeChange(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <button
      className="theme-toggle"
      onClick={toggleTheme}
      title={`Переключить на ${theme === 'dark' ? 'светлую' : 'тёмную'} тему`}
    >
      {theme === 'dark' ? (
        <Sun size={16} />
      ) : (
        <Moon size={16} />
      )}
    </button>
  );
};

export default ThemeToggle;