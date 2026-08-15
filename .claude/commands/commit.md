Generate a conventional commit message for the currently staged changes.

Run the following to get the staged diff and recent commit style:

```
git diff --staged
git log --oneline -5
```

Then produce a single conventional commit message following this format:

```
<type>(<scope>): <short imperative summary>

<optional body: what changed and why, wrapped at 72 chars>
```

**Types:** feat, fix, docs, style, refactor, perf, test, chore, build, ci  
**Scope:** the affected area in lowercase (e.g. `auth`, `ui`, `firebase`, `notifications`). Omit if the change is truly cross-cutting.  
**Summary:** imperative mood, lowercase, no period, ≤72 chars total on the first line.  
**Body:** include only when the why is non-obvious. Skip if the summary is self-explanatory.  
**Breaking change:** append `!` after the type/scope (e.g. `feat!:`) and add a `BREAKING CHANGE:` footer if the API changes.

After showing the message, ask the user if they want to run `git commit` with it. If $ARGUMENTS contains `--apply`, run the commit immediately without asking.
