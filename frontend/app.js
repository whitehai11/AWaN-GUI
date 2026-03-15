const state = {
	currentAgent: 'default',
	currentModel: 'openai',
	status: null,
	agents: [],
	memory: null,
	files: [],
	messages: []
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
	refreshFiles: document.getElementById('refresh-files')
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
		await Promise.all([refreshMemory(), refreshFiles()]);
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
	renderStatus();
	renderAgents();
	renderChat();
	renderMemory();
	renderFiles();
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

function escapeHTML(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

bootstrap();
