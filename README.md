# Box Graph

I made this because Obsidian's graph got slow and messy once my vault grew past a thousand notes. So instead of one big cloud of dots, Box Graph shows your vault the way your folders already are.

Every folder is a square, and every note is a dot inside it. You click into a square and only that square gets the full detail: names, link lines, previews. Everything else stays as simple dots, which is why it stays fast even with thousands of notes.

It works straight on your real notes. Nothing gets copied, moved or changed. The only file it writes is a small `data.json` in its own plugin folder, to remember where you were.

## How to use it

- **Click a square** to go inside. The buttons at the top take you back out.
- **Hover a dot** to see the note's name, folder, how many links go in and out, and the first lines of the note.
- **Click a dot** in the square you're in to open that note.
- **Shift + click a dot inside a closed square** to open that note right away, without going in and finding it again. (Ctrl/Cmd + click does the same.)
- **Drag** to move around and **scroll** to zoom.
- **Double-click empty space** to zoom back out to the whole square.
- **Search** from any level. It looks at note names and folder names. Squares with matches show "N found", Enter jumps to the first one, Esc clears it.

Bigger dots are notes that a lot of other notes link to.

Box Graph remembers the last square you were in, and how far you zoomed and moved in each square. Close it, restart Obsidian, and it's where you left it.

## Big folders

If a folder has more than 1000 notes of its own, it gets split into boxes of 1000. If that makes more than 5 boxes, every 5 go into a bigger box, and so on. This is only how it's shown. Your folders stay exactly as they are.

## Install

In Obsidian, go to **Settings → Community plugins → Browse** and search for "Box Graph".

Or by hand:
1. Download `main.js` and `manifest.json` from the latest [release](../../releases/latest).
2. Put them in `<your vault>/.obsidian/plugins/box-graph/`.
3. Turn on **Box Graph** under **Settings → Community plugins**.

Open it with the box icon in the left sidebar, or the command **Box Graph: Open**.

## Good to know

- Search only looks at names and folders, not the text inside notes. That keeps it fast while you type.
- Link lines are only drawn between notes in the square you're in.
- A note's text is only read when you rest the mouse on it.
- On phones, tapping works, but pinch-to-zoom doesn't yet.

## License

MIT
