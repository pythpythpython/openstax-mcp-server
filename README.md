# OpenStax MCP Server

An AI-powered Model Context Protocol (MCP) server that connects LLMs (like Claude and Cursor) directly to the high-quality, peer-reviewed educational content from [OpenStax](https://openstax.org).

**Live Endpoint:** https://openstax-mcp-server.svillalobos-gonzalez.workers.dev

## Quick Connect

### Option A: Connect with Cursor (Recommended)

1. Open **Cursor Settings** (Cmd + ,)
2. Navigate to **Features** > **MCP Servers**
3. Click **+ Add New MCP Server**
4. Enter the following details:
   - **Name:** openstax
   - **Type:** command
   - **Command:**

    npx -y openstax-mcp-bridge https://openstax-mcp-server.svillalobos-gonzalez.workers.dev

### Option B: Connect with Claude Desktop

Add the following configuration to your Claude config file:
- **macOS:** ~/Library/Application Support/Claude/claude_desktop_config.json
- **Windows:** %APPDATA%\Claude\claude_desktop_config.json

    {
      "mcpServers": {
        "openstax": {
          "command": "npx",
          "args": [
            "-y",
            "openstax-mcp-bridge",
            "https://openstax-mcp-server.svillalobos-gonzalez.workers.dev"
          ]
        }
      }
    }

## Features

- **Textbook Access:** Instant access to 40+ OpenStax textbooks (Physics, Calculus, Biology, Economics, etc.) fetched directly from the OpenStax GitHub.
- **Semantic Search:** Find concepts not just by keywords, but by meaning (e.g., "How do markets reach equilibrium?" vs "supply and demand").
- **Jupyter Notebook Generation:** Automatically generate .ipynb Python notebooks for any module, complete with code examples, visualizations, and practice data.
- **Practice Problems:** Generate easy, medium, or hard practice problems with detailed step-by-step solutions.
- **Cloudflare Edge:** Hosted on Cloudflare Workers for low-latency access and high availability.

## How to Build the "Best Notebooks on the Web"

Once connected to Cursor or Claude, try these prompts to create interactive learning materials:

### 1. The "Feynman Technique" Generator
> "Search the **College Physics** textbook for 'Thermodynamics'. Then, generate a Jupyter Notebook for that module. Include 3 code cells that visualize the Laws of Thermodynamics using Python (matplotlib), and add markdown cells explaining the concepts as if teaching a freshman student."

### 2. The Semantic Study Guide
> "I am struggling with the concept of 'Elasticity' in Economics. Search the **Microeconomics** textbook for this concept using semantic search, and then generate 5 'Hard' difficulty practice problems based on that text to test my understanding."

### 3. Instant Course Structure
> "List all textbooks available in **Spanish**. Then, get the table of contents for 'Física Universitaria' and outline a 4-week study plan based on the first 5 chapters."

## Architecture

This project uses:
- **Cloudflare Workers:** For serverless execution.
- **Workers KV:** To cache parsed XML content and generated problems.
- **Vectorize:** For storing embeddings and enabling semantic search.
- **Cloudflare AI:** To run embedding models and LLMs for problem generation.
- **OpenStax MCP Bridge:** A custom CLI tool to bridge stdio to the remote server.

## License & Attribution

### Software License
The code for this MCP server is licensed under the **MIT License**.

### Content Attribution
This tool accesses educational content owned by **OpenStax**.
- **License:** Creative Commons Attribution 4.0 International (CC BY 4.0)
- **Source:** OpenStax GitHub Organization and OpenStax.org.

*This project is an independent tool built to facilitate access to OpenStax resources via LLMs and is not directly affiliated with Rice University.*

## Contact & Support

For questions, concerns, or collaboration:

- **Email:** svillalobos-gonzalez@my.campus.edu
- **Secondary:** prefrontalcorporate@gmail.com

If you have questions specifically regarding the textbook content, please refer to the official OpenStax FAQ.
