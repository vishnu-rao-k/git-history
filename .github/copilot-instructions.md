# Project Overview

This project is a Visual Studio Code extension that shows history of a git project.
It provides a user-friendly interface to view and manage the commit history and files modified in the VS Code webview.

## Features

- View commit history of the current git repository.
- Display files modified in each commit.
- Navigate through different commits and view their details.

## Folders and Files

- `.github/`: Contains GitHub-specific files, including this `copilot-instructions.md` file.
- `src/`: Contains the source code for the VS Code extension.
- `package.json`: Configuration file for the VS Code extension.
- `README.md`: Documentation file for the project.
- `LICENSE`: License file for the project.
- `tsconfig.json`: TypeScript configuration file.

## Getting Started

To get started with this project, follow these steps:
1. Clone the repository to your local machine.
2. Open the project in Visual Studio Code.
3. Run `npm install` to install the necessary dependencies.
4. Press `F5` to launch the extension in a new VS Code window.
5. Use the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) and type `Show Git History` to view the commit history.
6. Click on a commit to view the files modified in that commit.

## Coding Standards

- Follow TypeScript best practices.
- Write clean and maintainable code.
- Include comments and documentation where necessary.
- Ensure code is properly formatted.
- Write unit tests for new features and bug fixes.
- Follow the existing project structure and naming conventions.
- Use Git for version control and create meaningful commit messages.
- Create pull requests for code reviews before merging changes.
- Adhere to the project's coding style and guidelines.
- Ensure compatibility with the latest version of Visual Studio Code.
- Test the extension thoroughly before releasing new versions.
- Keep dependencies up to date and secure.
- Maintain a changelog to document changes and updates.
- Ensure the extension works across different operating systems (Windows, macOS, Linux).
- Document any new features or changes in the README file.
- Ensure that the extension does not introduce performance issues or memory leaks.
- Use appropriate error handling and logging mechanisms.
- Keep the user interface intuitive and user-friendly.

## UI guidelines

- Use the VS Code webview API to create the UI.
- Follow VS Code's design principles for a consistent user experience.
- Ensure the webview is responsive and works well on different screen sizes.
- Use clear and concise language in the UI.
- Ensure accessibility for users with disabilities.
- Use appropriate icons and visual elements to enhance the user experience.
- Maintain a clean and uncluttered interface.
- Test the UI on different themes (light and dark) to ensure visibility and usability.
- Ensure that the webview content is properly sandboxed for security.
- Use animations and transitions sparingly to enhance the user experience without causing distractions.
- Ensure that the webview content is optimized for performance and does not cause lag or delays.
- Document any UI changes or updates in the README file.
