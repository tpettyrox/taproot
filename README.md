# Taproot — Interactive Genealogy Platform

A visual family history application built with React + D3.js on the frontend and Node.js/TypeScript + Neo4j on the backend.

## Features

- **Generational tree visualization** — D3 SVG canvas with pan & zoom; persons grouped by generation with curved parent-child and dashed spouse connectors
- **Person cards** — click any node to open a full profile with Overview, Family, and Photos & Docs tabs
- **Editing** — add/edit any person's biographical details inline within the card
- **Relationship management** — link parents, children, and spouses (with marriage/divorce dates and status)
- **Media** — drag-and-drop photo/document upload; auto-thumbnail generation; captioning
- **Neo4j graph database** — natural fit for family relationship traversals
- **File storage** — local filesystem with sharp-generated thumbnails (easily swappable for S3/MinIO)
- **MCP server** — AI assistants (Claude Desktop, etc.) can query and edit the tree via the Model Context Protocol

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Tree rendering | D3.js v7 (custom generational layout) |
| Data fetching | TanStack Query v5 |
| Backend | Node.js, Express, TypeScript |
| Graph database | Neo4j 5 (Community) |
| File handling | Multer + Sharp |
| MCP server | `@modelcontextprotocol/sdk` 1.x (stdio transport) |

## Quick Start

### 1. Start Neo4j

```bash
docker compose up -d
```

Neo4j browser available at http://localhost:7474 (neo4j / taprootpass)

### 2. Install dependencies

```bash
npm install
```

### 3. Start the API

```bash
cd packages/api
npm run dev
```

API runs on http://localhost:3001

### 4. (Optional) Load sample data

```bash
cd packages/api
npx ts-node src/seed.ts
```

Loads a 3-generation Oakwood family tree.

### 5. Start the frontend

```bash
cd packages/web
npm run dev
```

App runs on http://localhost:5173

## API Reference

| Method | Path | Description |
|---|---|---|
| GET | `/api/tree` | Full tree for rendering |
| GET | `/api/persons` | List all persons |
| GET | `/api/persons/:id` | Person with all relations |
| POST | `/api/persons` | Create person |
| PUT | `/api/persons/:id` | Update person |
| DELETE | `/api/persons/:id` | Delete person |
| POST | `/api/relationships/parent` | Link parent → child |
| DELETE | `/api/relationships/parent` | Remove parent-child |
| POST | `/api/relationships/spouse` | Link spouses |
| PUT | `/api/relationships/spouse` | Update marriage dates |
| DELETE | `/api/relationships/spouse` | Remove spouse link |
| POST | `/api/media/upload/:personId` | Upload photo or document |
| GET | `/api/media/:id` | Stream file |
| GET | `/api/media/:id/thumbnail` | Stream thumbnail |
| PATCH | `/api/media/:id/caption` | Update caption |
| DELETE | `/api/media/:id` | Delete file |

## Neo4j Schema

```
(:Person {id, firstName, lastName, gender, birthDate, birthPlace,
          deathDate, deathPlace, occupation, bio, profilePhotoId,
          createdAt, updatedAt})

(:Media  {id, filename, originalName, mimeType, size, type,
          caption, date, uploadedAt})

(parent:Person)-[:PARENT_OF]->(child:Person)
(p1:Person)-[:MARRIED_TO {marriageDate, divorceDate, marriagePlace, status}]-(p2:Person)
(person:Person)-[:HAS_MEDIA]->(media:Media)
```

## MCP Server

`packages/mcp` exposes the full Taproot API as MCP tools so AI assistants can browse, edit, and reason about your family tree.

### Build

```bash
npm run build:mcp          # compiles to packages/mcp/dist/index.js
```

### Tools

| Tool | Description |
|---|---|
| `list_persons` | List all persons (optional `search` filter) |
| `get_person` | Full profile + relationships + media |
| `create_person` | Add a new person |
| `update_person` | Edit any fields on a person |
| `delete_person` | Remove a person permanently |
| `get_family_tree` | Complete tree structure |
| `find_relationship_path` | BFS path between two people ("grandfather", etc.) |
| `add_parent_child` | Link parent → child |
| `remove_parent_child` | Unlink parent → child |
| `add_spouse` | Link two spouses (with optional marriage details) |
| `update_spouse` | Edit marriage/divorce dates and status |
| `remove_spouse` | Unlink spouses |
| `list_media` | List photos/documents for a person |
| `delete_media` | Remove a file |
| `update_media_caption` | Edit a file's caption |

### Resources

| URI | Description |
|---|---|
| `taproot://persons` | Flat list of all persons (JSON) |
| `taproot://tree` | Complete tree with relationship maps (JSON) |

### Claude Desktop config

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "taproot": {
      "command": "node",
      "args": ["/absolute/path/to/taproot/packages/mcp/dist/index.js"],
      "env": {
        "TAPROOT_API_URL": "http://localhost:3001/api"
      }
    }
  }
}
```

The Taproot REST API must be running before Claude Desktop starts the MCP process.

## Environment Variables

Copy `packages/api/.env.example` to `packages/api/.env`:

```
PORT=3001
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=taprootpass
UPLOADS_DIR=./uploads
MAX_FILE_SIZE_MB=50
```
