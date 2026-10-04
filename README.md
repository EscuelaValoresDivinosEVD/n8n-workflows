# EVD n8n workflows

This repository keeps a copy of the n8n workflows that run EVD's automations, with written documentation for each one, and builds a small documentation website from them.

It holds no application code. The workflows themselves run on the n8n server at https://auto.evdsky.com/; what is here is an export of each published workflow plus notes on what it does.

## What is in here

| Folder or file | What it is |
|---|---|
| `workflows/<area>/<workflow>/` | One folder per workflow: the exported `.json` and a `.md` describing it. Areas so far: `clev`, `google-workspace`, `highlevel`. |
| `site/` | The generated documentation website. Never edit it by hand. |
| `scripts/` | The scripts that build `site/`. |
| `CLAUDE.md` | The detailed rules Claude Code follows when working in this repo. |

## View the documentation

You need [Node.js](https://nodejs.org/) installed.

1. Install the tools once:
   ```
   npm install
   ```
2. Build the site:
   ```
   npm run build
   ```
3. Start the preview and open http://localhost:3111 in your browser:
   ```
   npm run serve
   ```

The site has two pages. **Workflows** explains each workflow and shows its JSON. **API reference** lists the webhook endpoints the workflows expose.

## Import new workflows, or update existing ones

Importing is done with Claude Code, which reads the workflows from n8n through your browser. You do not copy files by hand.

### Before you start

1. **Connect to the EVD VPN.** The n8n server is not reachable without it.
2. **Install Claude Code** and open it in this folder.
3. **Install the "Claude in Chrome" extension** in Google Chrome, sign in to it, and connect it to Claude Code. Claude will tell you if it is not connected.
4. **Log in to n8n yourself**, in Chrome, at https://auto.evdsky.com/. Claude never types passwords.

There are three n8n accounts, one per area: **CLEV**, **Google Workspace** and **HighLevel**. Each account only shows its own workflows, and only one can be logged in at a time. To work on a different area, log out and log in with that area's account.

If you don't have these logins, ask Eduardo Rudas, Rebecca Rondon or Cesar Valderrama for credentials.

### Steps

1. Log in to n8n with the account for the area you want.
2. Ask Claude Code to do the import, naming the area. For example:
   > Import the published workflows from https://auto.evdsky.com/home/workflows?status=true into the highlevel area.

   To refresh workflows that are already here, ask it to update that area instead.
3. Read Claude's report. It lists anything sensitive it found (tokens, personal data, internal addresses) and what it did about it. Answer any questions it asks before going further.
4. Check the result at http://localhost:3111. Claude rebuilds the site as part of the import.
5. Tell Claude to commit when you are happy. It makes one commit per workflow.
6. Repeat from step 1 for each other area.

## Rules worth knowing

- **Nothing secret goes into the repo.** Tokens are replaced with a placeholder, personal data in notes is redacted, and HighLevel location IDs are removed. The untouched exports stay in `raw/`, which git ignores; never commit that folder.
- **`site/` is generated.** Change a workflow's `.json` or `.md`, then run `npm run build`.
- **The documentation describes what is published in n8n,** not unpublished drafts. A workflow with an unpublished draft is marked as such.
- **Do not push.** No remote repository has been set up yet.

`CLAUDE.md` has the full detail behind each of these.
