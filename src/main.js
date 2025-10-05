// This script is loaded in the webview for Git history
const vscode = acquireVsCodeApi();

if (gitHistoryInitialState === undefined) {
    throw new Error('Missing initial state for git history');
};

/** @type {Array<Object>} */
let commits = gitHistoryInitialState.initialCommits;
/** @type {Array<{ name: string, path: string }>} */
let repoList = gitHistoryInitialState.initialRepoList;
/** @type {number} */
let repoIndex = gitHistoryInitialState.initialRepoIndex;
/** @type {Array<string>} */
let branches = gitHistoryInitialState.initialBranches;
/** @type {number} */
let branchIndex = gitHistoryInitialState.initialBranchIndex;
let tableHtml;

function populateRepoSelector() {
    const select = document.getElementById('repoSelect');
    const nameSpan = document.getElementById('repoName');
    if (!select || !nameSpan) {
        return;
    }
    select.options.length = 0;
    repoList.forEach(function (repo, idx) {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = repo.name;
        if (idx === repoIndex) {opt.selected = true;}
        select.appendChild(opt);
    });
    nameSpan.textContent = repoList[repoIndex].name;
    select.onchange = function () {
        vscode.postMessage({ command: 'selectRepo', repoIndex: parseInt(select.value, 10) });
    };
}

function populateBranchSelector() {
    const select = document.getElementById('branchSelect');
    if (!select) {
        return;
    }
    select.options.length = 0;
    branches.forEach(function (branch, idx) {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = branch;
        if (idx === branchIndex) {
            opt.selected = true;
        }
        select.appendChild(opt);
    });
    select.onchange = function () {
        branchIndex = parseInt(select.value, 10);
        vscode.postMessage({ command: 'selectBranch', repoIndex: repoIndex, branchIndex });
        vscode.postMessage({ command: 'info', text: 'Git History: Selected branch index: ' + branchIndex });
    };
}

function formatLocalDate(dateStr) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
        return d.toLocaleString();
    }
    return dateStr;
}

function renderGraph(data) {
    if (!tableHtml) {
        const graphDiv = document.getElementById('graph');
        if (!data.length) {
            tableHtml = '<em>No commits found.</em>';
        } else {
            tableHtml = '<table class="git-log-table">' +
                '<thead>' +
                '<tr>' +
                '<th>Date</th>' +
                '<th>Author</th>' +
                '<th>Message</th>' +
                '<th>Commit ID</th>' +
                '<th>Files</th>' +
                '</tr>' +
                '</thead>' +
                '<tbody>';
            data.forEach(commit => {
                tableHtml += '<tr>' +
                    '<td>' + formatLocalDate(commit.date) + '</td>' +
                    '<td>' + commit.author_name + '</td>' +
                    '<td>' + commit.message + '</td>' +
                    '<td style="font-family:monospace;font-size:0.95em;">' + commit.hash + '</td>' +
                    '<td><button class="view-files-btn" onclick="showFiles(\'' + commit.hash + '\')">View Files</button><div id="files-' + commit.hash + '" class="file-list"></div></td>' +
                    '</tr>';
            });
            tableHtml += '</tbody></table>';
        }
        graphDiv.innerHTML = tableHtml;
    } else {
        document.getElementById('graph').innerHTML = tableHtml;
    }
}

function search() {
    const text = document.getElementById('searchBox').value;
    vscode.postMessage({ command: 'search', text });
}

window.showFiles = function (commitId) {
    vscode.postMessage({ command: 'showFiles', commitId });
}

window.addEventListener('message', function (event) {
    const message = event.data;
    if (message.command === 'updateGraph') {
        commits = message.data;
        let clearSearch = false;
        if (message.repoList !== undefined && message.repoList.length > 0) {
            repoList = message.repoList;
            repoIndex = message.repoIndex !== undefined ? message.repoIndex : 0;
            populateRepoSelector();
            clearSearch = true;
        }
        if (message.branches !== undefined && message.branches.length > 0) {
            branches = message.branches;
            branchIndex = message.branchIndex;
            populateBranchSelector();
            clearSearch = true;
        }
        if (clearSearch || message.branchIndex !== undefined) {
            const searchBox = document.getElementById('searchBox');
            if (searchBox) {
                searchBox.value = '';
            }
        }
        tableHtml = '';
        renderGraph(commits);
    } else if (message.command === 'showFiles') {
        const filesDiv = document.getElementById('files-' + message.commitId);
        if (filesDiv) {
            if (message.error) {
                filesDiv.innerHTML = '<span style="color:red;">' + message.error + '</span>';
            } else if (message.files.length === 0) {
                filesDiv.innerHTML = '<em>No files changed.</em>';
            } else {
                filesDiv.innerHTML = '<ul>' + message.files.map(function (f) { return '<li>' + f + '</li>'; }).join('') + '</ul>';
            }
        }
    }
});

document.addEventListener('DOMContentLoaded', function () {
    populateRepoSelector();
    populateBranchSelector();
    const searchBox = document.getElementById('searchBox');
    if (searchBox) {
        searchBox.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                search();
            }
        });
    }
    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) {
        searchBtn.addEventListener('click', search);
    }
    renderGraph(commits);
});
