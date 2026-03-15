const state = {
	currentAgent: 'default',
	currentModel: 'openai',
	status: null,
	agents: [],
	memory: null,
	files: [],
	messages: [],
	page: 'chat',
	installedPlugins: [],
	availablePlugins: [],
	pluginQuery: ''
};

const elements = {
	agentList: document.getElementById('agent-list'),
	runtimeStatus: document.getElementById('runtime-status'),
	runtimeEndpoint: document.getElementById('runtime-endpoint'),
	currentAgentLabel: document.getElementById('current-agent-label'),
	currentModelLabel: document.getElementById('current-model-label'),
	chatLog: document.getElementById('chat-log'),
	chatForm: document.getElementById('chat-form'),
	promptInput: document.getElementById('prompt-input'),
	sendButton: document.getElementById('send-button'),
	memoryPanel: document.getElementById('memory-panel'),
	filesPanel: document.getElementById('files-panel'),
	refreshAgents: document.getElementById('refresh-agents'),
	refreshMemory: document.getElementById('refresh-memory'),
	refreshFiles: document.getElementById('refresh-files'),
	chatPage: document.getElementById('chat-page'),
	pluginsPage: document.getElementById('plugins-page'),
	navItems: document.querySelectorAll('[data-page]'),
	installedPlugins: document.getElementById('installed-plugins'),
	availablePlugins: document.getElementById('available-plugins'),
	refreshPlugins: document.getElementById('refresh-plugins'),
	pluginSearchInput: document.getElementById('plugin-search-input'),
	pluginSearchButton: document.getElementById('plugin-search-button')
};

async function bootstrap() {
	try {
		const result = await window.go.ui.App.Initialize();
		state.status = result.status;
		state.agents = result.agents || [];

		if (state.agents.length > 0) {
			state.currentAgent = state.agents[0].name;
			state.currentModel = state.agents[0].model;
		}

		render();
		await Promise.all([refreshMemory(), refreshFiles(), refreshPlugins()]);
	} catch (error) {
		state.status = {
			online: false,
			endpoint: 'http://localhost:7452',
			message: error.message || 'Failed to initialize AWaN GUI'
		};
		render();
	}
}

function render() {
	renderPage();
	renderStatus();
	renderAgents();
	renderChat();
	renderMemory();
	renderFiles();
	renderInstalledPlugins();
	renderAvailablePlugins();
}

function renderPage() {
	const isChat = state.page === 'chat';
	elements.chatPage.classList.toggle('active', isChat);
	elements.pluginsPage.classList.toggle('active', !isChat);
	elements.navItems.forEach((item) => {
		item.classList.toggle('active', item.getAttribute('data-page') === state.page);
	});
}

function renderStatus() {
	const status = state.status;
	if (!status) {
		elements.runtimeStatus.textContent = 'Checking AWaN Core...';
		elements.runtimeEndpoint.textContent = '';
		return;
	}

	elements.runtimeStatus.textContent = status.message;
	elements.runtimeEndpoint.textContent = status.endpoint;
	elements.currentAgentLabel.textContent = `Agent: ${state.currentAgent}`;
	elements.currentModelLabel.textContent = `Model: ${state.currentModel}`;
}

function renderAgents() {
	if (state.agents.length === 0) {
		elements.agentList.innerHTML = '<div class="empty-state"><p>No agents available.</p></div>';
		return;
	}

	elements.agentList.innerHTML = state.agents
		.map(
			(agent) => `
				<button class="agent-item ${agent.name === state.currentAgent ? 'active' : ''}" data-agent="${agent.name}" data-model="${agent.model}">
					<span class="agent-name">${agent.name}</span>
					<span class="agent-model">${agent.model}</span>
					<p>${agent.description || 'AWaN agent'}</p>
				</button>
			`
		)
		.join('');

	elements.agentList.querySelectorAll('[data-agent]').forEach((button) => {
		button.addEventListener('click', async () => {
			state.currentAgent = button.getAttribute('data-agent') || 'default';
			state.currentModel = button.getAttribute('data-model') || 'openai';
			await window.go.ui.App.SelectAgent(state.currentAgent, state.currentModel);
			render();
			await Promise.all([refreshMemory(), refreshFiles()]);
		});
	});
}

