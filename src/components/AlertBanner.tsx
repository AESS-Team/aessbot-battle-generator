import styles from './AlertBanner.module.css';

type AlertType = 'error' | 'warning' | 'info' | 'success';

interface Alert {
  type: AlertType;
  message: string;
}

interface Props {
  alerts: Alert[];
}

const icons: Record<AlertType, string> = {
  error: '🚫',
  warning: '⚠️',
  info: 'ℹ️',
  success: '✅',
};

/**
 * Displays a list of alert banners (errors, warnings, info, success).
 *
 * @param alerts - Array of alerts to display.
 */
export default function AlertBanner({ alerts }: Props) {
  if (alerts.length === 0) return null;

  return (
    <div className={styles.container} role="alert" aria-live="polite">
      {alerts.map((alert, idx) => (
        <div
          key={idx}
          className={`${styles.banner} ${styles[alert.type]} animate-fade-in`}
        >
          <span className={styles.icon}>{icons[alert.type]}</span>
          <span className={styles.message}>{alert.message}</span>
        </div>
      ))}
    </div>
  );
}

export type { Alert, AlertType };
