# 0.0.4 August 2025

## Added

- A new feature to show repository name in the webview panel and to change the repository selection.

## Changed

- Changed initialization of the webview to improve performance.

# 0.0.3 August 2025

## Fixed

- Fixed repository selection in multi-root workspaces, ensuring only valid Git repositories are listed.

# 0.0.2 August 2025

## Added

- Added an option to select a repository in a multi-root workspaces.

# 0.0.1 June 2025

## Added

- Initial version of the extension to display Git commit history in a tabular format within a VS Code webview.
- Added the ability to view the list of files changed in each commit.
- Enabled viewing commit details, including author, date, and commit message.
- Implemented responsive, theme-aware UI using VS Code theme variables.
- All Git operations performed using `simple-git` for reliability and cross-platform support.
- Supports single-root workspaces for initial release.
