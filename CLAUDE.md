# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Electron desktop application built with:
- **Electron** v39.2.3 with **electron-vite** v4.0.1 as the build tool
- **React** 18 + **TypeScript** 5.9.3 for the renderer process
- **TailwindCSS** 3.4 for styling
- **pnpm** as the package manager

The application features a frameless window with native window controls (traffic lights on macOS), transparency, and system vibrancy/acrylic effects.

## Package Manager

This project uses **pnpm**. All dependency installation and script execution should use `pnpm` commands:

```bash
pnpm install
pnpm dev
```

## Architecture

The application follows Electron's multi-process architecture:

### Main Process (`src/main/`)
- `index.ts` - Creates the browser window with custom configuration:
  - Frameless window (1200x800) with custom title bar
  - Traffic light positioning at y = NAVBAR_HEIGHT / 2 - 8 (macOS)
  - Transparency and vibrancy/acrylic background material
  - IPC handler for 'ping' events

### Preload Process (`src/preload/`)
- `index.ts` - Exposes Electron APIs to renderer via `contextBridge`
- Uses `@electron-toolkit/preload` for standard Electron APIs
- Currently has an empty `api` object for custom APIs

### Renderer Process (`src/renderer/`)
- React application with component structure:
  - `App.tsx` - Root component with three-part layout
  - `components/Navbar.tsx` - Top navigation bar (height: 56px)
  - `components/Sidebar.tsx` - Left sidebar
  - `components/MainContent.tsx` - Main content area
- Path alias: `@renderer` → `src/renderer/src`

## Common Commands

### Development
```bash
# Start Electron in development mode with hot reload
pnpm dev

# Preview production build without packaging
pnpm start
```

### Type Checking
```bash
# Check types for Node.js code (main/preload)
pnpm typecheck:node

# Check types for web code (renderer)
pnpm typecheck:web

# Check all types
pnpm typecheck
```

### Building
```bash
# Build for distribution (runs typecheck first)
pnpm build

# Build and package without installer (unpacked directory)
pnpm build:unpack

# Platform-specific builds
pnpm build:win   # Windows
pnpm build:mac   # macOS
pnpm build:linux # Linux
```

### Code Quality
```bash
# Lint and auto-fix
pnpm lint

# Format code
pnpm format
```

## Build Configuration

### electron-vite.config.ts
- **Main process**: Uses `externalizeDepsPlugin` to exclude dependencies from bundle
- **Preload process**: Uses `externalizeDepsPlugin`
- **Renderer process**: React plugin with path alias support (`@renderer`)

### electron-builder.yml
- **App ID**: `com.electron.app`
- **Product Name**: `desktop`
- **Build resources**: `build/` directory
- **Outputs**:
  - Windows: NSIS installer
  - macOS: DMG with entitlements, notarization disabled
  - Linux: AppImage, snap, deb
- **Auto-updates**: Configured for generic provider (currently points to example.com)

## TypeScript Configuration

Uses project references with three tsconfig files:
- `tsconfig.json` - Root config with references
- `tsconfig.node.json` - Main and preload processes
- `tsconfig.web.json` - Renderer process

## Key Constants

Window dimensions and layout (in `src/main/index.ts`):
- `WINDOW_WIDTH`: 1200
- `WINDOW_HEIGHT`: 800
- `NAVBAR_HEIGHT`: 56
- Traffic light Y position: `NAVBAR_HEIGHT / 2 - 8` = 20px
