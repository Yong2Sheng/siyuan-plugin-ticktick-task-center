# TickTick Task Center for SiYuan

TickTick Task Center is a SiYuan plugin for associating ordinary document blocks with TickTick tasks. Task data is stored in structured block attributes, while each source block keeps readable fallback Markdown:

```markdown
TickTick task: [Task name](https://ticktick.com/...)
```

The planned MVP will provide task-card enhancement, seven local task statuses, and a dynamic task-center tab. The original document block remains the only source of truth; the task center will not maintain a second task database.

## Current status

The repository is in its project-initialization stage. Task insertion, card rendering, editing, and the task center are not implemented yet.

## MVP boundaries

- Accept HTTPS task links from `dida365.com` and `ticktick.com`.
- Use official SiYuan APIs for block data.
- Do not integrate TickTick API, OAuth, or two-way synchronization.
- Do not use tags or full-text search as the primary status index.
- Build only a SiYuan frontend plugin; no kernel plugin is included.

Development and testing currently focus on SiYuan Desktop for macOS. Compatibility support for other platforms is not yet guaranteed.

## Development

Requirements: Node.js 20 and pnpm.

```bash
pnpm install
pnpm typecheck
pnpm build
```

The production build creates `dist/` and `package.zip`.

## Assets

`icon.png` and `preview.png` are retained temporarily to keep marketplace packaging complete. They must be replaced with project-specific artwork before release.

## License

[MIT](./LICENSE)
