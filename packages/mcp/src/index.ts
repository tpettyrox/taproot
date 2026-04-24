#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

import axios, { AxiosError } from 'axios';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

const API_BASE = process.env.TAPROOT_API_URL ?? 'http://localhost:3001/api';

const http = axios.create({ baseURL: API_BASE, timeout: 15_000 });

// ── Helpers ───────────────────────────────────────────────────────────────────

function apiError(err: unknown): never {
  if (err instanceof AxiosError) {
    const msg = err.response?.data?.error ?? err.message;
    throw new McpError(ErrorCode.InternalError, `API error: ${msg}`);
  }
  throw new McpError(ErrorCode.InternalError, String(err));
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: text(data) }] };
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  // ── Persons ──
  {
    name: 'list_persons',
    description: 'List every person in the family tree. Returns id, name, gender, birth/death dates, and occupation for each person.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        search: {
          type: 'string',
          description: 'Optional name filter (case-insensitive substring match).',
        },
      },
    },
  },
  {
    name: 'get_person',
    description:
      'Get a person\'s complete profile: biographical details, parents, children, spouses (with marriage dates), and attached media.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Person UUID.' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_person',
    description: 'Add a new person to the family tree.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        firstName:  { type: 'string', description: 'Given name.' },
        lastName:   { type: 'string', description: 'Family name.' },
        gender:     { type: 'string', enum: ['male', 'female', 'other', 'unknown'] },
        birthDate:  { type: 'string', description: 'ISO date, e.g. 1945-06-10.' },
        birthPlace: { type: 'string', description: 'City, Country.' },
        deathDate:  { type: 'string', description: 'ISO date.' },
        deathPlace: { type: 'string' },
        occupation: { type: 'string' },
        bio:        { type: 'string', description: 'Free-text biography.' },
      },
      required: ['firstName', 'lastName'],
    },
  },
  {
    name: 'update_person',
    description: 'Update any fields on an existing person record.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id:          { type: 'string', description: 'Person UUID to update.' },
        firstName:   { type: 'string' },
        lastName:    { type: 'string' },
        gender:      { type: 'string', enum: ['male', 'female', 'other', 'unknown'] },
        birthDate:   { type: 'string' },
        birthPlace:  { type: 'string' },
        deathDate:   { type: 'string' },
        deathPlace:  { type: 'string' },
        occupation:  { type: 'string' },
        bio:         { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_person',
    description:
      'Permanently delete a person, all their relationships, and attached media. This cannot be undone.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Person UUID to delete.' },
      },
      required: ['id'],
    },
  },

  // ── Family tree ──
  {
    name: 'get_family_tree',
    description:
      'Return the complete family tree: every person with their parent IDs, child IDs, and spouse links. Useful for understanding overall structure before navigating to individuals.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'find_relationship_path',
    description:
      'Describe the relationship chain between two people by traversing the tree (e.g. "grandfather", "second cousin"). Loads the full tree and computes the path client-side.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        fromId: { type: 'string', description: 'Starting person UUID.' },
        toId:   { type: 'string', description: 'Target person UUID.' },
      },
      required: ['fromId', 'toId'],
    },
  },

  // ── Parent-child relationships ──
  {
    name: 'add_parent_child',
    description: 'Record that one person is a parent of another.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        parentId: { type: 'string', description: 'UUID of the parent.' },
        childId:  { type: 'string', description: 'UUID of the child.' },
      },
      required: ['parentId', 'childId'],
    },
  },
  {
    name: 'remove_parent_child',
    description: 'Remove a parent-child link (does not delete either person).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        parentId: { type: 'string' },
        childId:  { type: 'string' },
      },
      required: ['parentId', 'childId'],
    },
  },

  // ── Spouse relationships ──
  {
    name: 'add_spouse',
    description: 'Link two people as spouses, optionally recording marriage details.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        person1Id:     { type: 'string', description: 'First person UUID.' },
        person2Id:     { type: 'string', description: 'Second person UUID.' },
        marriageDate:  { type: 'string', description: 'ISO date of marriage.' },
        marriagePlace: { type: 'string', description: 'Location of ceremony.' },
        divorceDate:   { type: 'string', description: 'ISO date of divorce, if applicable.' },
        status:        { type: 'string', enum: ['married', 'divorced', 'widowed', 'separated'] },
      },
      required: ['person1Id', 'person2Id'],
    },
  },
  {
    name: 'update_spouse',
    description: 'Update the marriage details between two already-linked spouses.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        person1Id:     { type: 'string' },
        person2Id:     { type: 'string' },
        marriageDate:  { type: 'string' },
        marriagePlace: { type: 'string' },
        divorceDate:   { type: 'string' },
        status:        { type: 'string', enum: ['married', 'divorced', 'widowed', 'separated'] },
      },
      required: ['person1Id', 'person2Id'],
    },
  },
  {
    name: 'remove_spouse',
    description: 'Remove the spousal link between two people (does not delete either person).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        person1Id: { type: 'string' },
        person2Id: { type: 'string' },
      },
      required: ['person1Id', 'person2Id'],
    },
  },

  // ── Media ──
  {
    name: 'list_media',
    description: 'List all photos and documents attached to a person.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        personId: { type: 'string', description: 'Person UUID.' },
      },
      required: ['personId'],
    },
  },
  {
    name: 'delete_media',
    description: 'Delete a specific photo or document from a person\'s record.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        mediaId: { type: 'string', description: 'Media UUID to delete.' },
      },
      required: ['mediaId'],
    },
  },
  {
    name: 'update_media_caption',
    description: 'Set or update the caption on a photo or document.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        mediaId: { type: 'string' },
        caption: { type: 'string' },
      },
      required: ['mediaId', 'caption'],
    },
  },
] as const;

