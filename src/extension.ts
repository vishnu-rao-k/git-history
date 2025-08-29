// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import simpleGit from 'simple-git';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "git-history" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('git-history.showHistory', async () => {
		// The code you place here will be executed every time your command is executed
		// Create and show a new webview panel
		const panel = vscode.window.createWebviewPanel(
			'gitGraphSearch',
			'Git Graph Search',
			vscode.ViewColumn.One,
			{ enableScripts: true }
		);

		// Ensure you have an open workspace to infer the repo path.
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders || workspaceFolders.length === 0) {
			vscode.window.showErrorMessage('No workspace open. Please open a Git repository.');
			return;
		}
		let repoPath: string;
		if (workspaceFolders.length === 1) {
			repoPath = workspaceFolders[0].uri.fsPath;
		} else {
			// Prompt user to select a folder if multiple are open
			const selected = await vscode.window.showQuickPick(
				workspaceFolders.map(f => ({ label: f.name, description: f.uri.fsPath })),
				{
					placeHolder: 'Select the repository folder to view history',
				}
			);
			if (!selected) {
				vscode.window.showErrorMessage('No repository folder selected.');
				return;
			}
			repoPath = selected.description;
		}
		const git = simpleGit(repoPath);

		// Fetch Git logs (this retrieves a list of commits)
		let logData;
		try {
			logData = await git.log();
		} catch (error) {
			vscode.window.showErrorMessage('Failed to retrieve Git logs.');
			logData = { all: [] };
		}

		// Set the initial webview HTML content including the commit data.
		panel.webview.html = getWebviewContent(logData);

		// Listen to messages sent from the webview for search functionality.
		panel.webview.onDidReceiveMessage(async message => {
			if (message.command === 'search') {
				const searchQuery = message.text;
				const filtered = logData.all.filter(commit =>
					commit.author_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
					commit.message.toLowerCase().includes(searchQuery.toLowerCase())
				);
				panel.webview.postMessage({ command: 'updateGraph', data: filtered });
			} else if (message.command === 'showFiles') {
				// Get files changed in the commit
				try {
					const files = await git.show(["--name-only", "--pretty=format:", message.commitId]);
					const fileList = files.split('\n').filter(f => f.trim() !== '');
					panel.webview.postMessage({ command: 'showFiles', commitId: message.commitId, files: fileList });
				} catch (error) {
					panel.webview.postMessage({ command: 'showFiles', commitId: message.commitId, files: [], error: 'Failed to get files.' });
				}
			}
		});
	});

	context.subscriptions.push(disposable);
}


/**
 * Returns the HTML content for the webview.
 *
 * @param logData The Git log data to be rendered.
 */
