# Module 2: Discover your bots

[⬅ Back to overview](README.md)

⏱️ **About 4 minutes**

Before you can run bots, Test Wright needs to find them. In this module you'll fill the **Bots Tree** and learn to narrow it down.

In this module, you will:

- Discover the bots in your `bots` folder
- Understand how files and folders become tests and suites
- Filter the tree by name and by tag

---

## Step 1: Press Discover Bots

In the left sidebar, under **Discovery**, press **Discover Bots**.

The **Bots Tree** fills with your bots. At the top of the tree, **discovered** tells you how many bots were found and **visible** how many are shown right now.

---

## Step 2: Understand what was found

Test Wright looks at every file under the bots folder, including the folders inside it:

- Every **`.json`**, **`.g4`**, and **`.g4bot`** file that is a bot becomes a **test**.
- Every **folder** becomes a **suite**. A folder inside a folder becomes a nested suite, such as `smoke/login`.
- Folders whose names start with a dot, `node_modules`, and `reports` are skipped.

For example:

```none
bots/
├── calculator-2plus2.json        → test "calculator-2plus2" (no suite)
└── smoke/
    ├── login.json                → test "login" in suite "smoke"
    └── checkout/
        └── pay.g4bot             → test "pay" in suite "smoke/checkout"
```

Suites show a folder icon and the number of bots inside; bots show a file icon. Click a suite to open or close it. The two arrow buttons at the top of the tree open or close every suite at once.

> **💡 Tip:** Double-click a bot to open it in the G4 Workflow Editor (it opens as JSON text when the G4 Engine Client extension is not installed). Hover a bot or a suite and click **+** to add it to the end of the plan without dragging.

After a run, a small icon after each bot shows how its last run ended: a green check (**Passed**), a red cross (**Failed** or **Broken**), or a yellow triangle (**Warning**).

### Use the keyboard

Click any row, then:

| Key | What it does |
| --- | --- |
| **↑** / **↓** | Move up or down |
| **→** | Open a suite, or step into it |
| **←** | Close a suite, or go up to its suite |
| **Home** / **End** | Jump to the first or last row |
| **Enter** | Add the bot or the whole suite to the plan |
| **Space** | Open the bot file, or open/close a suite |
>
> **📝 Note:** A file that is not valid JSON, or that has no `stages`, is not a bot. Test Wright skips it and writes a warning in the console, so one broken file never stops the discovery.

---

## Step 3: Filter by name

Under **Filters**, type into the box. The tree shows only the bots whose name, suite, or tag contains what you typed. Clear the box to see them all again.

---

## Step 4: Filter by tag

Tags let you mark bots, such as `smoke` or `regression`, and pick them out later. A bot's tags live in its file, in the `reference` section:

```json
{
  "reference": {
    "tags": [ "smoke", "web" ]
  },
  "stages": [ ]
}
```

After you discover the bots, the tag filter under the text box lists every tag with the number of bots that carry it. Open it, tick one or more tags, and the tree shows only bots that have one of them.

> **💡 Tip:** Added a tag or a new bot? Press **Discover Bots** again to refresh the tree. Your plan is not affected.

---

## ✔ Check your work

- [ ] The Bots Tree shows your bots, grouped by suite
- [ ] Typing in the filter box narrows the tree
- [ ] You know where a bot's tags come from

---

**Next up** 👉 [Module 3: Build a run plan](03-build-a-run-plan.md)