// ── Relationship path finder ──────────────────────────────────────────────────

interface FlatPerson {
  id: string;
  firstName: string;
  lastName: string;
  parentIds: string[];
  childIds: string[];
  spouses: { id: string }[];
}

function findPath(persons: FlatPerson[], fromId: string, toId: string): string {
  if (fromId === toId) return 'Same person.';
  const byId = new Map(persons.map((p) => [p.id, p]));
  if (!byId.has(fromId)) return `Person ${fromId} not found in tree.`;
  if (!byId.has(toId)) return `Person ${toId} not found in tree.`;

  // BFS over undirected relationship graph (parents, children, spouses)
  type Node = { id: string; path: Array<{ id: string; rel: string }> };
  const visited = new Set<string>([fromId]);
  const queue: Node[] = [{ id: fromId, path: [] }];

  while (queue.length > 0) {
    const { id, path } = queue.shift()!;
    const p = byId.get(id)!;

    const neighbours: Array<{ id: string; rel: string }> = [
      ...p.parentIds.map((pid) => ({ id: pid, rel: 'parent' })),
      ...p.childIds.map((cid) => ({ id: cid, rel: 'child' })),
      ...p.spouses.map((s) => ({ id: s.id, rel: 'spouse' })),
    ];

    for (const { id: nid, rel } of neighbours) {
      if (visited.has(nid)) continue;
      visited.add(nid);
      const newPath = [...path, { id: nid, rel }];
      if (nid === toId) {
        const from = byId.get(fromId)!;
        const to = byId.get(toId)!;
        const steps = newPath
          .map(({ id: sid, rel: r }) => {
            const sp = byId.get(sid)!;
            return `→ [${r}] ${sp.firstName} ${sp.lastName}`;
          })
          .join('\n');
        return (
          `Path from ${from.firstName} ${from.lastName} to ${to.firstName} ${to.lastName}:\n` +
          `${from.firstName} ${from.lastName}\n${steps}\n\nDistance: ${newPath.length} step(s)`
        );
      }
      queue.push({ id: nid, path: newPath });
    }
  }
  return 'No relationship path found between these two people in the current tree.';
}

// ── Server setup ──────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'taproot', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {} } }
);

// ── List tools ────────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

