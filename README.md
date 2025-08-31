# git-history extension

A Visual Studio Code extension that helps you easily browse, search, and explore the commit history of your Git repositories.

## Features
- **View Full Commit History**: Display the entire commit history of your repository in a searchable, sortable table within Visual Studio Code.
- **Integration with Source Control**: Seamlessly integrates with VS Code’s built-in Git features for a unified workflow.
- **Responsive UI**: Optimized for performance and usability, even in large repositories.

## Extension Settings

This extension contributes the following settings:

* `gitHistory.enable`: Enable or disable the Git History extension.
* `gitHistory.showFileHistory`: Show file history in the context menu (default: `true`).

## Release Notes

### 0.0.1

Initial release of the git history extension.

### 0.0.2

- Added a feature to select git history of a repository if there are multiple repositories in the workspace.

### 0.0.3

- Fixed repository selection in multi-root workspaces, ensuring only valid Git repositories are listed.

### 0.0.4

- Added a new feature to show repository name in the webview panel and to change the repository selection.
- Improved initialization of the webview.

### 0.0.5

- Fixed dependencies
