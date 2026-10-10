# Module 1: Open Test Wright

[⬅ Back to overview](README.md)

⏱️ **About 3 minutes**

In this module you'll open Test Wright and learn what each part of the page is for. You won't run anything yet.

In this module, you will:

- Open Test Wright from the Activity Bar
- Recognize the header, the sidebars, the Bots Tree, and the Testing Plan
- Check that Test Wright can reach the G4 engine

---

## Step 1: Open the page

On the far left of VS Code is the **Activity Bar**. Click the **flask** icon named **G4 Test Wright**. A tab named **G4 Test Wright** opens, and the side bar closes to give the page room.

> **💡 Tip:** Want a second Test Wright, for example to build one plan while another runs? With a Test Wright tab already open, click the flask icon again. The side bar stays open this time and shows an **Open Test Wright** button: every click opens another tab. Each tab runs its own plans and shows only its own runs in its console.
>
> You can also press `Ctrl+Shift+P` (`Cmd+Shift+P` on a Mac), type **Test Wright**, and choose **G4 Test Wright: Open Test Wright**.

---

## Step 2: Read the header

The bar at the top of the page holds the things that apply to every run:

| Part | What it does |
| --- | --- |
| **Bots** | The folder Test Wright reads bots from. It starts at your project's `bots` folder. Click it to pick another folder. |
| **Environment** | The environment the bots run in. You'll use it in [Module 4](04-run-the-plan.md). |
| **Engine** | The G4 engine address, with a colored dot: green when the engine answers, red when it does not. Click it to check again. |
| **Status** | What Test Wright is doing right now, such as **Idle**, **Discovering**, **Running**, or **Scheduled**. |

---

## Step 3: Meet the page areas

Under the header, the page has five areas:

| Area | What it holds |
| --- | --- |
| **Left sidebar** | **Discovery** (find your bots), **Filters** (narrow the tree), and **Schedule** (run later) |
| **Bots Tree** | Every bot Test Wright found, grouped by suite |
| **Testing Plan** | The bots you want to run, in order, with the run buttons |
| **Right sidebar** | Three repositories: **Test Plans**, **Test Reports**, and **Allure Reports** |
| **Console** | A log of everything Test Wright did. Open it from the status bar at the bottom. |

> **💡 Tip:** The three buttons at the bottom right of the page show or hide the left sidebar, the console, and the right sidebar. Drag the thin borders between the areas to resize them. Test Wright remembers your layout, folders, and plan the next time you open it.

---

## Step 4: Check the engine

Look at the **Engine** part of the header. If the dot is **green**, Test Wright can reach the engine and you're ready.

If the dot is **red**, start the G4 engine and click the Engine button to check again. The address comes from the `g4Server` section of your project's `manifest.json`.

---

## ✔ Check your work

- [ ] The **G4 Test Wright** tab is open
- [ ] The **Bots** part of the header shows your project's `bots` folder
- [ ] The **Engine** dot is green

---

**Next up** 👉 [Module 2: Discover your bots](02-discover-your-bots.md)
