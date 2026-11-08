# Module 4: Air-gapped reports

[⬅ Back to overview](README.md)

⏱️ **About 6 minutes**

📍 **Where you are:** **Generate**, the last part. The Allure command has written the pages, and Test Wright now makes sure they cannot reach any other computer.

In this module, you will:

- See what Test Wright removes and adds to every report page
- Understand why a link in a report does nothing
- Learn what the local server serves and what it refuses
- Know why a page without a `<head>` is never opened

---

## Step 1: See the changes to each page

After Allure writes the report, Test Wright goes through **every** `.html` page in the report folder (in all subfolders) and changes it:

| Change | What it does |
| --- | --- |
| Remote scripts are removed | Any script whose `src` points to another host, and any Google Analytics code (`googletagmanager` or `gtag(`), is dropped. The report's own scripts stay. |
| A Content Security Policy is added | A `meta` tag at the top of `<head>`. The page may load scripts, styles, data, fonts, images, and frames only from its own server. `data:` and `blob:` are allowed for icons and attachments. |
| A link guard is added | A small script that runs first, described in step 2. |

A page that already holds the guard is left alone, so opening a report again is safe.

---

## Step 2: Understand why links do nothing

The policy cannot stop a page from **navigating** to another host. So the link guard does:

- A click, or a middle click, on a link to another host is cancelled. Nothing happens.
- `window.open` opens only an address of the report's own server. A blank window is refused as well.

That explains what you may notice:

- The **Powered by Allure** link in the footer does nothing.
- A link inside a result does nothing. Test Wright results carry no links.
- Allure's Playwright trace viewer opens a blank window and sends the trace to another site. Test Wright refuses it.
- Downloads still work: they use `blob:` addresses of the report's own server.

![The Allure footer, where the link does nothing when clicked](images/04-footer-link.png)

TODO(screenshot): images/04-footer-link.png

---

## Step 3: Know what the server does

The report is shown from a small web server inside VS Code:

- It listens on `127.0.0.1` only, on a random port. Other computers cannot reach it.
- It serves one folder, and it answers `403` for any path outside that folder.
- Every answer carries the same policy as a header, so even a page written before the air gap existed is guarded.
- It sends `Cache-Control: no-store`.
- It is reused when you open the same report again, and stopped when the extension stops.

In VS Code, the report is shown in a tab that frames this address. With **Browser** on, your own web browser opens the same local address.

---

## Step 4: Know when a report is refused

If one page of the report has no `<head>`, Test Wright cannot write the policy into it. The report is **not** opened, and you see:

```text
The Allure report page <page> has no <head>, so it cannot be kept off the network; the report was not opened.
```

Generate the report again. If it keeps happening, see [Troubleshooting](troubleshooting.md).

---

## 🧪 Try it

Open a report and click **Powered by Allure** in the footer.

**You should see:** nothing happens, and no browser tab opens.

---

## ✔ Check your work

- [ ] You can name the three changes made to every page
- [ ] You know why external links do nothing
- [ ] You know the server listens on `127.0.0.1` only
- [ ] You know what the "no `<head>`" message means

---

**Next up** 👉 [Module 5: When the Allure command fails](05-when-the-allure-command-fails.md)
