package ui

import (
	"context"
	"errors"
	"os"

	"github.com/whitehai11/AWaN-GUI/api"
)

// App is the Wails-bound desktop controller.
type App struct {
	ctx          context.Context
	client       *api.CoreClient
	config       api.RuntimeConfig
	currentAgent string
	currentModel string
	lastMessages []ChatMessage
}

// NewApp creates the Wails-bound application controller.
func NewApp(client *api.CoreClient) *App {
	config := api.DefaultRuntimeConfig()
	client.Configure(config)

	return &App{
		client:       client,
		config:       config,
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
	SetupRequired bool                  `json:"setupRequired"`
	Config        api.RuntimeConfig     `json:"config"`
	Status        *api.RuntimeStatus    `json:"status"`
	Agents        []api.AgentDefinition `json:"agents"`
}, error) {
	config, err := api.LoadRuntimeConfig()
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return &struct {
				SetupRequired bool                  `json:"setupRequired"`
				Config        api.RuntimeConfig     `json:"config"`
				Status        *api.RuntimeStatus    `json:"status"`
				Agents        []api.AgentDefinition `json:"agents"`
			}{
				SetupRequired: true,
				Config:        api.DefaultRuntimeConfig(),
				Status:        nil,
				Agents:        []api.AgentDefinition{},
			}, nil
		}
		return nil, err
	}

	a.config = config
	a.client.Configure(config)

	status, err := a.client.EnsureRuntime()
	if err != nil {
		if a.config.Mode == api.RuntimeModeRemote {
			return &struct {
				SetupRequired bool                  `json:"setupRequired"`
				Config        api.RuntimeConfig     `json:"config"`
				Status        *api.RuntimeStatus    `json:"status"`
				Agents        []api.AgentDefinition `json:"agents"`
			}{
				SetupRequired: false,
				Config:        a.config,
				Status:        status,
				Agents:        []api.AgentDefinition{},
			}, nil
		}
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
		SetupRequired bool                  `json:"setupRequired"`
		Config        api.RuntimeConfig     `json:"config"`
		Status        *api.RuntimeStatus    `json:"status"`
		Agents        []api.AgentDefinition `json:"agents"`
	}{
		SetupRequired: false,
		Config:        a.config,
		Status:        status,
		Agents:        agents,
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

// GetRuntimeConfig returns the currently loaded runtime config.
func (a *App) GetRuntimeConfig() api.RuntimeConfig {
	return a.config
}

// TestRuntimeConnection validates a runtime config without persisting it.
func (a *App) TestRuntimeConnection(mode, server, token string) (*api.RuntimeStatus, error) {
	config, err := api.NormalizeRuntimeConfig(api.RuntimeConfig{
		Mode:   mode,
		Server: server,
		Token:  token,
	})
	if err != nil {
		return nil, err
	}

	client := api.NewCoreClient(config.Server)
	client.Configure(config)
	return client.EnsureRuntime()
}

// SaveRuntimeConfiguration stores runtime mode settings and reconnects the GUI.
func (a *App) SaveRuntimeConfiguration(mode, server, token string) (*struct {
	Config api.RuntimeConfig  `json:"config"`
	Status *api.RuntimeStatus `json:"status"`
}, error) {
	config, err := api.SaveRuntimeConfig(api.RuntimeConfig{
		Mode:   mode,
		Server: server,
		Token:  token,
	})
	if err != nil {
		return nil, err
	}

	a.config = config
	a.client.Configure(config)
	status, err := a.client.EnsureRuntime()
	if err != nil {
		return nil, err
	}

	return &struct {
		Config api.RuntimeConfig  `json:"config"`
		Status *api.RuntimeStatus `json:"status"`
	}{
		Config: config,
		Status: status,
	}, nil
}
