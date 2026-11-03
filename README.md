# Box Graph

A graph view for Obsidian that stays fast on big vaults.

Every folder is a square. Every note is a dot inside it. You only see links, names and previews for the square you are in, so even thousands of notes don't lag.

## What it does
- **Folders as squares, notes as dots.** Click a square to go inside it. The breadcrumb at the top takes you back out.
- **Hover a dot** to see the note's name, folder, links in and out, and the start of its text.
- **Click a dot** to open the note. In a closed square, Ctrl/Cmd + click opens it.
- **Search** note names and folders from any level. Squares show "N found", Enter jumps to the first match, Esc clears.
- **Big folders are boxed.** A folder with more than 1000 notes is split into boxes of 1000. More than 5 boxes are packed into a bigger box, again and again.
- Bigger dots mean more notes link to that note.
- Drag to move, scroll to zoom.

## Install
From Obsidian: **Settings → Community plugins → Browse**, search "Box Graph". (Once it is accepted into the list.)

By hand:
1. Download `main.js` and `manifest.json` from the latest [release](../../releases/latest).
2. Put them in `<your vault>/.obsidian/plugins/box-graph/`.
3. In Obsidian, turn on **Box Graph** under **Settings → Community plugins**.

Open it with the box icon on the left, or the command **Box Graph: Open**.

## Good to know
- Search looks at note names and folders, not the text inside notes. That keeps typing fast.
- Link lines are only drawn between the notes in the open square.
- Nothing is read from disk except the one note you hover (after 200 ms).
- On phones, tapping works, but pinch-to-zoom does not yet.

## License
MIT
