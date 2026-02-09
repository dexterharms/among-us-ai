import { useState, useEffect } from 'react';
import { Button } from '@mui/base/Button';

export type Theme = 'light' | 'dark';

interface ThemeToggleProps {
  onThemeChange?: (theme: Theme) => void;
}

/**
 * ThemeToggle - Dark/light mode toggle button
 *
 * Defaults to system preference, with manual override.
 * Persists to localStorage.
 */
export function ThemeToggle({ onThemeChange }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    // Default to system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    // Apply theme to document
    document.documentElement.className = theme;
    document.documentElement.setAttribute('data-theme', theme);

    // Persist to localStorage
    localStorage.setItem('theme', theme);

    // Notify parent
    onThemeChange?.(theme);
  }, [theme, onThemeChange]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <Button
      onClick={toggleTheme}
      className="theme-toggle"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </Button>
  );
}
