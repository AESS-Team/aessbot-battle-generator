import styles from './Header.module.css';
import aessLogo from '../assets/aess-logo.svg';
import aessLogoWhite from '../assets/aess-logo-white.svg';

export default function Header({
  theme,
  onToggleTheme,
  onOpenConfig,
}: {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenConfig: () => void;
}) {
  const themeLogo = theme === 'light' ? aessLogo : aessLogoWhite;

  function openSpectator() {
    window.open(`${window.location.origin}${window.location.pathname}?mode=spectator`, '_blank');
  }

  return (
    <header className={styles.header}>
      <div className="container">
        <div className={styles.inner}>
          <div className={styles.logo}>
            <img className={styles.logoIcon} src={themeLogo} alt="AESS" />
            <div>
              <div className={styles.brand}>AESSBot</div>
              <h1 className={styles.title}>Battle Generator</h1>
            </div>
          </div>
          <p className={styles.subtitle}>
            Generador de combats per a la competició de robots sumo
          </p>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.themeButton}
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Canviar a mode clar' : 'Canviar a mode fosc'}
              title={theme === 'dark' ? 'Mode clar' : 'Mode fosc'}
            >
              {theme === 'dark' ? '☀' : '☾'}
            </button>
            <button
              type="button"
              className={styles.spectatorButton}
              onClick={openSpectator}
              aria-label="Obrir vista espectadors en nova finestra"
              title="Vista espectadors"
            >
              📺 Espectadors
            </button>
            <button
              type="button"
              className={styles.configButton}
              onClick={onOpenConfig}
              aria-label="Obrir configuració de la competició"
              title="Configuració"
            >
              ⚙
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