// ── Resources (read-only views) ───────────────────────────────────────────────

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'taproot://tree',
      name: 'Family Tree',
      description: 'Complete family tree — all persons with their relationships.',
      mimeType: 'application/json',
    },
    {
      uri: 'taproot://persons',
      name: 'Person List',
      description: 'Flat list of all persons with basic biographical data.',
      mimeType: 'application/json',
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
  const { uri } = req.params;
  try {
    if (uri === 'taproot://tree') {
      const { data } = await http.get('/tree');
      return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(data, null, 2) }] };
    }
    if (uri === 'taproot://persons') {
      const { data } = await http.get('/persons');
      return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(data, null, 2) }] };
    }
    throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
  } catch (err) {
    if (err instanceof McpError) throw err;
    apiError(err);
  }
});

// ── Call tool ─────────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;

  try {
    switch (name) {

      // ── Persons ──────────────────────────────────────────────────────────
      case 'list_persons': {
        const { data } = await http.get('/persons');
        const persons = Array.isArray(data) ? data : [];
        const search = (args.search as string | undefined)?.toLowerCase();
        const filtered = search
          ? persons.filter((p: { firstName: string; lastName: string }) =>
              `${p.firstName} ${p.lastName}`.toLowerCase().includes(search)
            )
          : persons;
        return ok(filtered);
      }

      case 'get_person': {
        const { id } = args as { id: string };
        const { data } = await http.get(`/persons/${id}`);
        return ok(data);
      }

      case 'create_person': {
        const { data } = await http.post('/persons', args);
        return ok(data);
      }

      case 'update_person': {
        const { id, ...rest } = args as { id: string } & Record<string, unknown>;
        const { data } = await http.put(`/persons/${id}`, rest);
        return ok(data);
      }

      case 'delete_person': {
        const { id } = args as { id: string };
        await http.delete(`/persons/${id}`);
        return ok(`Person ${id} deleted.`);
      }

      // ── Tree ─────────────────────────────────────────────────────────────
      case 'get_family_tree': {
        const { data } = await http.get('/tree');
        return ok(data);
      }

      case 'find_relationship_path': {
        const { fromId, toId } = args as { fromId: string; toId: string };
        const { data } = await http.get('/tree');
        const result = findPath(data.persons, fromId, toId);
        return ok(result);
      }

      // ── Parent-child ──────────────────────────────────────────────────────
      case 'add_parent_child': {
        const { parentId, childId } = args as { parentId: string; childId: string };
        await http.post('/relationships/parent', { parentId, childId });
        return ok(`Parent-child link created: ${parentId} → ${childId}`);
      }

      case 'remove_parent_child': {
        const { parentId, childId } = args as { parentId: string; childId: string };
        await http.delete('/relationships/parent', { data: { parentId, childId } });
        return ok(`Parent-child link removed: ${parentId} → ${childId}`);
      }

      // ── Spouses ───────────────────────────────────────────────────────────
      case 'add_spouse': {
        const { data } = await http.post('/relationships/spouse', args);
        return ok(data);
      }

      case 'update_spouse': {
        const { data } = await http.put('/relationships/spouse', args);
        return ok(data);
      }

      case 'remove_spouse': {
        const { person1Id, person2Id } = args as { person1Id: string; person2Id: string };
        await http.delete('/relationships/spouse', { data: { person1Id, person2Id } });
        return ok(`Spouse link removed between ${person1Id} and ${person2Id}`);
      }

      // ── Media ─────────────────────────────────────────────────────────────
      case 'list_media': {
        const { personId } = args as { personId: string };
        const { data } = await http.get(`/persons/${personId}`);
        return ok(data.media ?? []);
      }

      case 'delete_media': {
        const { mediaId } = args as { mediaId: string };
        await http.delete(`/media/${mediaId}`);
        return ok(`Media ${mediaId} deleted.`);
      }

      case 'update_media_caption': {
        const { mediaId, caption } = args as { mediaId: string; caption: string };
        await http.patch(`/media/${mediaId}/caption`, { caption });
        return ok(`Caption updated on media ${mediaId}`);
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (err) {
    if (err instanceof McpError) throw err;
    apiError(err);
  }
});

// ── Connect ───────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
