# FRONTKOMMANDO 1942

Ein voll spielbares Echtzeit-Mehrspieler-Browser-Strategiespiel im klassischen OGame-Stil, übertragen in ein neutrales Zweiter-Weltkrieg-Taktik-Setting.

## Features

- **Echtzeit-Ökonomie:** Stahl, Munition, Treibstoff & Stromversorgung (mit Effizienz-Faktor bei Strommangel und exponentieller Lagerkapazität).
- **Stützpunkt-Ausbau & Forschung:** 11 Gebäude, 6 globale Technologien, sequenzielle Bau- & Forschungs-Warteschlangen mit Live-Timern.
- **Heer, Luftwaffe & Verteidigung:** 8 Einheitentypen (Spähwagen, LKW-Konvoi, Infanterie, Leichter/Schwerer Panzer, Feldartillerie, Jagdflugzeug, Bomber) & 4 Verteidigungsanlagen (MG-Nest, Pak, Flak, Schwerer Bunker).
- **6-Runden-Kampfsimulator:** Authentische OGame-Gefechtslogik inkl. Rapidfire, 1%-Abprallregel, 3-Pass-Beute und 70%-Verteidigungs-Wiederaufbau.
- **Sektorenkarte & Missionen:** 5 Front-Sektoren mit KI-Stellungen, Spieler-Stützpunkten und freien Positionen (`Aufklären`, `Angreifen`, `Transportieren`, `Stationieren`, `Einnehmen`).
- **Live-Mehrspieler:**
  - Server-Sent Events (SSE) für Echtzeit-Angriffswarnungen, sofortige Kampf-/Spionageberichte und Live-Online-Status.
  - **Allianzen** (gründen, beitreten, Allianz-Kürzel `[TAG]` auf Sektorenkarte & Rangliste).
  - **Live Front-Funk** (Globaler Chat & privater Allianz-Chat) sowie **Direkt-Funksprüche (PN)** zwischen Spielern.

## Schnellstart (Lokal)

Voraussetzung: **Node.js 22+** (nutzt das integrierte `node:sqlite`, keine nativen Build-Tools erforderlich).

```bash
npm install
npm run build
npm start
```

Danach im Browser öffnen: `http://localhost:3001`

### Entwicklungsmodus (Hot Reload)
```bash
# Terminal 1 (Backend auf :3001)
npm run dev:server

# Terminal 2 (Frontend auf :5173 mit API-Proxy)
npm run dev:client
```

## Auf GitHub veröffentlichen & Online-Mehrspieler hosten

1. Erstelle ein neues leeres Repository auf GitHub (z. B. `frontkommando-1942`).
2. Verbinde dein lokales Repository und pushe den Code:
   ```bash
   git remote add origin https://github.com/<DEIN-USER>/frontkommando-1942.git
   git push -u origin main
   ```
3. **GitHub Actions CI** (`.github/workflows/ci.yml`) prüft ab sofort automatisch TypeScript & Production Build bei jedem Push.
4. **Online-Mehrspieler-Deployment (1 Klick):**
   - **Render.com:** Repository verbinden → `render.yaml` wird automatisch erkannt (Docker + persistente SQLite-Disk).
   - **Docker / eigener Server:**
     ```bash
     docker build -t frontkommando-1942 .
     docker run -d -p 3001:3001 -v fk1942_data:/app/data frontkommando-1942
     ```
