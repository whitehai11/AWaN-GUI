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
	pluginQuery: '',
	setupRequired: false,
	runtimeConfig: {
		mode: 'local',
		server: 'http://localhost:7452',
		token: ''
	}
};

const elements = {
	setupScreen: document.getElementById('setup-screen'),
	setupStatus: document.getElementById('setup-status'),
	modeLocal: document.getElementById('mode-local'),
	modeRemote: document.getElementById('mode-remote'),
	runtimeServerInput: document.getElementById('runtime-server-input'),
	runtimeTokenInput: document.getElementById('runtime-token-input'),
	testRuntimeButton: document.getElementById('test-runtime-button'),
	saveRuntimeButton: document.getElementById('save-runtime-button'),
	settingsModeLocal: document.getElementById('settings-mode-local'),
	settingsModeRemote: document.getElementById('settings-mode-remote'),
	settingsServerInput: document.getElementById('settings-server-input'),
	settingsTokenInput: document.getElementById('settings-token-input'),
	settingsStatus: document.getElementById('settings-status'),
	settingsTestButton: document.getElementById('settings-test-button'),
	settingsSaveButton: document.getElementById('settings-save-button'),
	runtimeModePill: document.getElementById('runtime-mode-pill'),
	runtimeVersionPill: document.getElementById('runtime-version-pill'),
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
	settingsPage: document.getElementById('settings-page'),
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
		state.setupRequired = Boolean(result.setupRequired);
		state.runtimeConfig = result.config || state.runtimeConfig;
		state.status = result.status;
		state.agents = result.agents || [];

		applyRuntimeConfigToForm();

		if (state.agents.length > 0) {
			state.currentAgent = state.agents[0].name;
			state.currentModel = state.agents[0].model;
		}

		render();

		if (!state.setupRequired && state.status?.online) {
			await Promise.all([refreshMemory(), refreshFiles(), refreshPlugins()]);
		}
	} catch (error) {
		state.setupRequired = true;
		state.status = {
			online: false,
			endpoint: state.runtimeConfig.server,
			message: error.message || 'Failed to initialize AWaN GUI',
			mode: state.runtimeConfig.mode,
			version: 'unknown',
			authenticated: false,
			authMode: 'unknown'
		};
		applyRuntimeConfigToForm();
		render();
	}
}

function render() {
	renderSetup();
	renderPage();
	renderStatus();
	renderAgents();
	renderChat();
	renderMemory();
	renderFiles();
	renderInstalledPlugins();
	renderAvailablePlugins();
	renderSettings();
}

function renderSetup() {
	elements.setupScreen.classList.toggle('hidden', !state.setupRequired);
	toggleModeButtons('[data-runtime-mode]', state.runtimeConfig.mode);
	toggleModeButtons('[data-settings-mode]', state.runtimeConfig.mode);
	applyModeFieldState();
}

function renderPage() {
	const activePage = state.page;
	elements.chatPage.classList.toggle('active', activePage === 'chat');
	elements.pluginsPage.classList.toggle('active', activePage === 'plugins');
	elements.settingsPage.classList.toggle('active', activePage === 'settings');
	elements.navItems.forEach((item) => {
		item.classList.toggle('active', item.getAttribute('data-page') === activePage);
	});
}

