# Scenia: Strategic Roadmap & Visualiser

**Scenia is now open source!** We've made the full codebase publicly available under the Apache 2.0 licence. Whether you want to self-host, contribute, or just explore — you're welcome here.

Scenia is a powerful, interactive visualiser designed for IT strategic planning. It allows teams to map out initiatives across different IT assets, track dependencies, and identify scheduling conflicts in a clean, timeline-based interface.

**[🌐 View Live Demo](https://scenia.website)** · **[⭐ Star on GitHub](https://github.com/waylonkenning/scenia)**

## 🚀 Key Features

- **Interactive Timeline:** Drag the edges of initiative bars to change their duration directly in the visualiser.
- **Asset Organisation:** Group initiatives by IT Asset and categorise assets. Drag and drop asset categories to reorder your view.
- **Dependency Tracking:** Visualise relationships between initiatives with dynamic SVG-based dependency arrows.
- **Version History:** Save point-in-time snapshots of your entire plan, compare changes between versions, and restore previous states.
- **Conflict Detection:** Automatically identifies overlapping initiatives on the same asset and highlights them.
- **Real-time Persistence:** All changes are saved instantly to your browser's IndexedDB, ensuring your data remains across sessions.
- **Data Management:** Full CRUD operations for Assets, Initiatives, Milestones, and more, including Excel import/export capabilities.

## 🛠 Tech Stack

- **Frontend:** React 19 with TypeScript
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Date Handling:** date-fns
- **Build Tool:** Vite
- **Storage:** IndexedDB (via the `idb` library) for robust client-side data persistence.

## 🏗 Architecture

### Visualiser View (`src/components/Timeline.tsx`)
The core of the application. It uses a custom layout engine to position initiatives without overlapping within an asset's row. It employs a high-performance SVG layer for rendering dependency arrows that stay connected even as you move or resize initiatives.

### Data Management (`src/components/DataManager.tsx`)
A secondary view that allows for bulk editing of the underlying data in a table format.

### Persistence Layer (`src/lib/db.ts`)
Manages the connection to IndexedDB, providing a local-first experience that works without a complex backend while still being more robust than `localStorage`.

## 🚢 Deployment

Scenia is containerised using Docker and deployed to **Google Cloud Run** via **Google Cloud Build**.

### Continuous Deployment
The deployment pipeline is defined in `cloudbuild.yaml`:
1.  **Build:** A multi-stage Docker build is triggered.
2.  **Push:** The resulting image is pushed to the Google Container Registry.
3.  **Deploy:** The image is deployed to Google Cloud Run, automatically serving the application over HTTPS.

## 💻 Local Development

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/waylonkenning/scenia.git
    cd scenia
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Start the development server:**
    ```bash
    npm run dev
    ```
4.  **Run tests:**
    ```bash
    npm test
    ```

## 📦 Standalone browser version

### Download the ready-made file

1. Open the repository's **Actions** tab on GitHub.
2. Select **Build standalone HTML** and open the latest successful run.
3. In the run's **Artifacts** section, click **Scenia-Standalone**.
4. Unzip the download, then double-click `scenia-standalone.html` to open it
   directly in your browser. No installation or web server is required.

GitHub requires you to be signed in to download workflow artifacts. Artifacts are
kept for 30 days; the workflow can be run again at any time using its **Run
workflow** button.

### Build it yourself

Alternatively, build a private, server-free edition of Scenia as a single HTML
file from a local checkout:

```bash
npm run build:standalone
```

Open `dist-standalone/scenia-standalone.html` directly from your file explorer. All
JavaScript, styles, and help images are embedded in that file, so it can be copied
to another computer without its surrounding folder. The standalone edition opens
straight into the application, stores work in the browser's IndexedDB, and omits
cloud sharing and shared-link imports. Excel import/export and PDF/PNG downloads
remain available and run locally in the browser.

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to get started.

## 📜 License

Licensed under the **Apache License 2.0**. See [LICENSE](LICENSE) for the full text.
