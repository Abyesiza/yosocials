import styles from "./LogoSpinner.module.css";

/**
 * One arm of the logo's pinwheel: a quarter of the center ring, then a sweep
 * out into the top-right corner that curls back in. The other three arms
 * are this path rotated by 90°, 180° and 270°.
 */
const ARM =
  "M40.8 59.2 A13 13 0 0 1 40.8 40.8 C47 34 55 21 67 16.5 C79 12 88 21 86.5 31 C85 39 79 41 74 37.5";

type LogoSpinnerProps = {
  /** Width and height in pixels. */
  size?: number;
  /** Announced to screen readers. */
  label?: string;
  className?: string;
};

export default function LogoSpinner({
  size = 48,
  label = "Loading",
  className,
}: LogoSpinnerProps) {
  return (
    <span
      role="status"
      className={[styles.spinner, className].filter(Boolean).join(" ")}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
        <g className={styles.mark}>
          {[0, 90, 180, 270].map((angle) => (
            <path
              key={angle}
              className={styles.arm}
              d={ARM}
              pathLength={100}
              transform={`rotate(${angle} 50 50)`}
            />
          ))}
        </g>
      </svg>
      <span className={styles.srOnly}>{label}</span>
    </span>
  );
}
