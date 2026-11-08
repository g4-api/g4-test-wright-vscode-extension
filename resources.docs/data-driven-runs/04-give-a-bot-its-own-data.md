# Module 4: Give a bot its own data

[⬅ Back to overview](README.md)

⏱️ **About 6 minutes**

📍 **Where you are:** **Plan**. A bot can carry its own table in a `dataSource`. Test Wright reads it to start the cells of the sheet for you.

In this module, you will:

- Add a `dataSource` to a bot in three ways
- See how the sheet uses it
- Know what happens at run time

---

## What a data source is

A bot can hold a table of rows in its `dataSource`. Each row is an object, and each key is a column name. For **login-with-columns** the table has the keys **User** and **Password**:

```json
[
    { "User": "ann", "Password": "secret1" },
    { "User": "bob", "Password": "secret2" }
]
```

The bot gets it in its JSON file as:

```json
"dataSource": {
    "type": "Json",
    "source": "<the table, in one of three forms>"
}
```

`Json` is the only type the engine reads.

---

## Form 1: a file

Put the table in a file next to the bot, and name it:

```json
"dataSource": {
    "type": "Json",
    "source": "data/users.json"
}
```

A relative path is read from the folder of the bot file. An absolute path is read as it is.

> **📝 Note:** The **engine** reads a file path on **its own** machine. Test Wright reads the same path on **your** machine, only to fill the sheet. If the engine runs elsewhere, use form 2 or 3.

---

## Form 2: a JSON array

Write the array inside `source`, as text:

```json
"dataSource": {
    "type": "Json",
    "source": "[{\"User\":\"ann\",\"Password\":\"secret1\"},{\"User\":\"bob\",\"Password\":\"secret2\"}]"
}
```

---

## Form 3: Base64

Encode the JSON array as Base64 and write the result in `source`:

```json
"dataSource": {
    "type": "Json",
    "source": "W3siVXNlciI6ImFubiIsIlBhc3N3b3JkIjoic2VjcmV0MSJ9XQ=="
}
```

That text is the Base64 of `[{"User":"ann","Password":"secret1"}]`. Test Wright decodes Base64 the way the engine does, and accepts the result only if it is JSON.

---

## How the sheet uses it

1. Add the bot to the plan and open the sheet.
2. Click **Add Iteration**. The first iteration starts from row 1 of the bot's data source. Iteration 2 starts from row 2, and so on.
3. Cells for columns the data source does not hold are empty. Rows that are not objects are ignored.

![The sheet with cells filled from the bot's data source](images/04-from-data-source.png)

TODO(screenshot): images/04-from-data-source.png

If the bot's data source cannot be read, the cells start empty. Nothing fails, and the reason is kept with the bot's data. Troubleshooting lists the messages.

---

## What happens at run time

- **Plan with iterations:** each plan item sends **its own row** of the iteration as a one-row data source, in Base64. That row **replaces** the bot's `dataSource` for that execution only.
- **Plan without iterations:** the plan runs once, and the bot's own `dataSource` is used as it is.
- **The bot file** is never changed.

Values are always sent as **text**, so a column never mixes types. The engine rejects a column with mixed types.

---

## 🧪 Try it

Copy **login-with-columns** to a new bot file. Add a `dataSource` in form 2 with two rows. Add it to the plan, open the sheet, and click **Add Iteration** twice.

**You should see:** iteration 1 with `ann` and `secret1`, and iteration 2 with `bob` and `secret2`.

---

## ✔ Check your work

- [ ] You can write a `dataSource` as a file, a JSON array, and Base64
- [ ] You know the first iteration starts from the bot's data
- [ ] You know the sheet's row replaces the data source for one execution
- [ ] You know the bot file is never changed

---

**Next up** 👉 [Module 5: Export and import a data file](05-export-and-import-a-data-file.md)
