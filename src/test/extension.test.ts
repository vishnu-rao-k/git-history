// src/test/suite/extension.test.ts
import * as assert from 'assert';
import * as vscode from 'vscode';
import { getWebviewContent, fetchGitLogs, getGitBranches } from '../extension';
import { SimpleGit } from 'simple-git';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('getWebviewContent should render correctly with log data', () => {
		const logData = {
			all: [
				{ hash: '123', date: '2023-01-01', author_name: 'test', message: 'initial commit' }
			]
		};
		const repoList = [{ name: 'my-repo', path: '/path/to/my-repo' }];
		const branches = ['main'];

		// Mock webview and extensionUri for getWebviewContent
		const mockExtensionUri = vscode.Uri.file(__dirname + '/../../');
		const scriptUri = mockExtensionUri.with({ path: mockExtensionUri.path + '/src/main.js' });
		const cssUri = mockExtensionUri.with({ path: mockExtensionUri.path + '/css/styles.css' });
		
		const html = getWebviewContent(logData, repoList, 0, branches, 0, scriptUri, cssUri);
		console.log(html);

		assert.ok(html.includes('<h1>Git history</h1>'), 'Should render the main title');
		assert.ok(html.includes('initial commit'), 'Should render the commit message');
		assert.ok(html.includes('my-repo'), 'Should render the repository name');
		// assert.ok(html.includes('<option value="0" selected>main</option>'), 'Should render the current branch');
	});

	test('getWebviewContent should show "No commits" message for empty log', () => {		
		// Mock webview and extensionUri for getWebviewContent
		const mockExtensionUri = vscode.Uri.file(__dirname + '/../../');
		const scriptUri = mockExtensionUri.with({ path: mockExtensionUri.path + '/src/main.js' });
		const cssUri = mockExtensionUri.with({ path: mockExtensionUri.path + '/css/styles.css' });
		

		const html = getWebviewContent({ all: [] }, [], -1, [], -1, scriptUri, cssUri);
		assert.ok(html.includes('<em>No commits found.</em>'), 'Should show no commits message');
	});


	// test('fetchGitLogs should return logs from simple-git', async () => {
	// 	const mockLog = { all: [{ hash: 'abc', message: 'test log' }] };
	// 	const mockGit: Partial<SimpleGit> = {
	// 		log: async () => mockLog as any, // Cast to any to satisfy SimpleGit.log() return type
	// 	};

	// 	const result = await fetchGitLogs(mockGit as SimpleGit);
	// 	assert.deepStrictEqual(result.all, mockLog.all);
	// });

	// test('fetchGitLogs should throw if simple-git fails', async () => {
	// 	const mockGit: Partial<SimpleGit> = {
	// 		log: async () => { throw new Error('Git failed'); },
	// 	};

	// 	try {
	// 		await fetchGitLogs(mockGit as SimpleGit);
	// 		assert.fail('Should have thrown an error');
	// 	} catch (e: any) {
	// 		assert.ok(e.message.includes('Failed to fetch git logs'));
	// 	}
	// });

	// test('getGitBranches should return branches from simple-git', async () => {
	// 	const mockBranches = { current: 'main', all: ['main', 'dev'] };
	// 	const mockGit: Partial<SimpleGit> = {
	// 		branch: async () => mockBranches,
	// 	};

	// 	const result = await getGitBranches(mockGit as SimpleGit);
	// 	assert.deepStrictEqual(result, mockBranches);
	// });

});
