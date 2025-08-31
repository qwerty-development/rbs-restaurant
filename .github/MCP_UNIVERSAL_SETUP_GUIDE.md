# Universal MCP Setup Guide for Claude Code Projects

## Overview
Model Context Protocol (MCP) servers extend Claude Code's capabilities with specialized tools for web browsing, database operations, file management, and more. This guide provides a comprehensive setup for any project.

## Core MCP Servers for Development

### 🧠 Sequential Thinking (Essential)
**Use for**: Complex problem-solving, multi-step tasks, planning
```json
{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"],
  "env": {}
}
```

### 🗂️ Filesystem (Essential)
**Use for**: File operations, project exploration, file management
```json
{
  "type": "stdio", 
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/USERNAME/Desktop", "/Users/USERNAME/Documents"],
  "env": {}
}
```

### 🌐 Web Fetch (Recommended)
**Use for**: Web content fetching, API testing, image processing
```json
{
  "type": "stdio",
  "command": "npx", 
  "args": ["-y", "@kazuph/mcp-fetch"],
  "env": {}
}
```

### 🤖 Puppeteer (Recommended)
**Use for**: Browser automation, testing, screenshots, web scraping
```json
{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-puppeteer"],
  "env": {}
}
```

## Database-Specific MCP Servers

### 🗄️ Supabase (For Supabase Projects)
**Use for**: Database operations, project management, monitoring
```json
{
  "type": "stdio",
  "command": "npx", 
  "args": [
    "-y",
    "@supabase/mcp-server-supabase@latest",
    "--features=account,docs,database,debug,development,functions,branching,storage"
  ],
  "env": {
    "SUPABASE_ACCESS_TOKEN": "YOUR_SUPABASE_ACCESS_TOKEN"
  }
}
```

### 🐘 PostgreSQL (For Direct PostgreSQL)
```json
{
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-postgres"],
  "env": {
    "POSTGRES_CONNECTION_STRING": "postgresql://user:password@localhost:5432/dbname"
  }
}
```

## Setup Methods

### Method 1: User-Level (Global) Configuration
**Best for**: Personal development environment, all projects

```bash
# Add servers to user config (available in all projects)
claude mcp add-json sequential-thinking '{"type": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"], "env": {}}'

claude mcp add-json filesystem '{"type": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/USERNAME/Desktop", "/Users/USERNAME/Documents"], "env": {}}'

claude mcp add-json fetch '{"type": "stdio", "command": "npx", "args": ["-y", "@kazuph/mcp-fetch"], "env": {}}'

claude mcp add-json puppeteer '{"type": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-puppeteer"], "env": {}}'
```

### Method 2: Project-Level Configuration
**Best for**: Team projects, project-specific tools

Create `.mcp.json` in your project root:
```json
{
  "mcpServers": {
    "fetch": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@kazuph/mcp-fetch"],
      "env": {}
    },
    "puppeteer": {
      "type": "stdio", 
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"],
      "env": {}
    },
    "supabase": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y", 
        "@supabase/mcp-server-supabase@latest",
        "--features=account,docs,database,debug,development,functions,branching,storage"
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "YOUR_TOKEN_HERE"
      }
    }
  }
}
```

## Quick Setup Commands

### Essential Development Setup (5 minutes)
```bash
# Install essential MCP servers globally
claude mcp add-json sequential-thinking '{"type": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"], "env": {}}'

claude mcp add-json filesystem '{"type": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/'$(whoami)'/Desktop"], "env": {}}'

claude mcp add-json fetch '{"type": "stdio", "command": "npx", "args": ["-y", "@kazuph/mcp-fetch"], "env": {}}'

claude mcp add-json puppeteer '{"type": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-puppeteer"], "env": {}}'

# Verify installation
claude mcp list
```

### Full Stack Setup (10 minutes)
```bash
# All essential + database tools
claude mcp add-json sequential-thinking '{"type": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"], "env": {}}'

claude mcp add-json filesystem '{"type": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/'$(whoami)'/Desktop", "/Users/'$(whoami)'/Documents", "/Users/'$(whoami)'/Projects"], "env": {}}'

claude mcp add-json fetch '{"type": "stdio", "command": "npx", "args": ["-y", "@kazuph/mcp-fetch"], "env": {}}'

claude mcp add-json puppeteer '{"type": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-puppeteer"], "env": {}}'

# Add database tools as needed
claude mcp add-json postgres '{"type": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-postgres"], "env": {"POSTGRES_CONNECTION_STRING": "postgresql://localhost:5432/mydb"}}'
```

## Project-Specific Setup Templates

### Next.js + Supabase Project
```json
{
  "mcpServers": {
    "fetch": {
      "type": "stdio",
      "command": "npx", 
      "args": ["-y", "@kazuph/mcp-fetch"],
      "env": {}
    },
    "puppeteer": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"], 
      "env": {}
    },
    "supabase": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest", 
        "--features=account,docs,database,debug,development,functions,branching,storage"
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "YOUR_SUPABASE_TOKEN"
      }
    }
  }
}
```

