package ui

import (
	"context"

	"github.com/whitehai11/AWaN-GUI/api"
)

// App is the Wails-bound desktop controller.
type App struct {
	ctx          context.Context
	client       *api.CoreClient
	currentAgent string
	currentModel string
	lastMessages []ChatMessage
}

// NewApp creates the Wails-bound application controller.
func NewApp(client *api.CoreClient) *App {
	return &App{
		client:       client,
		currentAgent: "default",
		currentModel: "openai",
		lastMessages: []ChatMessage{},
	}
}

// Startup runs when the desktop app starts.
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
}

// Initialize checks the runtime, starts it if needed, and returns the startup state.
func (a *App) Initialize() (*struct {
	Status *api.RuntimeStatus    `json:"status"`
	Agents []api.AgentDefinition `json:"agents"`
}, error) {
	status, err := a.client.EnsureRuntime()
	if err != nil {
		return nil, err
	}

	agents, err := a.client.ListAgents()
	if err != nil {
		return nil, err
	}
	if len(agents) > 0 {
		a.currentAgent = agents[0].Name
		a.currentModel = agents[0].Model
	}

	return &struct {
		Status *api.RuntimeStatus    `json:"status"`
		Agents []api.AgentDefinition `json:"agents"`
	}{
		Status: status,
		Agents: agents,
	}, nil
}

// ListAgents returns the available runtime agents.
func (a *App) ListAgents() ([]api.AgentDefinition, error) {
	return a.client.ListAgents()
}

// SelectAgent updates the current desktop selection.
func (a *App) SelectAgent(name, model string) map[string]string {
	if name != "" {
		a.currentAgent = name
	}
	if model != "" {
		a.currentModel = model
	}

	return map[string]string{
		"agent": a.currentAgent,
		"model": a.currentModel,
	}
}

// RuntimeStatus returns the current runtime status.
func (a *App) RuntimeStatus() (*api.RuntimeStatus, error) {
	return a.client.EnsureRuntime()
}
