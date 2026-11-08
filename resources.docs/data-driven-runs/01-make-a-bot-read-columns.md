# Module 1: Make a bot read columns

[⬅ Back to overview](README.md)

⏱️ **About 5 minutes**

📍 **Where you are:** **Plan**, the second stop on the line. Before the plan can run with data, a bot must say which values it needs.

In this module, you will:

- Open the practice bot that reads two columns
- Learn what a column placeholder looks like
- Put the bot in the plan and see its columns

---

## Step 1: Find the practice bot

1. Press **Discover Bots** in Test Wright, then find **login-with-columns** in the **practice** suite of the Bots Tree.

    ![The Bots Tree with login-with-columns in the practice suite](images/01-bots-tree.png)

    TODO(screenshot): images/01-bots-tree.png

2. Open it as JSON (see [Run Your Bots, Module 3](../run-your-bots/03-discover-your-bots.md)) and find the two **SendKeys** rules.

If the bot is not in the tree, run **Add Practice Bots** again. Existing files are kept, and the new bot is added.

---

## Step 2: Read the placeholders

The bot types a user and a password. It does not hold them. It asks for them by name:

```json
{
    "$type": "Action",
    "pluginName": "SendKeys",
    "locator": "Xpath",
    "argument": "{{$ columns.User }}",
    "onElement": "//positive"
}
```

`{{$ columns.User }}` is a **column placeholder**. The bot above has two: **User** and **Password**.

The rules for a placeholder are strict, because the engine matches it exactly:

- It starts with `{{$`, then **one** space, then `columns.`, then the name, then **one** space, then `}}`.
- The name uses letters, digits, and `_` only.
- Upper and lower case do not matter: `columns.user` and `columns.User` are the same column.

> **📝 Note:** Test Wright only looks inside the bot's `stages`, because the engine only resolves columns inside rules.

---

## Step 3: Put the bot in the plan

1. Drag **login-with-columns** into the **Testing Plan**.
2. Look at the end of its row. A small table icon with a number appears.

    ![A plan row with the data button showing 2](images/01-data-button.png)

    TODO(screenshot): images/01-data-button.png

    The numbered parts of the row:

    1. **Data button**: the table icon. The number is how many columns the bot reads. Here it is **2**.
    2. **Tooltip**: point at the button to see the column names, for example `Edit this item's data (columns: User, Password)`.

A bot without placeholders has no data button, because it is **static**.

---

## 🧪 Try it

Add **login-with-columns** and **practice-pass** to the plan.

**You should see:** a data button with **2** on login-with-columns, and no data button on practice-pass.

---

## ✔ Check your work

- [ ] You found **login-with-columns** in the tree
- [ ] You can point at a column placeholder in the JSON
- [ ] The plan row shows a data button with **2**
- [ ] You know that a bot without placeholders is static

---

**Next up** 👉 [Module 2: Fill the data sheet](02-fill-the-data-sheet.md)
