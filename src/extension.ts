// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import simpleGit, { SimpleGit } from 'simple-git';

let outputChannel: vscode.OutputChannel;

export function logInfo(message: string, showOutput: boolean = false) {
	if (!outputChannel) {
		outputChannel = vscode.window.createOutputChannel('Git History fast');
	}
	outputChannel.appendLine(new Date().toISOString() + ' ' + message);
	if (showOutput) {
		outputChannel.show(true);
	}
}

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
	logInfo('Extension activated.'); // Log activation message

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
			logInfo(`Multiple repositories found: ${repoList.map(r => r.name).join(', ')}`);
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
			logInfo(`Selected repository: ${repoName} at path: ${repoPath}`);
		}

		// Fetch Git logs (this retrieves a list of commits)
		let git = simpleGit(repoPath);

		// Get list of all branches of the repository
		// (Not currently used in the UI, but could be added for branch filtering)
		let currentBranch: string = '';
		let branches: string[] = [];
		let branchIndex: number = -1;

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
		// Create and show a new webview panel
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
		currentPanel.webview.html = getWebviewContent(scriptUri, cssUri);

		// Listen to messages sent from the webview for search functionality and repo switching.
		currentPanel.webview.onDidReceiveMessage(async message => {
			if (message.command === 'initialize') {
				// This command is sent from the webview when it is ready to receive data
				// Send the initial data to the webview
				if (currentPanel) {
					try {
						logInfo(`Initializing webview with repo: ${repoName}`);
						logInfo(`Fetching branches of repo: ${repoName}`);
						const branchInfo = await getGitBranches(git);
						branches = branchInfo.all;
						currentBranch = branchInfo.current;
						branchIndex = branches.indexOf(currentBranch);
						logInfo(`Fetched ${branches.length} branches of repo: ${repoName}. Current branch: ${currentBranch}`);
						const commits = (await git.log([currentBranch])).all;
						logInfo(`Fetched ${commits.length} commits for repo: ${repoName}, branch: ${currentBranch}`);
						currentPanel.webview.postMessage({ command: 'updateGraph', data: commits, repoList, repoIndex, branches, branchIndex });
						logInfo(`Webview initialized successfully for repo: ${repoName}, branch: ${currentBranch}`);
						vscode.window.showInformationMessage(`Git history initialized for repo: ${repoName}, branch: ${currentBranch} successfully.`);
					} catch (error) {
						vscode.window.showErrorMessage(`Failed to refresh git logs for repository '${repoName}'.`);
						logInfo(`Error details: ${(error as Error).message}`, true);
					}
				}
			} else if (message.command === 'showFiles') {
				// Get files changed in the commit
				if (currentPanel) {
					try {
						logInfo(`Fetching files for commit: ${message.commitId} in repo: ${repoName}`);
						const files = await git.show(["--name-only", "--pretty=format:", message.commitId]);
						const fileList = files.split('\n').filter(f => f.trim() !== '');
						logInfo(`Fetched ${fileList.length} files for commit: ${message.commitId} in repo: ${repoName}`);
						currentPanel.webview.postMessage({ command: 'showFiles', commitId: message.commitId, files: fileList });
						logInfo(`Files for commit: ${message.commitId} sent to webview successfully.`);
						// vscode.window.showInformationMessage(`Files for commit: ${message.commitId} fetched successfully.`);
					} catch (error) {
						logInfo(`Error fetching files for commit: ${message.commitId} in repo: ${repoName}`, true);
						currentPanel.webview.postMessage({ command: 'showFiles', commitId: message.commitId, files: [], error: 'Failed to get files.' });
					}
				}
			} else if (message.command === 'selectRepo') {
				if (currentPanel) {
					// User selected a repository, update git and reload log
					repoIndex = message.repoIndex;
					repoName = repoList[repoIndex].name;
					repoPath = repoList[repoIndex].path;
					git = simpleGit(repoPath);
					try {
						logInfo(`Fetching branches of repo: ${repoName}`);
						const branchInfo = await getGitBranches(git);
						branches = branchInfo.all;
						currentBranch = branchInfo.current;
						branchIndex = branches.indexOf(currentBranch);
						logInfo(`Fetched ${branches.length} branches of repo: ${repoName}. Current branch: ${currentBranch}`);
						logInfo(`Fetching commits of repo: ${repoName}, branch: ${currentBranch}`);
						const commits = (await git.log([currentBranch])).all;
						logInfo(`Fetched ${commits.length} commits for repo: ${repoName}, branch: ${currentBranch}`);
						// Print info message
						logInfo(`Switching to repo: ${repoName}`);
						currentPanel.webview.postMessage({ command: 'updateGraph', data: commits, repoList, repoIndex, branches, branchIndex });
						logInfo(`Switched to repo: ${repoName} successfully.`);
						vscode.window.showInformationMessage(`Switched to repo: ${repoName} successfully.`);
					} catch (error) {
						logInfo(`Error details: ${(error as Error).message}`);
						currentPanel.webview.postMessage({ command: 'updateGraph', data: [], repoIndex, error: 'Git History: Failed to get repository history.' });
						logInfo(`Failed to get repository history for repo: ${repoName}`);
						vscode.window.showErrorMessage(`Git History: Failed to get repository history for repo: ${repoName}`);

					}
				}
			} else if (message.command === 'selectBranch') {
				if (currentPanel) {
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
						logInfo(`Fetching commits of repo: ${repoName}, branch: ${currentBranch}`);
						const commits = (await git.log([currentBranch])).all;
						logInfo(`Fetched ${commits.length} commits for repo: ${repoName}, branch: ${currentBranch}`);
						// Print info message
						logInfo(`Switching to branch: ${currentBranch} in repo: ${repoName}`);
						currentPanel.webview.postMessage({ command: 'updateGraph', data: commits, branchIndex: message.branchIndex });
						logInfo(`Switched to branch: ${currentBranch} in repo: ${repoName} successfully.`);
						vscode.window.showInformationMessage(`Switched to branch: ${currentBranch} in repo: ${repoName} successfully.`);
					} catch (error) {
						logInfo(`Error details: ${(error as Error).message}`, true);
						logInfo(`Failed to get repository history for branch: ${currentBranch} in repo: ${repoName}`, true);
						currentPanel.webview.postMessage({ command: 'updateGraph', data: [], repoIndex, error: 'Git History: Failed to get repository history.' });
						vscode.window.showErrorMessage(`Git History: Failed to get repository history for branch: ${currentBranch} in repo: ${repoName}`);
					}
				}
			} else if (message.command === 'info') {
				// Show the message
				if (DEBUG_MODE) {
					vscode.window.showInformationMessage(message.text);
				}
				logInfo(message.text);
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
 * @param scriptUri The URI of the script to include in the webview (resolved using asWebviewUri)
 * @param cssUri The URI of the CSS file to include in the webview (resolved using asWebviewUri)
 */
export function getWebviewContent(
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
	</div>
	<div id="branchSection">
		<label for="branchSelect">Branch:</label>
		<select id="branchSelect"></select>
	</div>
	<div id="searchSection">
		<input type="text" id="searchBox" placeholder="Search by author or commit id or comment" />
		<button id="searchButton">Search</button>
	</div>
	<div id="graph">
	<center>
		<b>Loading git history...</b>
	</center>
	</div>
	<script src="${scriptUri}"></script>
</body>
</html>
`;
}


// This method is called when your extension is deactivated
export function deactivate() { }