function renderChat() {
	if (state.messages.length === 0) {
		elements.chatLog.innerHTML = `
			<div class="empty-state">
				<h3>Start a conversation</h3>
				<p>Pick an agent from the left and send a prompt to AWaN Core.</p>
			</div>
		`;
		return;
	}

	elements.chatLog.innerHTML = state.messages
		.map(
			(message) => `
				<article class="chat-bubble ${message.role}">
					<div class="chat-role">${message.role}</div>
					<p>${escapeHTML(message.content).replaceAll('\n', '<br />')}</p>
				</article>
			`
		)
		.join('');
}

function renderMemory() {
	if (!state.memory) {
		elements.memoryPanel.innerHTML = '<div class="empty-state"><p>No memory loaded yet.</p></div>';
		return;
	}

	const shortTerm = renderMemorySection('Short term', state.memory.shortTerm);
	const longTerm = renderMemorySection('Long term', state.memory.longTerm);
	elements.memoryPanel.innerHTML = shortTerm + longTerm;
}

function renderMemorySection(title, records) {
	if (!records || records.length === 0) {
		return `
			<div class="record">
				<strong>${title}</strong>
				<p>No entries.</p>
			</div>
		`;
	}

	return `
		<div class="record">
			<strong>${title}</strong>
			${records
				.map(
					(record) => `
						<p class="record-meta"><strong>${record.role}</strong> - ${record.id}</p>
						<p>${escapeHTML(record.content)}</p>
					`
				)
				.join('')}
		</div>
	`;
}

function renderFiles() {
	if (!state.files || state.files.length === 0) {
		elements.filesPanel.innerHTML = '<div class="empty-state"><p>No files listed by the runtime.</p></div>';
		return;
	}

	elements.filesPanel.innerHTML = state.files
		.map(
			(file) => `
				<div class="file-item">
					<strong>${escapeHTML(file)}</strong>
				</div>
			`
		)
		.join('');
}

function renderInstalledPlugins() {
	if (!state.installedPlugins.length) {
		elements.installedPlugins.innerHTML = '<div class="empty-state"><p>No plugins installed.</p></div>';
		return;
	}

	elements.installedPlugins.innerHTML = state.installedPlugins
		.map(
			(plugin) => `
				<div class="plugin-card">
					<div class="plugin-card-head">
						<div>
							<strong>${escapeHTML(plugin.name)}</strong>
							<p>${escapeHTML(plugin.description || 'AWaN plugin')}</p>
						</div>
						<div class="plugin-meta">
							<span class="status-pill ${plugin.status === 'disabled' ? 'status-disabled' : ''}">${escapeHTML(plugin.status || 'enabled')}</span>
							<span class="version-pill">${escapeHTML(plugin.version || 'unknown')}</span>
						</div>
					</div>
					<div class="plugin-actions">
						<button class="ghost plugin-toggle" data-plugin-toggle="${plugin.name}" data-plugin-status="${plugin.status || 'enabled'}">${plugin.status === 'disabled' ? 'Enable' : 'Disable'}</button>
						<button class="ghost plugin-remove" data-plugin-remove="${plugin.name}">Remove</button>
					</div>
				</div>
			`
		)
		.join('');

	elements.installedPlugins.querySelectorAll('[data-plugin-toggle]').forEach((button) => {
		button.addEventListener('click', async () => {
			const name = button.getAttribute('data-plugin-toggle');
			const status = button.getAttribute('data-plugin-status');
			if (!name) {
				return;
			}
			if (status === 'disabled') {
				await window.go.ui.App.EnablePlugin(name);
			} else {
				await window.go.ui.App.DisablePlugin(name);
			}
			await refreshPlugins();
		});
	});

	elements.installedPlugins.querySelectorAll('[data-plugin-remove]').forEach((button) => {
		button.addEventListener('click', async () => {
			const name = button.getAttribute('data-plugin-remove');
			if (!name) {
				return;
			}
			await window.go.ui.App.RemovePlugin(name);
			await refreshPlugins();
		});
	});
}

