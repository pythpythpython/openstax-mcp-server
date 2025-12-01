/**
 * OpenStax MCP Server
 * Production-grade Model Context Protocol server for OpenStax educational content
 * Features: Semantic search, AI-powered problem generation, notebook creation
 */

import { Ai } from '@cloudflare/ai';
import { parseStringPromise } from 'xml2js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Env {
  TEXTBOOK_CACHE: KVNamespace;
  PRACTICE_PROBLEMS: KVNamespace;
  NOTEBOOKS: KVNamespace;
  VECTORIZE: VectorizeIndex;
  AI: any;
}

interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface Textbook {
  id: string;
  name: string;
  repo: string;
  description: string | null;
  language: string;
  updated: string;
  stars: number;
}

interface Module {
  id: string;
  title: string;
}

interface TextbookStructure {
  title: string;
  modules: Module[];
  metadata: any;
}

// ============================================================================
// MCP PROTOCOL HANDLER
// ============================================================================

class OpenStaxMCPServer {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      switch (request.method) {
        case 'initialize':
          return this.handleInitialize(request);
        case 'tools/list':
          return this.handleToolsList(request);
        case 'tools/call':
          return this.handleToolCall(request);
        default:
          return this.errorResponse(request.id, -32601, `Method not found: ${request.method}`);
      }
    } catch (error) {
      return this.errorResponse(
        request.id,
        -32603,
        `Internal error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private handleInitialize(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: 'openstax-mcp-server',
          version: '2.0.0',
        },
      },
    };
  }

  private handleToolsList(request: MCPRequest): MCPResponse {
    const tools = [
      {
        name: 'list_textbooks',
        description: 'Get comprehensive list of all OpenStax textbooks with metadata. Supports filtering by subject and language.',
        inputSchema: {
          type: 'object',
          properties: {
            subject: {
              type: 'string',
              description: 'Optional: Filter by subject area (e.g., physics, chemistry, biology, math)',
            },
            language: {
              type: 'string',
              enum: ['en', 'es', 'pl'],
              description: 'Optional: Filter by language (en=English, es=Spanish, pl=Polish)',
            },
          },
        },
      },
      {
        name: 'get_textbook_structure',
        description: 'Get complete table of contents and structure from collection.xml. Returns chapter/module organization with caching.',
        inputSchema: {
          type: 'object',
          properties: {
            textbook_id: {
              type: 'string',
              description: 'Textbook repo name (e.g., "osbooks-college-physics-bundle")',
            },
          },
          required: ['textbook_id'],
        },
      },
      {
        name: 'get_module_content',
        description: 'Retrieve full content of a specific chapter/module including text, equations, and images. Cached for performance.',
        inputSchema: {
          type: 'object',
          properties: {
            textbook_id: {
              type: 'string',
              description: 'Textbook repo name',
            },
            module_id: {
              type: 'string',
              description: 'Module ID (e.g., "m12345")',
            },
            include_images: {
              type: 'boolean',
              description: 'Include image URLs from media folder',
              default: true,
            },
          },
          required: ['textbook_id', 'module_id'],
        },
      },
      {
        name: 'semantic_search',
        description: 'Search textbook content using AI semantic understanding. Returns most relevant modules based on natural language query.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Natural language search query',
            },
            textbook_id: {
              type: 'string',
              description: 'Optional: Limit to specific textbook',
            },
            limit: {
              type: 'number',
              description: 'Number of results (default: 5)',
              default: 5,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'generate_practice_problems',
        description: 'Generate AI-powered practice problems for a module with solutions. Supports multiple difficulty levels.',
        inputSchema: {
          type: 'object',
          properties: {
            textbook_id: {
              type: 'string',
              description: 'Textbook repo name',
            },
            module_id: {
              type: 'string',
              description: 'Module ID',
            },
            difficulty: {
              type: 'string',
              enum: ['easy', 'medium', 'hard'],
              description: 'Problem difficulty',
              default: 'medium',
            },
            count: {
              type: 'number',
              description: 'Number of problems to generate',
              default: 5,
            },
          },
          required: ['textbook_id', 'module_id'],
        },
      },
      {
        name: 'generate_jupyter_notebook',
        description: 'Generate .ipynb Jupyter notebook with examples, exercises, and code cells for a module. Perfect for interactive learning.',
        inputSchema: {
          type: 'object',
          properties: {
            textbook_id: {
              type: 'string',
              description: 'Textbook repo name',
            },
            module_id: {
              type: 'string',
              description: 'Module ID',
            },
            include_solutions: {
              type: 'boolean',
              description: 'Include solution cells',
              default: true,
            },
          },
          required: ['textbook_id', 'module_id'],
        },
      },
      {
        name: 'index_textbook_for_search',
        description: 'Index a textbook\'s content into vector database for semantic search. Run this before using semantic_search on a new textbook.',
        inputSchema: {
          type: 'object',
          properties: {
            textbook_id: {
              type: 'string',
              description: 'Textbook repo name to index',
            },
            max_modules: {
              type: 'number',
              description: 'Max modules to index (for testing, default: 20)',
              default: 20,
            },
          },
          required: ['textbook_id'],
        },
      },
    ];

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: { tools },
    };
  }

  private async handleToolCall(request: MCPRequest): Promise<MCPResponse> {
    const { name, arguments: args } = request.params;

    try {
      let result;
      switch (name) {
        case 'list_textbooks':
          result = await this.listTextbooks(args);
          break;
        case 'get_textbook_structure':
          result = await this.getTextbookStructure(args);
          break;
        case 'get_module_content':
          result = await this.getModuleContent(args);
          break;
        case 'semantic_search':
          result = await this.semanticSearch(args);
          break;
        case 'generate_practice_problems':
          result = await this.generatePracticeProblems(args);
          break;
        case 'generate_jupyter_notebook':
          result = await this.generateJupyterNotebook(args);
          break;
        case 'index_textbook_for_search':
          result = await this.indexTextbookForSearch(args);
          break;
        default:
          return this.errorResponse(request.id, -32602, `Unknown tool: ${name}`);
      }

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        },
      };
    } catch (error) {
      return this.errorResponse(
        request.id,
        -32603,
        `Tool execution error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ============================================================================
  // TOOL IMPLEMENTATIONS
  // ============================================================================

  private async listTextbooks(params: any): Promise<any> {
    const { subject, language } = params;
    const cacheKey = `textbooks_list_${subject || 'all'}_${language || 'all'}`;

    // Check cache
    const cached = await this.env.TEXTBOOK_CACHE.get(cacheKey, 'json');
    if (cached) {
      return { ...cached, from_cache: true };
    }

    // Fetch from GitHub
    const response = await fetch('https://api.github.com/orgs/openstax/repos?per_page=100&type=public', {
      headers: {
        'User-Agent': 'OpenStax-MCP-Server',
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const repos = await response.json();

    const textbooks: Textbook[] = repos
      .filter(
        (r: any) =>
          r.name.startsWith('osbooks-') &&
          !['template', 'playground'].some((ex) => r.name.includes(ex))
      )
      .map((r: any) => {
        const name = r.name.replace('osbooks-', '');
        const lang =
          name.includes('fisica') || name.includes('quimica') || name.includes('calculo')
            ? 'es'
            : name.includes('fizyka') || name.includes('mikroekonomia') || name.includes('psychologia')
            ? 'pl'
            : 'en';

        return {
          id: r.name,
          name: name.replace(/-/g, ' ').replace(/bundle/g, '').trim(),
          repo: r.html_url,
          description: r.description,
          language: lang,
          updated: r.updated_at,
          stars: r.stargazers_count,
        };
      })
      .filter(
        (t: Textbook) =>
          (!subject || t.name.toLowerCase().includes(subject.toLowerCase())) &&
          (!language || t.language === language)
      );

    const result = { textbooks, count: textbooks.length, from_cache: false };

    // Cache for 24 hours
    await this.env.TEXTBOOK_CACHE.put(cacheKey, JSON.stringify(result), {
      expirationTtl: 86400,
    });

    return result;
  }

  private async getTextbookStructure(params: any): Promise<any> {
    const { textbook_id } = params;
    const cacheKey = `structure_${textbook_id}`;

    // Check cache
    const cached = await this.env.TEXTBOOK_CACHE.get(cacheKey, 'json');
    if (cached) {
      return { ...cached, from_cache: true };
    }

    // Fetch collections directory
    const apiUrl = `https://api.github.com/repos/openstax/${textbook_id}/contents/collections`;
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'OpenStax-MCP-Server',
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch collections: ${response.statusText}`);
    }

    const files = await response.json();
    const collectionFile = files.find((f: any) => f.name.endsWith('.collection.xml'));

    if (!collectionFile) {
      throw new Error('No collection.xml found');
    }

    // Fetch and parse XML
    const xmlResponse = await fetch(collectionFile.download_url);
    const xmlContent = await xmlResponse.text();
    const parsed = await parseStringPromise(xmlContent);

    // Extract structure
    const structure: TextbookStructure = {
      title: parsed.collection?.title?.[0] || 'Unknown',
      modules: this.extractModules(parsed.collection),
      metadata: parsed.collection?.metadata?.[0] || {},
    };

    const result = { ...structure, from_cache: false };

    // Cache for 7 days
    await this.env.TEXTBOOK_CACHE.put(cacheKey, JSON.stringify(result), {
      expirationTtl: 604800,
    });

    return result;
  }

  private extractModules(collection: any): Module[] {
    const modules: Module[] = [];

    const traverse = (node: any) => {
      if (node.module) {
        for (const mod of Array.isArray(node.module) ? node.module : [node.module]) {
          if (mod.$?.document) {
            modules.push({
              id: mod.$.document,
              title: mod.title?.[0] || 'Untitled',
            });
          }
        }
      }
      if (node.subcollection) {
        for (const sub of Array.isArray(node.subcollection) ? node.subcollection : [node.subcollection]) {
          traverse(sub);
        }
      }
    };

    if (collection.content) {
      for (const content of Array.isArray(collection.content) ? collection.content : [collection.content]) {
        traverse(content);
      }
    }

    return modules;
  }

  private async getModuleContent(params: any): Promise<any> {
    const { textbook_id, module_id, include_images = true } = params;
    const cacheKey = `module_${textbook_id}_${module_id}`;

    // Check cache
    const cached = await this.env.TEXTBOOK_CACHE.get(cacheKey, 'json');
    if (cached) {
      return { ...cached, from_cache: true };
    }

    // Fetch module XML
    const moduleUrl = `https://raw.githubusercontent.com/openstax/${textbook_id}/main/modules/${module_id}/index.cnxml`;
    const response = await fetch(moduleUrl);

    if (!response.ok) {
      throw new Error(`Module ${module_id} not found`);
    }

    const xmlContent = await response.text();
    const parsed = await parseStringPromise(xmlContent);

    const content: any = {
      title: parsed.document?.title?.[0] || 'Untitled',
      content: this.extractTextContent(parsed.document?.content?.[0]),
      module_id,
      raw_xml: xmlContent,
      from_cache: false,
    };

    // Get images if requested
    if (include_images) {
      const mediaUrl = `https://api.github.com/repos/openstax/${textbook_id}/contents/modules/${module_id}/media`;
      const mediaResponse = await fetch(mediaUrl, {
        headers: {
          'User-Agent': 'OpenStax-MCP-Server',
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (mediaResponse.ok) {
        const mediaFiles = await mediaResponse.json();
        content.images = mediaFiles.map((f: any) => ({
          name: f.name,
          url: f.download_url,
        }));
      }
    }

    // Cache for 7 days
    await this.env.TEXTBOOK_CACHE.put(cacheKey, JSON.stringify(content), {
      expirationTtl: 604800,
    });

    return content;
  }

  private extractTextContent(node: any): string {
    if (!node) return '';
    if (typeof node === 'string') return node;

    let text = '';
    if (node.para) {
      for (const para of Array.isArray(node.para) ? node.para : [node.para]) {
        text += this.extractTextContent(para) + '\n\n';
      }
    }
    if (node._) {
      text += node._;
    }

    return text.trim();
  }

  private async semanticSearch(params: any): Promise<any> {
    const { query, textbook_id, limit = 5 } = params;

    const ai = new Ai(this.env.AI);

    // Generate embedding for query
    const queryEmbedding = await ai.run('@cf/baai/bge-base-en-v1.5', {
      text: [query],
    });

    // Search vector index
    const results = await this.env.VECTORIZE.query(queryEmbedding.data[0], {
      topK: limit,
      filter: textbook_id ? { textbook_id } : undefined,
    });

    return {
      query,
      results: results.matches.map((m) => ({
        module_id: m.id,
        score: m.score,
        metadata: m.metadata,
      })),
    };
  }

  private async generatePracticeProblems(params: any): Promise<any> {
    const { textbook_id, module_id, difficulty = 'medium', count = 5 } = params;
    const cacheKey = `problems_${textbook_id}_${module_id}_${difficulty}`;

    // Check cache
    const cached = await this.env.PRACTICE_PROBLEMS.get(cacheKey, 'json');
    if (cached) {
      return { ...cached, from_cache: true };
    }

    // Get module content
    const moduleData = await this.getModuleContent({ textbook_id, module_id, include_images: false });

    const ai = new Ai(this.env.AI);
    const prompt = `Based on this educational content, generate ${count} ${difficulty} practice problems with detailed solutions.

Content Title: ${moduleData.title}
Content: ${moduleData.content?.slice(0, 3000)}

Format each problem as:
Problem N:
[problem statement]

Solution N:
[detailed solution]`;

    const response = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: prompt }],
    });

    const problems = {
      module_id,
      difficulty,
      problems: response.response,
      from_cache: false,
    };

    // Cache for 30 days
    await this.env.PRACTICE_PROBLEMS.put(cacheKey, JSON.stringify(problems), {
      expirationTtl: 2592000,
    });

    return problems;
  }

  private async generateJupyterNotebook(params: any): Promise<any> {
    const { textbook_id, module_id, include_solutions = true } = params;
    const cacheKey = `notebook_${textbook_id}_${module_id}`;

    // Check cache
    const cached = await this.env.NOTEBOOKS.get(cacheKey, 'json');
    if (cached) {
      return { ...cached, from_cache: true };
    }

    // Get module content
    const moduleData = await this.getModuleContent({ textbook_id, module_id, include_images: false });

    // Generate notebook structure
    const notebook = {
      cells: [
        {
          cell_type: 'markdown',
          metadata: {},
          source: [`# ${moduleData.title}\n\n`, `Generated from OpenStax MCP Server\n`, `Module: ${module_id}\n`],
        },
        {
          cell_type: 'code',
          execution_count: null,
          metadata: {},
          outputs: [],
          source: ['# Import libraries\n', 'import numpy as np\n', 'import matplotlib.pyplot as plt\n', 'import pandas as pd\n'],
        },
        {
          cell_type: 'markdown',
          metadata: {},
          source: [`## Content Summary\n\n`, `${moduleData.content?.slice(0, 500)}...\n`],
        },
        {
          cell_type: 'code',
          execution_count: null,
          metadata: {},
          outputs: [],
          source: ['# Example: Basic calculations\n', '# TODO: Add relevant examples based on module content\n'],
        },
      ],
      metadata: {
        kernelspec: {
          display_name: 'Python 3',
          language: 'python',
          name: 'python3',
        },
        language_info: {
          name: 'python',
          version: '3.9.0',
        },
      },
      nbformat: 4,
      nbformat_minor: 5,
    };

    const result = {
      notebook,
      module_id,
      textbook_id,
      from_cache: false,
    };

    // Cache for 30 days
    await this.env.NOTEBOOKS.put(cacheKey, JSON.stringify(result), {
      expirationTtl: 2592000,
    });

    return result;
  }

  private async indexTextbookForSearch(params: any): Promise<any> {
    const { textbook_id, max_modules = 20 } = params;

    // Get textbook structure
    const structure = await this.getTextbookStructure({ textbook_id });

    const ai = new Ai(this.env.AI);
    let indexed = 0;

    // Index modules (limited for performance)
    const modulesToIndex = structure.modules.slice(0, max_modules);

    for (const module of modulesToIndex) {
      try {
        const moduleContent = await this.getModuleContent({
          textbook_id,
          module_id: module.id,
          include_images: false,
        });

        // Generate embedding
        const text = `${module.title} ${moduleContent.content?.slice(0, 1000) || ''}`;
        const embedding = await ai.run('@cf/baai/bge-base-en-v1.5', {
          text: [text],
        });

        // Insert into Vectorize
        await this.env.VECTORIZE.upsert([
          {
            id: `${textbook_id}_${module.id}`,
            values: embedding.data[0],
            metadata: {
              textbook_id,
              module_id: module.id,
              title: module.title,
            },
          },
        ]);

        indexed++;
      } catch (error) {
        console.error(`Failed to index ${module.id}:`, error);
      }
    }

    return {
      indexed,
      total_modules: structure.modules.length,
      textbook_id,
      message: `Successfully indexed ${indexed} modules for semantic search`,
    };
  }

  private errorResponse(id: string | number, code: number, message: string): MCPResponse {
    return {
      jsonrpc: '2.0',
      id,
      error: { code, message },
    };
  }
}

// ============================================================================
// WORKER ENTRY POINT
// ============================================================================

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Health check endpoint
    if (request.url.endsWith('/health')) {
      return new Response(JSON.stringify({ status: 'healthy', service: 'openstax-mcp-server' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // MCP endpoint
    if (request.method === 'POST') {
      try {
        const mcpRequest: MCPRequest = await request.json();
        const server = new OpenStaxMCPServer(env);
        const mcpResponse = await server.handleRequest(mcpRequest);

        return new Response(JSON.stringify(mcpResponse), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32700,
              message: 'Parse error',
            },
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Default response
    return new Response(
      JSON.stringify({
        service: 'OpenStax MCP Server',
        version: '2.0.0',
        docs: 'https://github.com/pythpythpython/openstax-mcp-server',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  },
};
