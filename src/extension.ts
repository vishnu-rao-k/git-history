// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import simpleGit, { SimpleGit } from 'simple-git';

// Function to get list of git repositories in the workspace
// (Not currently used, but could be useful for future enhancements)
async function getGitRepositories(): Promise<string[]> {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) {
		return [];
	}
	// Find all Git repositories in the workspace folders
	// Minimal Repository type for VS Code Git API
	type Repository = {
		rootUri: vscode.Uri;
		// Add more properties if needed
	};

	const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
	const gitApi = gitExtension?.getAPI(1);
	const repositories: Repository[] = gitApi?.repositories ?? [];
	return repositories.map(r => r.rootUri.fsPath);
}

// Function to fetch git logs using simple-git
export async function fetchGitLogs(git: SimpleGit): Promise<{ all: any[] }> {
	try {
		const log = await git.log();
		return { all: Array.from(log.all) };
	} catch (error) {
		throw new Error('Failed to fetch git logs: ' + (error as Error).message);
	}
}

// Function to get branch list using simple-git
export async function getGitBranches(git: SimpleGit): Promise<{ current: string, all: string[] }> {
	try {
		const branches = await git.branch();
		return { current: branches.current, all: branches.all };
	} catch (error) {
		throw new Error('Failed to fetch git branches: ' + (error as Error).message);
	}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "git-history" is now active!');

	// Keep track of the current webview panel
	let currentPanel: vscode.WebviewPanel | undefined = undefined;

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('git-history.showHistory', async () => {
		// The code you place here will be executed every time your command is executed

		// Ensure you have an open workspace to infer the repo path.
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders || workspaceFolders.length === 0) {
			vscode.window.showErrorMessage('No workspace open. Please open a Git repository.');
			return;
		}

		// const repositories: Repository[] = gitApi?.repositories ?? [];
		let repositories: string[] = await getGitRepositories();

		if (repositories.length === 0) {
			vscode.window.showErrorMessage('No Git repositories found in the workspace.');
			return;
		}

		// Prepare repository list for dropdown
		const repoList = repositories.map(r => ({
			name: r.split(/[\\/]/).pop() || r,
			path: r
		}));
		let repoIndex = 0;
		let repoName: string = repoList[0].name;
		let repoPath: string = repoList[0].path;

		if (repoList.length > 1) {
			// Prompt user to select a repository if multiple are found
			const repoItems = repoList.map((r) => ({
				label: r.name,
				description: r.path
			}));
			const selected = await vscode.window.showQuickPick(
				repoItems,
				{
					placeHolder: 'Select the Git repository to view history',
				}
			);
			if (!selected) {
				vscode.window.showErrorMessage('No repository selected.');
				return;
			}
			repoName = selected.label;
			repoPath = selected.description;
			repoIndex = repoList.findIndex(r => r.path === repoPath);
		}

		// Fetch Git logs (this retrieves a list of commits)
		let git = simpleGit(repoPath);
		let logData: { all: any[] } = await fetchGitLogs(git);

		// Check if git log retrieval was successful
		if (!logData || !logData.all) {
			vscode.window.showErrorMessage(`Failed to retrieve git logs for repository '${repoName}'.`);
			return;
		}

		// Get list of all branches of the repository
		// (Not currently used in the UI, but could be added for branch filtering)
		let currentBranch: string = '';
		let branches: string[] = [];
		let branchIndex: number = -1;
		try {
			const branchInfo = await getGitBranches(git);
			currentBranch = branchInfo.current;
			branches = branchInfo.all;
			branchIndex = branches.indexOf(currentBranch);
			// branches.all contains the list of branch names
			// Could be sent to webview if needed
		} catch (error) {
			// Ignore branch retrieval errors for now
		}

		// Check if branches were fetched successfully
		// If needed, could send to webview for branch selection
		if (!branches || branches.length === 0) {
			vscode.window.showWarningMessage(`No branches found in repository '${repoName}'.`);
		}

		// Determine the column to show the webview in
		const columnToShowIn = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;
		// Create and show a new webview currentPanel
		if (currentPanel) {
			// If we already have a panel, update its content with the latest data.
			// and show it in the target column
			vscode.window.showInformationMessage('Previous panel found.');
			currentPanel.webview.postMessage({ command: 'updateGraph', data: logData.all, repoList, repoIndex, branches, branchIndex});
			// currentPanel.webview.html = getWebviewContent(logData, repoList, repoIndex, branches, branchIndex);
			currentPanel.reveal(columnToShowIn);
		} else {
			currentPanel = vscode.window.createWebviewPanel(
				'gitHistory',
				'Git history',
				columnToShowIn || vscode.ViewColumn.One,
				{ enableScripts: true }
			);
			vscode.window.showInformationMessage('New panel.');
			// Set the initial webview HTML content including the commit data and repo info.
			currentPanel.webview.html = getWebviewContent(logData, repoList, repoIndex, branches, branchIndex);
		};

		// Listen to messages sent from the webview for search functionality and repo switching.
		currentPanel.webview.onDidReceiveMessage(async message => {
			if (message.command === 'search') {
				const searchQuery = message.text;
				const filtered = logData.all.filter((commit: any) =>
					commit.author_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
					commit.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
					commit.hash.toLowerCase().includes(searchQuery.toLowerCase())
				);
				if (currentPanel) {
					currentPanel.webview.postMessage({ command: 'updateGraph', data: filtered });
				}
			} else if (message.command === 'showFiles') {
				// Get files changed in the commit
				try {
					const files = await git.show(["--name-only", "--pretty=format:", message.commitId]);
					const fileList = files.split('\n').filter(f => f.trim() !== '');
					if (currentPanel) {
						currentPanel.webview.postMessage({ command: 'showFiles', commitId: message.commitId, files: fileList });
					}
				} catch (error) {
					if (currentPanel) {
						currentPanel.webview.postMessage({ command: 'showFiles', commitId: message.commitId, files: [], error: 'Failed to get files.' });
					}
				}
			} else if (message.command === 'selectRepo') {
				// User selected a repository, update git and reload log
				repoIndex = message.repoIndex;
				repoName = repoList[repoIndex].name;
				repoPath = repoList[repoIndex].path;
				git = simpleGit(repoPath);
				try {
					const rawLog = await git.log();
					logData = { all: Array.from(rawLog.all) };
					const branchInfo = await getGitBranches(git);
					branches = branchInfo.all;
					currentBranch = branchInfo.current;
					branchIndex = branches.indexOf(currentBranch);
					if (currentPanel) {
						// Print info message
						vscode.window.showInformationMessage(`Switching to repo: ${repoName}`);
						currentPanel.webview.postMessage({ command: 'updateGraph', data: logData.all, repoList, repoIndex, branches, branchIndex });
					}
				} catch (error) {
					if (currentPanel) {
						currentPanel.webview.postMessage({ command: 'updateGraph', data: [], repoIndex, error: 'Failed to get repository history.' });
					}
				}
			} else if (message.command === 'selectBranch') {
				// User selected a branch, update git and reload log
				repoIndex = message.repoIndex;
				repoName = repoList[repoIndex].name;
				repoPath = repoList[repoIndex].path;
				currentBranch = branches[message.branchIndex];
				git = simpleGit(repoPath);
				if (message.branchIndex < 0 || message.branchIndex >= branches.length) {
					vscode.window.showErrorMessage(`Invalid branch selected.`);
					return;
				}
				try {
					const rawLog = await git.log([currentBranch]);
					logData = { all: Array.from(rawLog.all) };
					const lengthOfLog = logData.all.length;
					if (currentPanel) {
						// Print info message
						vscode.window.showInformationMessage(`Switching to branch: ${currentBranch} in repo: ${repoName}`);
						currentPanel.webview.postMessage({ command: 'updateGraph', data: logData.all, repoIndex});
					}
				} catch (error) {
					if (currentPanel) {
						vscode.window.showErrorMessage(`Failed to get history for branch: ${currentBranch} in repo: ${repoName}`);
						// Send empty data with error message to webview
						currentPanel.webview.postMessage({ command: 'updateGraph', data: [], error: 'Failed to get repository history for the selected branch.' });
					}
				}
			} else if (message.command === 'info') {
				// Show the message
				vscode.window.showInformationMessage(message.text);
			}
		});

		// Reset when the currentPanel is closed
		currentPanel.onDidDispose(() => {
			currentPanel = undefined;
		}, null, context.subscriptions);

	});

	context.subscriptions.push(disposable);
}


