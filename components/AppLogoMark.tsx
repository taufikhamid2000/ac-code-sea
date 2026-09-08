type AppLogoMarkProps = {
  size?: number;
  className?: string;
};

/**
 * The AC · Code SEA mark: a keris (the wavy Southeast Asian dagger) crossed
 * with the Brotherhood's hidden-blade hook, resting above a horizon wave —
 * Malacca strait, pre-colonial dagger-craft, and the series' iconography in
 * one original silhouette. Renders in `currentColor` so it can sit on dark
 * or light chrome; pass `size` to scale it (defaults to 32px favicon-safe).
 */
export function AppLogoMark({ size = 32, className }: AppLogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="AC · Code SEA emblem"
    >
      <circle cx="32" cy="32" r="30" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" />

      {/* Keris blade: wavy dagger, point down, doubling as a hidden-blade silhouette */}
      <path
        d="M32 8
           C 34.5 12, 29.5 15, 32 19
           C 34.5 23, 29.5 26, 32 30
           C 34.5 34, 30.5 37, 32 40
           L 34.5 40
           C 33.6 37.4, 36.6 34.4, 34.3 30
           C 36.8 26, 31.8 23, 34.3 19
           C 36.8 15, 31.8 12, 34.3 8
           Z"
        fill="currentColor"
      />

      {/* Hilt / cross-guard */}
      <rect x="26" y="40" width="12" height="3.4" rx="1.2" fill="currentColor" />
      <rect x="30.3" y="43.4" width="3.4" height="9" rx="1.4" fill="currentColor" />

      {/* Horizon wave — the strait */}
      <path
        d="M12 53c4-2.6 8-2.6 12 0s8 2.6 12 0 8-2.6 12 0 8 2.6 12 0"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />
    </svg>
  );
}
