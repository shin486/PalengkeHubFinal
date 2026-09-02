// web/src/components/ThemeToggle.jsx
// Web counterpart to the mobile app's src/components/ThemeToggle.js — same
// pill track + sliding marble knob, same light/dark colour values, just
// built with CSS transitions instead of Animated.
import { useTheme } from '../contexts/ThemeContext';

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Dark mode on' : 'Dark mode off'}
      className={`theme-toggle${isDark ? ' is-dark' : ''}`}
      onClick={toggleTheme}
    >
      <span className="theme-toggle-knob" />
    </button>
  );
}