/**
 * Returns the HTML content for the webview.
 *
 * @param logData The Git log data to be rendered.
 */
export function getWebviewContent(logData: any, repoList: { name: string, path: string }[], repoIndex: number, branches: string[], branchIndex: number): string {
	return `
	<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">	
		<title>Git history</title>
		<style>
			:root {
				color-scheme: light dark;
			}
			body {
				font-family: var(--vscode-font-family, sans-serif);
				color: var(--vscode-editor-foreground, #333);
				background: var(--vscode-editor-background, #fff);
				margin: 0;
				padding: 0 0 24px 0;
			}
			h1 {
				font-size: 1.5em;
				margin: 18px 0 12px 0;
				color: var(--vscode-editor-foreground, #333);
				text-align: center;
			}
			#repoSection, #branchSection, #searchSection {
				margin: 18px 0 0 0;
				display: flex;
				gap: 8px;
				align-items: center;
				justify-content: center;
			}
			#searchSection {
				margin: 18px 0 18px 0;
			}
			#searchBox {
				width: 60%;
				padding: 8px 12px;
				border-radius: 5px;
				border: 1px solid var(--vscode-input-border, #ccc);
				background: var(--vscode-input-background, #fff);
				color: var(--vscode-input-foreground, #333);
				font-size: 1em;
				transition: border 0.2s;
			}
			#searchBox:focus {
				outline: none;
				border: 1.5px solid var(--vscode-focusBorder, #0078d4);
			}
			button {
				background: var(--vscode-button-background, #0078d4);
				color: var(--vscode-button-foreground, #fff);
				border: none;
				border-radius: 5px;
				padding: 8px 18px;
				font-size: 1em;
				cursor: pointer;
				transition: background 0.2s;
			}
			button:hover {
				background: var(--vscode-button-hoverBackground, #005a9e);
			}
			select {
				background: var(--vscode-input-background, #fff);
				color: var(--vscode-input-foreground, #333);
				border: 1px solid var(--vscode-input-border, #ccc);
				border-radius: 4px;
				padding: 6px 10px;
				font-size: 1em;
			}
			select:focus {
				outline: none;
				border: 1.5px solid var(--vscode-focusBorder, #0078d4);
			}
			table.git-log-table {
				width: 100%;
				border-collapse: collapse;
				margin-top: 10px;
				background: var(--vscode-editor-background, #fff);
				color: var(--vscode-editor-foreground, #333);
				box-shadow: 0 2px 8px 0 rgba(0,0,0,0.04);
			}
			table.git-log-table th, table.git-log-table td {
				border: 1px solid var(--vscode-editorWidget-border, #e1e1e1);
				padding: 8px 10px;
				text-align: left;
				min-width: 80px;
				max-width: 400px;
				overflow: auto;
			}
			table.git-log-table th {
				background: var(--vscode-editorWidget-background, #f3f3f3);
				color: var(--vscode-editorWidget-foreground, #333);
				font-weight: 600;
				resize: horizontal;
				cursor: col-resize;
			}
			table.git-log-table tr:nth-child(even) td {
				background: var(--vscode-sideBar-background, #f8f8f8);
			}
			.file-list {
				margin: 8px 0 8px 24px;
				color: var(--vscode-descriptionForeground, #888);
			}
			.view-files-btn {
				padding: 4px 12px;
				font-size: 0.95em;
				border-radius: 4px;
				border: 1px solid var(--vscode-button-border, transparent);
				background: var(--vscode-button-secondaryBackground, var(--vscode-button-background, #0078d4));
				color: var(--vscode-button-secondaryForeground, var(--vscode-button-foreground, #fff));
			}
			.view-files-btn:hover {
				background: var(--vscode-button-secondaryHoverBackground, var(--vscode-button-hoverBackground, #005a9e));
			}
			em, .file-list em {
				color: var(--vscode-descriptionForeground, #888);
			}
		</style>
	</head>
	<body>
		<h1>Git history</h1>
		<div id="repoSection">
			<label for="repoSelect">Repository:</label>
			<select id="repoSelect"></select>
			<span id="repoName" style="font-weight:bold;"></span>
		</div>
		<div id="branchSection">
			<label for="branchSelect">Branch:</label>
			<select id="branchSelect"></select>
		</div>
		<div id="searchSection">
			<input type="text" id="searchBox" placeholder="Search by author or commit id or comment" />
			<button onclick="search()">Search</button>
		</div>
		<div id="graph"></div>
		<script>
			const vscode = acquireVsCodeApi();
			vscode.postMessage({ command: 'info', text: 'Inside the script starting' });
			const previousState = vscode.getState();
			vscode.postMessage({ command: 'info', text: 'After runing getState.' });
			let commits, repoList, repoIndex, branches, branchIndex, tableHtml;
			// If previous state exists, use it to restore variables
			if (previousState) {
				vscode.postMessage({ command: 'info', text: 'Previous state found.' });
				commits = previousState.commits ? previousState.commits : ${JSON.stringify(logData.all)};
				repoList = previousState.repoList ? previousState.repoList : ${JSON.stringify(repoList)};	
				repoIndex = previousState.repoIndex ? previousState.repoIndex : ${repoIndex};
				branches = previousState.branches ? previousState.branches : ${JSON.stringify(branches)};
				branchIndex = previousState.branchIndex ? previousState.branchIndex : ${branchIndex};
				tableHtml = previousState.tableHtml ? previousState.tableHtml : '';
				vscode.postMessage({ command: 'info', text: 'Restored variables from previous state.' });
				vscode.postMessage({ command: 'info', text: 'branchIndex: ' + branchIndex + ' repoIndex: ' + repoIndex + ' commits: ' + commits.length });
			}
			else {
				vscode.postMessage({ command: 'info', text: 'No previous state found.' });
				commits = ${JSON.stringify(logData.all)};
				repoList = ${JSON.stringify(repoList)};
				repoIndex = ${repoIndex};
				branches = ${JSON.stringify(branches)};
				branchIndex = ${branchIndex};
				vscode.setState({ commits, repoList, repoIndex, branches, branchIndex });
			}

			vscode.postMessage({ command: 'info', text: 'After setting variables.' });

			function populateRepoSelector() {
				const select = document.getElementById('repoSelect');
				const nameSpan = document.getElementById('repoName');
				if (!select || !nameSpan) return;
				select.options.length = 0;
				repoList.forEach(function(repo, idx) {
					const opt = document.createElement('option');
					opt.value = idx;
					opt.textContent = repo.name;
					if (idx === repoIndex) opt.selected = true;
					select.appendChild(opt);
				});
				nameSpan.textContent = repoList[repoIndex].name;
				select.onchange = function() {
					vscode.postMessage({ command: 'selectRepo', repoIndex: parseInt(select.value, 10) });
				};
			}

			function populateBranchSelector() {
				const select = document.getElementById('branchSelect');
				if (!select) return;
				select.options.length = 0;
				branches.forEach(function(branch, idx) {
					const opt = document.createElement('option');
					opt.value = idx;
					opt.textContent = branch;
					if (idx === branchIndex) opt.selected = true;
					select.appendChild(opt);
				});
				select.onchange = function() {
					branchIndex = parseInt(select.value, 10);
					vscode.postMessage({ command: 'selectBranch', repoIndex: repoIndex, branchIndex });
					vscode.postMessage({ command: 'info', text: 'Selected branch index: ' + branchIndex });
				};
			}

			function renderGraph(data) {
				vscode.postMessage({ command: 'info', text: 'Rendering graph with ' + data.length + ' commits.' });
				if (!tableHtml) {
					vscode.postMessage({ command: 'info', text: 'No previous tableHtml, rendering new table.' });
					const graphDiv = document.getElementById('graph');
					if (!data.length) {
						vscode.postMessage({ command: 'info', text: 'No commits found.' });
						tableHtml = '<em>No commits found.</em>';
					}
					else {
						vscode.postMessage({ command: 'info', text: 'Generating table HTML header.' });
						tableHtml = \`<table class="git-log-table">
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
						vscode.postMessage({ command: 'info', text: 'Generating table HTML data.' });
						data.forEach(commit => {
							tableHtml += \`
								<tr>
									<td title="\${commit.date}">\${commit.date}</td>
									<td>\${commit.author_name}</td>
									<td>\${commit.message}</td>
									<td style="font-family:monospace;font-size:0.95em;">\${commit.hash}</td>
									<td><button class="view-files-btn" onclick="showFiles('\${commit.hash}')">View Files</button><div id="files-\${commit.hash}" class="file-list"></div></td>
								</tr>
							\`;
						});
						vscode.postMessage({ command: 'info', text: 'Generated table HTML data.' });
						tableHtml += '</tbody></table>';
						vscode.postMessage({ command: 'info', text: 'Generated complete table.' });
						vscode.postMessage({ command: 'info', text: 'Table HTML generated. Size - ' + tableHtml.length });
					}
					vscode.postMessage({ command: 'info', text: 'Table HTML generated. Size - ' + tableHtml.length });
					graphDiv.innerHTML = tableHtml;
				}
				else {
					document.getElementById('graph').innerHTML = tableHtml;
				}
				vscode.postMessage({ command: 'info', text: 'Rendering graph completed.' });
			}
			function search() {
				const text = document.getElementById('searchBox').value;
				vscode.postMessage({ command: 'search', text });
			}
			window.showFiles = function(commitId) {
				vscode.postMessage({ command: 'showFiles', commitId });
			}
			window.addEventListener('message', function(event) {
				const message = event.data;
				if(message.command === 'updateGraph') {
					commits = message.data;
					if (message.repoList !== undefined && message.repoList.length > 0) {
						repoList = message.repoList;
						repoIndex = message.repoIndex !== undefined ? message.repoIndex : 0;
						populateRepoSelector();
						vscode.postMessage({ command: 'info', text: 'Updated repo list in webview.' });
					}
					if (message.branches !== undefined && message.branches.length > 0) {
						branches = message.branches;
						branchIndex = message.branchIndex;
						populateBranchSelector();
						vscode.postMessage({ command: 'info', text: 'Updated branches in webview.' });
					}
					// Re-render the graph with the new data
					tableHtml = '';
					vscode.postMessage({ command: 'info', text: 'Updating commits table in webview.' });
					renderGraph(commits);
					vscode.setState({ commits, repoList, repoIndex, branches, branchIndex, tableHtml });
				} else if(message.command === 'showFiles') {
					const filesDiv = document.getElementById('files-' + message.commitId);
					if (filesDiv) {
						if (message.error) {
							filesDiv.innerHTML = '<span style="color:red;">' + message.error + '</span>';
						} else if (message.files.length === 0) {
							filesDiv.innerHTML = '<em>No files changed.</em>';
						} else {
							filesDiv.innerHTML = '<ul>' + message.files.map(function(f) { return '<li>' + f + '</li>'; }).join('') + '</ul>';
						}
						vscode.setState({ commits, repoList, repoIndex, branches, branchIndex, tableHtml: document.getElementById('graph').innerHTML });
					}
				}
			});
			document.addEventListener('DOMContentLoaded', function() {
				vscode.postMessage({ command: 'info', text: 'Inside the DOMContentLoaded' });
				populateRepoSelector();
				populateBranchSelector();
				const searchBox = document.getElementById('searchBox');
				if (searchBox) {
					searchBox.addEventListener('keydown', function(e) {
						if (e.key === 'Enter') {
							search();
						}
					});
				}
				renderGraph(commits);
			});
		</script>
	</body>
	</html>
	`;
}


// This method is called when your extension is deactivated
export function deactivate() { }