### React + PostgreSQL Project
```json
{
  "mcpServers": {
    "fetch": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@kazuph/mcp-fetch"],
      "env": {}
    },
    "puppeteer": {
      "type": "stdio", 
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"],
      "env": {}
    },
    "postgres": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "POSTGRES_CONNECTION_STRING": "postgresql://user:password@localhost:5432/dbname"
      }
    }
  }
}
```

### Content/Documentation Project
```json
{
  "mcpServers": {
    "fetch": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@kazuph/mcp-fetch"],
      "env": {}
    },
    "puppeteer": {
      "type": "stdio",
      "command": "npx", 
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"],
      "env": {}
    }
  }
}
```

## Troubleshooting

### Common Issues & Solutions

#### Server Connection Failed
```bash
# Check server status
claude mcp list

# Remove problematic server
claude mcp remove SERVER_NAME  

# Re-add with correct configuration
claude mcp add-json SERVER_NAME '{"type": "stdio", "command": "npx", "args": ["-y", "CORRECT_PACKAGE_NAME"], "env": {}}'
```

#### Package Name Issues
Common incorrect vs correct package names:
- ❌ `u/modelcontextprotocol/server-sequential-thinking`  
- ✅ `@modelcontextprotocol/server-sequential-thinking`

- ❌ `@modelcontextprotocol/server-fetch`
- ✅ `@kazuph/mcp-fetch`

#### Environment Variables Not Loading
Ensure environment variables are properly quoted and valid:
```json
{
  "env": {
    "DATABASE_URL": "postgresql://localhost:5432/mydb",
    "API_KEY": "your-api-key-here"
  }
}
```

#### Directory Path Issues (Filesystem)
Use absolute paths and ensure directories exist:
```bash
# Bad - relative path
"/Users/USERNAME/Desktop"  

# Good - absolute path that exists  
"/Users/$(whoami)/Desktop"
```

### Debug Mode
```bash
# Run with debug information
claude --debug mcp list

# Check specific server logs
claude --mcp-debug
```

## Verification & Testing

### Test Each Server
```bash
# 1. Check all servers are connected
claude mcp list

# 2. Test in Claude Code session:
# - Sequential thinking: Ask Claude to "think through this step by step"
# - Filesystem: Use @-mentions for files  
# - Fetch: Ask Claude to fetch a URL
# - Puppeteer: Ask Claude to take a screenshot
# - Supabase: Ask Claude to check database schema
```

### Expected Output
All servers should show `✓ Connected`:
```
sequential-thinking: npx -y @modelcontextprotocol/server-sequential-thinking - ✓ Connected
filesystem: npx -y @modelcontextprotocol/server-filesystem /Users/username/Desktop - ✓ Connected  
fetch: npx -y @kazuph/mcp-fetch - ✓ Connected
puppeteer: npx -y @modelcontextprotocol/server-puppeteer - ✓ Connected
```

## Best Practices

### 1. **Start Small**
Begin with essential servers (sequential-thinking, filesystem, fetch) and add project-specific ones as needed.

### 2. **Use Project Configs for Teams** 
Store project-specific MCPs in `.mcp.json` for team consistency.

### 3. **Environment Variables**
Never commit sensitive tokens. Use environment variables or local configs.

### 4. **Regular Updates**
MCP servers are actively developed. Update regularly:
```bash
# The -y flag ensures latest versions are fetched
# No additional update commands needed
```

### 5. **Debug Connection Issues**
Always run `claude mcp list` after configuration changes to verify connections.

## Integration with Development Workflow

### For Restaurant Management Systems (Example)
```json
{
  "mcpServers": {
    "fetch": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@kazuph/mcp-fetch"], 
      "env": {}
    },
    "puppeteer": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"],
      "env": {}
    },
    "supabase": {
      "type": "stdio", 
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--features=account,docs,database,debug,development,functions,branching,storage"
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "YOUR_TOKEN"
      }
    }
  }
}
```

This enables:
- **Fetch**: Menu image processing, external API integration
- **Puppeteer**: Automated testing of booking flows, PWA testing
- **Supabase**: Real-time database operations, schema management

## Summary

With this setup, Claude Code becomes a powerful development environment with:

- 🧠 **Advanced reasoning** via Sequential Thinking
- 🗂️ **File system access** via Filesystem server  
- 🌐 **Web capabilities** via Fetch server
- 🤖 **Browser automation** via Puppeteer
- 🗄️ **Database operations** via database-specific servers

Copy the appropriate configuration for your project type, run the setup commands, and verify with `claude mcp list`. Your enhanced development environment will be ready in minutes!

---

**Pro Tip**: Start with the "Essential Development Setup" commands above, then add project-specific servers as needed. Always verify connections with `claude mcp list` after changes.