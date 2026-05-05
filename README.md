# 🥊 AESSBot Battle Generator

Aplicació web per gestionar la generació i seguiment dels combats de robots sumo de l'AESSBot. Permet introduir equips, configurar la competició, generar la fase de lliga, registrar resultats, gestionar la repesca i preparar les eliminatòries finals.

El projecte està fet amb **React**, **TypeScript** i **Vite**.

## Requisits

- Node.js instal·lat
- NPM instal·lat

## Execució en local

Instal·la les dependències:

```bash
npm install
```

Arrenca el servidor de desenvolupament:

```bash
npm run dev
```

Després obre l'URL que mostri Vite al terminal, normalment:

```text
http://localhost:5173
```

## Comandes disponibles

```bash
npm run dev
```

Executa l'aplicació en mode desenvolupament.

```bash
npm run build
```

Genera la versió de producció dins de `dist/`.

```bash
npm run preview
```

Serveix localment la versió generada amb `npm run build`.

```bash
npm run lint
```

Executa ESLint per revisar possibles problemes de codi.

## Ús bàsic

1. Obre la configuració de la competició.
2. Afegeix els equips participants.
3. Ajusta els paràmetres de combats i classificació.
4. Genera les fases i registra els resultats.
5. Utilitza el mode espectador amb `?mode=spectator` si vols mostrar una vista pública dels resultats.