function getWebviewContent(logData: any): string {
	return `
	<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<title>Git Graph Search</title>
		<style>
			body {
				font-family: var(--vscode-font-family, sans-serif);
				color: var(--vscode-editor-foreground);
				background: var(--vscode-editor-background);
				margin: 0;
				padding: 0 0 24px 0;
			}
			h1 {
				font-size: 1.5em;
				margin: 18px 0 12px 0;
				color: var(--vscode-editor-foreground);
				text-align: center;
			}
			#searchSection {
				margin: 18px 0 18px 0;
				display: flex;
				gap: 8px;
				align-items: center;
				justify-content: center;
			}
			#searchBox {
				width: 60%;
				padding: 8px 12px;
				border-radius: 5px;
				border: 1px solid var(--vscode-input-border);
				background: var(--vscode-input-background);
				color: var(--vscode-input-foreground);
				font-size: 1em;
				transition: border 0.2s;
			}
			#searchBox:focus {
				outline: none;
				border: 1.5px solid var(--vscode-focusBorder);
			}
			button {
				background: var(--vscode-button-background);
				color: var(--vscode-button-foreground);
				border: none;
				border-radius: 5px;
				padding: 8px 18px;
				font-size: 1em;
				cursor: pointer;
				transition: background 0.2s;
			}
			button:hover {
				background: var(--vscode-button-hoverBackground);
			}
			table.git-log-table {
				width: 100%;
				border-collapse: collapse;
				margin-top: 10px;
				background: var(--vscode-editor-background);
				color: var(--vscode-editor-foreground);
				box-shadow: 0 2px 8px 0 rgba(0,0,0,0.04);
			}
			table.git-log-table th, table.git-log-table td {
				border: 1px solid var(--vscode-editorWidget-border);
				padding: 8px 10px;
				text-align: left;
				min-width: 80px;
				max-width: 400px;
				overflow: auto;
			}
			table.git-log-table th {
				background: var(--vscode-editorWidget-background);
				color: var(--vscode-editorWidget-foreground);
				font-weight: 600;
				resize: horizontal;
				cursor: col-resize;
			}
			table.git-log-table tr:nth-child(even) td {
				background: var(--vscode-sideBar-background);
			}
			.file-list {
				margin: 8px 0 8px 24px;
				color: var(--vscode-descriptionForeground);
			}
			.view-files-btn {
				padding: 4px 12px;
				font-size: 0.95em;
				border-radius: 4px;
				border: 1px solid var(--vscode-button-border, transparent);
				background: var(--vscode-button-secondaryBackground, var(--vscode-button-background));
				color: var(--vscode-button-secondaryForeground, var(--vscode-button-foreground));
			}
			.view-files-btn:hover {
				background: var(--vscode-button-secondaryHoverBackground, var(--vscode-button-hoverBackground));
			}
			em, .file-list em {
				color: var(--vscode-descriptionForeground);
			}
		</style>
	</head>
	<body>
		<h1>Git Graph</h1>
		<div id="searchSection">
			<input type="text" id="searchBox" placeholder="Search by author or comment" />
			<button onclick="search()">Search</button>
		</div>
		<div id="graph"></div>
		<script>
			const vscode = acquireVsCodeApi();
			let commits = ${JSON.stringify(logData.all)};
			function renderGraph(data) {
				const graphDiv = document.getElementById('graph');
				if (!data.length) {
					graphDiv.innerHTML = '<em>No commits found.</em>';
					return;
				}
				let table = \`<table class="git-log-table">
					<thead>
						<tr>
							<th>Date</th>
							<th>Author</th>
							<th>Message</th>
							<th>Commit ID</th>
							<th>Files</th>
						</tr>
					</thead>
					<tbody>\`;
				data.forEach(commit => {
					table += \`
						<tr>
							<td title="\${commit.date}">\${commit.date}</td>
							<td>\${commit.author_name}</td>
							<td>\${commit.message}</td>
							<td style="font-family:monospace;font-size:0.95em;">\${commit.hash}</td>
							<td><button class="view-files-btn" onclick="showFiles('\${commit.hash}')">View Files</button><div id="files-\${commit.hash}" class="file-list"></div></td>
						</tr>
					\`;
				});
				table += '</tbody></table>';
				graphDiv.innerHTML = table;
			}
			function search() {
				const text = document.getElementById('searchBox').value;
				vscode.postMessage({ command: 'search', text });
			}
			window.showFiles = function(commitId) {
				vscode.postMessage({ command: 'showFiles', commitId });
			}
			window.addEventListener('message', event => {
				const message = event.data;
				if(message.command === 'updateGraph') {
					renderGraph(message.data);
				} else if(message.command === 'showFiles') {
					const filesDiv = document.getElementById('files-' + message.commitId);
					if (filesDiv) {
						if (message.error) {
							filesDiv.innerHTML = \`<span style='color:red;'>\${message.error}</span>\`;
						} else if (message.files.length === 0) {
							filesDiv.innerHTML = '<em>No files changed.</em>';
						} else {
							filesDiv.innerHTML = '<ul>' + message.files.map(f => \`<li>\${f}</li>\`).join('') + '</ul>';
						}
					}
				}
			});
			// Add event listener for Enter key on searchBox
			document.addEventListener('DOMContentLoaded', function() {
				const searchBox = document.getElementById('searchBox');
				if (searchBox) {
					searchBox.addEventListener('keydown', function(e) {
						if (e.key === 'Enter') {
							search();
						}
					});
				}
			});
			renderGraph(commits);
		</script>
	</body>
	</html>
	`;
}


// This method is called when your extension is deactivated
export function deactivate() {}
