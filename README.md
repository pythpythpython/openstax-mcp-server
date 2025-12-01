# OpenStax MCP Server

An experimental Model Context Protocol (MCP) server that exposes OpenStax textbooks
to tools like Cursor, Claude Code, and other LLM IDE integrations.

- Code license: MIT (this repository)
- Textbook content: OpenStax materials are licensed under Creative Commons Attribution 4.0 (CC BY 4.0). 
  This server only accesses that content; it does not change their license.

## Features (planned)

- List OpenStax textbooks from the openstax GitHub org.
- Read collection XML to get table of contents.
- Fetch module/chapter content and media.
- Cache parsed XML in Cloudflare Workers KV.
- Semantic search with Vectorize.
- Generate practice problems and .ipynb notebooks.

