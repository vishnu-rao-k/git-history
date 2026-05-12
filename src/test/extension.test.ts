// src/test/suite/extension.test.ts
import * as assert from 'assert';
import * as vscode from 'vscode';
import { getWebviewContent, getGitBranches } from '../extension';
import { SimpleGit } from 'simple-git';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('getWebviewContent should render correctly with log data', () => {
		const commits = [
				{ hash: '123', date: '2023-01-01', author_name: 'test', message: 'initial commit' }
		];
		const repoList = [{ name: 'my-repo', path: '/path/to/my-repo' }];
		const branches = ['main'];

		// Mock webview and extensionUri for getWebviewContent
		const mockExtensionUri = vscode.Uri.file(__dirname + '/../../');
		const scriptUri = mockExtensionUri.with({ path: mockExtensionUri.path + '/src/main.js' });
		const cssUri = mockExtensionUri.with({ path: mockExtensionUri.path + '/css/styles.css' });
		
		const html = getWebviewContent(scriptUri, cssUri);
		console.log(html);

		assert.ok(html.includes('<title>Git history</title>'), 'Should render the main title');
		assert.ok(html.includes('<h1>Git history</h1>'), 'Should render the header');
		assert.ok(html.includes(`<script src="${scriptUri}"></script>`), 'Should show script tag with correct URI');
		assert.ok(html.includes(`<link rel="stylesheet" type="text/css" href="${cssUri}">`), 'Should show link tag with correct URI');
	});

	// test('getGitBranches should return branches from simple-git', async () => {
	// 	const mockBranches = { current: 'main', all: ['main', 'dev'] };
	// 	const mockGit: Partial<SimpleGit> = {
	// 		branch: async () => mockBranches,
	// 	};

	// 	const result = await getGitBranches(mockGit as SimpleGit);
	// 	assert.deepStrictEqual(result, mockBranches);
	// });

});
