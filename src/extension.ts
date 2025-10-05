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
// Set this to true to enable debug/info messages
const DEBUG_MODE = false;

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
		// Always reset the panel when a repo is selected (re-opened)
		if (currentPanel) {
			currentPanel.dispose();
			currentPanel = undefined;
			if (DEBUG_MODE) {
				vscode.window.showInformationMessage('Previous panel is disposed.');
			}
		}
		currentPanel = vscode.window.createWebviewPanel(
			'gitHistory',
			'Git history',
			columnToShowIn || vscode.ViewColumn.One,
			{ enableScripts: true, retainContextWhenHidden: true }
		);
		if (DEBUG_MODE) {
			vscode.window.showInformationMessage('New panel is created.');
		}
		// Set the initial webview HTML content including the commit data and repo info.
		// Pass the webview and extensionUri to getWebviewContent so it can resolve the script URI
		const scriptPath = vscode.Uri.joinPath(context.extensionUri, 'dist', 'main.js');
		const cssPath = vscode.Uri.joinPath(context.extensionUri, 'dist', 'css', 'style.css');
		const scriptUri = currentPanel.webview.asWebviewUri(scriptPath);
		const cssUri = currentPanel.webview.asWebviewUri(cssPath);
		// Set the HTML content for the webview
		currentPanel.webview.html = getWebviewContent(logData, repoList, repoIndex, branches, branchIndex, scriptUri, cssUri);

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
						vscode.window.showInformationMessage(`Git History: Switching to repo: ${repoName}`);
						currentPanel.webview.postMessage({ command: 'updateGraph', data: logData.all, repoList, repoIndex, branches, branchIndex });
					}
				} catch (error) {
					if (currentPanel) {
						currentPanel.webview.postMessage({ command: 'updateGraph', data: [], repoIndex, error: 'Git History: Failed to get repository history.' });
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
						vscode.window.showInformationMessage(`Git History: Switching to branch: ${currentBranch} in repo: ${repoName}`);
						currentPanel.webview.postMessage({ command: 'updateGraph', data: logData.all, branchIndex: message.branchIndex });
					}
				} catch (error) {
					if (currentPanel) {
						vscode.window.showErrorMessage(`Git History: Failed to get history for branch: ${currentBranch} in repo: ${repoName}`);
						// Send empty data with error message to webview
						currentPanel.webview.postMessage({ command: 'updateGraph', data: [], error: 'Git History: Failed to get repository history for the selected branch.' });
					}
				}
			} else if (message.command === 'info') {
				// Show the message
				if (DEBUG_MODE) {
					vscode.window.showInformationMessage(message.text);
				}
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
 * @param webview The webview instance (for asWebviewUri)
 * @param extensionUri The extension URI (for asWebviewUri)
 */
export function getWebviewContent(
	logData: any,
	repoList: { name: string, path: string }[],
	repoIndex: number,
	branches: string[],
	branchIndex: number,
	scriptUri: vscode.Uri,
	cssUri: vscode.Uri
): string {
	return `
       <!DOCTYPE html>
       <html lang="en">
       <head>
	       <meta charset="UTF-8">
	       <title>Git history</title>
	       <link rel="stylesheet" type="text/css" href="${cssUri}">
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
		       <button id="searchBtn">Search</button>
	       </div>
	       <div id="graph"></div>
	       <script>
		       window.gitHistoryInitialState = {
			       initialCommits: ${JSON.stringify(logData.all)},
			       initialRepoList: ${JSON.stringify(repoList)},
			       initialRepoIndex: ${repoIndex},
			       initialBranches: ${JSON.stringify(branches)},
			       initialBranchIndex: ${branchIndex}
		       };
	       </script>
	       <script src="${scriptUri}"></script>
       </body>
       </html>
       `;
}


// This method is called when your extension is deactivated
export function deactivate() { }