function renderStatus() {
	const status = state.status;
	if (!status) {
		elements.runtimeStatus.textContent = 'Waiting for runtime setup...';
		elements.runtimeEndpoint.textContent = '';
		return;
	}

	elements.runtimeStatus.textContent = status.message;
	elements.runtimeEndpoint.textContent = `${status.endpoint} · ${status.mode || 'local'} · auth ${status.authMode || 'unknown'}`;
	elements.currentAgentLabel.textContent = `Agent: ${state.currentAgent}`;
	elements.currentModelLabel.textContent = `Model: ${state.currentModel}`;
	elements.runtimeModePill.textContent = `Mode: ${state.runtimeConfig.mode || 'local'}`;
	elements.runtimeVersionPill.textContent = `Version: ${status.version || 'unknown'}`;
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

function renderSettings() {
	elements.settingsServerInput.value = state.runtimeConfig.server || 'http://localhost:7452';
	elements.settingsTokenInput.value = state.runtimeConfig.token || '';
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

async function applyRuntimeConfig(save, targetElement) {
	const mode = state.runtimeConfig.mode;
	const server = state.runtimeConfig.server;
	const token = state.runtimeConfig.token;

	try {
		const result = save
			? await window.go.ui.App.SaveRuntimeConfiguration(mode, server, token)
			: { status: await window.go.ui.App.TestRuntimeConnection(mode, server, token), config: { ...state.runtimeConfig } };

		state.status = result.status;
		state.runtimeConfig = result.config || state.runtimeConfig;
		renderStatus();
		showStatusMessage(targetElement, `${save ? 'Saved' : 'Connected'}: ${result.status.message}`, false);

		if (save) {
			state.setupRequired = false;
			elements.setupStatus.textContent = '';
		}

		state.agents = await window.go.ui.App.ListAgents();
		if (state.agents.length > 0) {
			state.currentAgent = state.agents[0].name;
			state.currentModel = state.agents[0].model;
		}
		await Promise.all([refreshMemory(), refreshFiles(), refreshPlugins()]);
		render();
	} catch (error) {
		state.status = {
			online: false,
			endpoint: server,
			message: error.message || 'Connection failed',
			mode,
			version: 'unknown',
			authenticated: false,
			authMode: token ? 'token' : 'unknown'
		};
		renderStatus();
		showStatusMessage(targetElement, error.message || 'Connection failed', true);
	}
}

function showStatusMessage(element, message, isError) {
	element.textContent = message;
	element.classList.toggle('error', isError);
	element.classList.toggle('success', !isError);
}

function applyRuntimeConfigToForm() {
	elements.runtimeServerInput.value = state.runtimeConfig.server || 'http://localhost:7452';
	elements.runtimeTokenInput.value = state.runtimeConfig.token || '';
	elements.settingsServerInput.value = state.runtimeConfig.server || 'http://localhost:7452';
	elements.settingsTokenInput.value = state.runtimeConfig.token || '';
	renderSetup();
	renderSettings();
}

function applyModeFieldState() {
	const isLocal = state.runtimeConfig.mode === 'local';
	elements.runtimeServerInput.value = state.runtimeConfig.server || 'http://localhost:7452';
	elements.settingsServerInput.value = state.runtimeConfig.server || 'http://localhost:7452';
	elements.runtimeServerInput.disabled = isLocal;
	elements.runtimeTokenInput.disabled = false;
	elements.settingsServerInput.disabled = isLocal;
}

function toggleModeButtons(selector, activeMode) {
	document.querySelectorAll(selector).forEach((button) => {
		button.classList.toggle('active', button.getAttribute(button.dataset.runtimeMode ? 'data-runtime-mode' : 'data-settings-mode') === activeMode);
	});
}

function setRuntimeMode(mode) {
	state.runtimeConfig.mode = mode;
	if (mode === 'local' && !state.runtimeConfig.server) {
		state.runtimeConfig.server = 'http://localhost:7452';
	}
	applyRuntimeConfigToForm();
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

document.querySelectorAll('[data-runtime-mode]').forEach((button) => {
	button.addEventListener('click', () => setRuntimeMode(button.getAttribute('data-runtime-mode') || 'local'));
});

document.querySelectorAll('[data-settings-mode]').forEach((button) => {
	button.addEventListener('click', () => setRuntimeMode(button.getAttribute('data-settings-mode') || 'local'));
});

elements.runtimeServerInput.addEventListener('input', (event) => {
	state.runtimeConfig.server = event.target.value;
	elements.settingsServerInput.value = event.target.value;
});
elements.runtimeTokenInput.addEventListener('input', (event) => {
	state.runtimeConfig.token = event.target.value;
	elements.settingsTokenInput.value = event.target.value;
});
elements.settingsServerInput.addEventListener('input', (event) => {
	state.runtimeConfig.server = event.target.value;
	elements.runtimeServerInput.value = event.target.value;
});
elements.settingsTokenInput.addEventListener('input', (event) => {
	state.runtimeConfig.token = event.target.value;
	elements.runtimeTokenInput.value = event.target.value;
});

elements.testRuntimeButton.addEventListener('click', async () => {
	await applyRuntimeConfig(false, elements.setupStatus);
});
elements.saveRuntimeButton.addEventListener('click', async () => {
	await applyRuntimeConfig(true, elements.setupStatus);
});
elements.settingsTestButton.addEventListener('click', async () => {
	await applyRuntimeConfig(false, elements.settingsStatus);
});
elements.settingsSaveButton.addEventListener('click', async () => {
	await applyRuntimeConfig(true, elements.settingsStatus);
});

function escapeHTML(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

bootstrap();