function renderAvailablePlugins() {
	if (!state.availablePlugins.length) {
		elements.availablePlugins.innerHTML = '<div class="empty-state"><p>No plugins available from the registry.</p></div>';
		return;
	}

	const installed = new Set(state.installedPlugins.map((plugin) => plugin.name.toLowerCase()));
	elements.availablePlugins.innerHTML = state.availablePlugins
		.map(
			(plugin) => `
				<div class="plugin-card">
					<div class="plugin-card-head">
						<div>
							<strong>${escapeHTML(plugin.name)}</strong>
							<p>${escapeHTML(plugin.description || 'AWaN plugin')}</p>
						</div>
						<div class="plugin-meta">
							<span class="version-pill">${escapeHTML(plugin.version || 'unknown')}</span>
						</div>
					</div>
					<div class="plugin-actions">
						<button class="ghost plugin-install" data-plugin-install="${plugin.name}" ${installed.has(plugin.name.toLowerCase()) ? 'disabled' : ''}>${installed.has(plugin.name.toLowerCase()) ? 'Installed' : 'Install'}</button>
					</div>
				</div>
			`
		)
		.join('');

	elements.availablePlugins.querySelectorAll('[data-plugin-install]').forEach((button) => {
		button.addEventListener('click', async () => {
			const name = button.getAttribute('data-plugin-install');
			if (!name) {
				return;
			}
			await window.go.ui.App.InstallPlugin(name);
			await refreshPlugins();
		});
	});
}

async function refreshAgents() {
	state.agents = await window.go.ui.App.ListAgents();
	if (state.agents.length > 0 && !state.agents.some((agent) => agent.name === state.currentAgent)) {
		state.currentAgent = state.agents[0].name;
		state.currentModel = state.agents[0].model;
	}
	render();
}

async function refreshMemory() {
	try {
		state.memory = await window.go.ui.App.GetMemory();
		renderMemory();
	} catch (error) {
		elements.memoryPanel.innerHTML = `<div class="empty-state"><p>${escapeHTML(error.message || 'Failed to load memory')}</p></div>`;
	}
}

async function refreshFiles() {
	try {
		state.files = await window.go.ui.App.GetFiles();
		renderFiles();
	} catch (error) {
		elements.filesPanel.innerHTML = `<div class="empty-state"><p>${escapeHTML(error.message || 'Failed to load files')}</p></div>`;
	}
}

async function refreshPlugins() {
	try {
		const [installed, available] = await Promise.all([
			window.go.ui.App.ListPlugins(),
			state.pluginQuery ? window.go.ui.App.SearchPlugins(state.pluginQuery) : window.go.ui.App.ListAvailablePlugins()
		]);
		state.installedPlugins = installed || [];
		state.availablePlugins = available || [];
		renderInstalledPlugins();
		renderAvailablePlugins();
	} catch (error) {
		elements.installedPlugins.innerHTML = `<div class="empty-state"><p>${escapeHTML(error.message || 'Failed to load plugins')}</p></div>`;
		elements.availablePlugins.innerHTML = `<div class="empty-state"><p>${escapeHTML(error.message || 'Failed to load plugins')}</p></div>`;
	}
}

elements.chatForm.addEventListener('submit', async (event) => {
	event.preventDefault();

	const prompt = elements.promptInput.value.trim();
	if (!prompt) {
		return;
	}

	elements.sendButton.disabled = true;
	state.messages.push({
		role: 'user',
		content: prompt
	});
	renderChat();
	elements.chatLog.scrollTop = elements.chatLog.scrollHeight;
	elements.promptInput.value = '';

	try {
		const response = await window.go.ui.App.RunAgent(prompt);
		state.messages.push(response);
		renderChat();
		elements.chatLog.scrollTop = elements.chatLog.scrollHeight;
		await refreshMemory();
	} catch (error) {
		state.messages.push({
			role: 'assistant',
			content: `Error: ${error.message || 'Failed to contact runtime'}`
		});
		renderChat();
		elements.chatLog.scrollTop = elements.chatLog.scrollHeight;
	} finally {
		elements.sendButton.disabled = false;
	}
});

elements.refreshAgents.addEventListener('click', refreshAgents);
elements.refreshMemory.addEventListener('click', refreshMemory);
elements.refreshFiles.addEventListener('click', refreshFiles);
elements.refreshPlugins.addEventListener('click', refreshPlugins);
elements.pluginSearchButton.addEventListener('click', async () => {
	state.pluginQuery = elements.pluginSearchInput.value.trim();
	await refreshPlugins();
});

elements.navItems.forEach((item) => {
	item.addEventListener('click', async () => {
		state.page = item.getAttribute('data-page') || 'chat';
		renderPage();
		if (state.page === 'plugins') {
			await refreshPlugins();
		}
	});
});

function escapeHTML(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

bootstrap();
