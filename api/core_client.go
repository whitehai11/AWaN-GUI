package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

const defaultEndpoint = "http://localhost:7452"

// CoreClient talks to the AWaN Core runtime.
type CoreClient struct {
	endpoint   string
	token      string
	mode       string
	httpClient *http.Client
}

// RuntimeStatus describes the local runtime connection state.
type RuntimeStatus struct {
	Online        bool   `json:"online"`
	Endpoint      string `json:"endpoint"`
	Message       string `json:"message"`
	Mode          string `json:"mode"`
	Version       string `json:"version"`
	Authenticated bool   `json:"authenticated"`
	AuthMode      string `json:"authMode"`
}

type HealthResponse struct {
	Status  string `json:"status"`
	Version string `json:"version"`
	Auth    string `json:"auth"`
}

// AgentRunRequest is sent to /agent/run.
type AgentRunRequest struct {
	Agent  string `json:"agent"`
	Model  string `json:"model,omitempty"`
	Prompt string `json:"prompt"`
}

// AgentRunResponse is returned from /agent/run.
type AgentRunResponse struct {
	Agent     string `json:"agent"`
	Model     string `json:"model"`
	Output    string `json:"output"`
	StartedAt string `json:"startedAt"`
	EndedAt   string `json:"endedAt"`
}

// MemoryRecord is returned from the runtime memory APIs.
type MemoryRecord struct {
	ID        string   `json:"id"`
	Agent     string   `json:"agent"`
	Role      string   `json:"role"`
	Content   string   `json:"content"`
	Tags      []string `json:"tags"`
	CreatedAt string   `json:"createdAt"`
}

// MemorySnapshot contains the current memory state for an agent.
type MemorySnapshot struct {
	Agent      string         `json:"agent"`
	ShortTerm  []MemoryRecord `json:"shortTerm"`
	LongTerm   []MemoryRecord `json:"longTerm"`
	StoredAt   string         `json:"storedAt"`
	Vectorized bool           `json:"vectorized"`
}

// AgentDefinition is the minimal agent info used by the GUI.
type AgentDefinition struct {
	Name        string   `json:"name"`
	Model       string   `json:"model"`
	Memory      bool     `json:"memory"`
	Tools       []string `json:"tools"`
	Description string   `json:"description"`
}

// PluginDefinition is used for installed and available plugin views.
type PluginDefinition struct {
	Name        string `json:"name"`
	Version     string `json:"version"`
	Status      string `json:"status"`
	Description string `json:"description"`
	Repo        string `json:"repo"`
	SourceType  string   `json:"sourceType"`
	Tools       []string `json:"tools"`
}

// NewCoreClient creates a client for the AWaN runtime.
func NewCoreClient(endpoint string) *CoreClient {
	base := strings.TrimSpace(endpoint)
	if base == "" {
		base = strings.TrimSpace(os.Getenv("AWAN_CORE_URL"))
	}
	if base == "" {
		base = defaultEndpoint
	}

	return &CoreClient{
		endpoint: strings.TrimRight(base, "/"),
		mode:     RuntimeModeLocal,
		httpClient: &http.Client{
			Timeout: 20 * time.Second,
		},
	}
}

// Endpoint returns the configured runtime URL.
func (c *CoreClient) Endpoint() string {
	return c.endpoint
}

// Configure updates the runtime endpoint, mode, and optional token.
func (c *CoreClient) Configure(config RuntimeConfig) {
	c.endpoint = strings.TrimRight(config.Server, "/")
	c.token = strings.TrimSpace(config.Token)
	c.mode = strings.TrimSpace(config.Mode)
	if c.mode == "" {
		c.mode = RuntimeModeLocal
	}
}

// Mode returns the active runtime mode.
func (c *CoreClient) Mode() string {
	if c.mode == "" {
		return RuntimeModeLocal
	}
	return c.mode
}

// EnsureRuntime checks the runtime and attempts to start it if unavailable.
func (c *CoreClient) EnsureRuntime() (*RuntimeStatus, error) {
	health, err := c.Health()
	if err == nil {
		return &RuntimeStatus{
			Online:        true,
			Endpoint:      c.endpoint,
			Message:       "Connected to AWaN Core",
			Mode:          c.Mode(),
			Version:       fallbackString(health.Version, "unknown"),
			Authenticated: c.token != "" || strings.EqualFold(health.Auth, "none"),
			AuthMode:      fallbackString(health.Auth, "unknown"),
		}, nil
	}

	if c.Mode() == RuntimeModeRemote {
		return &RuntimeStatus{
			Online:        false,
			Endpoint:      c.endpoint,
			Message:       "Failed to connect to remote AWaN Core",
			Mode:          c.Mode(),
			Version:       "unknown",
			Authenticated: false,
			AuthMode:      "unknown",
		}, err
	}

	if err := c.startCore(); err != nil {
		return &RuntimeStatus{
			Online:        false,
			Endpoint:      c.endpoint,
			Message:       "AWaN Core is not running",
			Mode:          c.Mode(),
			Version:       "unknown",
			Authenticated: false,
			AuthMode:      "unknown",
		}, err
	}

	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		health, err := c.Health()
		if err == nil {
			return &RuntimeStatus{
				Online:        true,
				Endpoint:      c.endpoint,
				Message:       "Started AWaN Core automatically",
				Mode:          c.Mode(),
				Version:       fallbackString(health.Version, "unknown"),
				Authenticated: c.token != "" || strings.EqualFold(health.Auth, "none"),
				AuthMode:      fallbackString(health.Auth, "unknown"),
			}, nil
		}
		time.Sleep(500 * time.Millisecond)
	}

	return &RuntimeStatus{
		Online:        false,
		Endpoint:      c.endpoint,
		Message:       "Timed out waiting for AWaN Core",
		Mode:          c.Mode(),
		Version:       "unknown",
		Authenticated: false,
		AuthMode:      "unknown",
	}, errors.New("timed out waiting for AWaN Core")
}

// Ping checks the runtime health endpoint.
func (c *CoreClient) Ping() error {
	_, err := c.Health()
	return err
}

// Health returns the runtime health payload.
func (c *CoreClient) Health() (*HealthResponse, error) {
	req, err := http.NewRequest(http.MethodGet, c.endpoint+"/healthz", nil)
	if err != nil {
		return nil, err
	}
	c.applyAuth(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("runtime health check failed with status %s", resp.Status)
	}

	var health HealthResponse
	if err := json.NewDecoder(resp.Body).Decode(&health); err != nil {
		return nil, err
	}

	return &health, nil
}

// RunAgent sends a prompt to the runtime.
func (c *CoreClient) RunAgent(prompt, agent, model string) (*AgentRunResponse, error) {
	payload := AgentRunRequest{
		Agent:  agent,
		Model:  model,
		Prompt: prompt,
	}

	var response AgentRunResponse
	if err := c.doJSON(http.MethodPost, "/agent/run", payload, &response); err != nil {
		return nil, err
	}

	return &response, nil
}

// GetMemory fetches the memory snapshot for an agent.
func (c *CoreClient) GetMemory(agent string) (*MemorySnapshot, error) {
	path := "/memory"
	if strings.TrimSpace(agent) != "" {
		path += "?agent=" + url.QueryEscape(agent)
	}

	req, err := http.NewRequest(http.MethodGet, c.endpoint+path, nil)
	if err != nil {
		return nil, err
	}
	c.applyAuth(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("memory request failed with status %s", resp.Status)
	}

	var snapshot MemorySnapshot
	if err := json.NewDecoder(resp.Body).Decode(&snapshot); err != nil {
		return nil, err
	}

	return &snapshot, nil
}

// ListAgents returns runtime agent definitions when available.
func (c *CoreClient) ListAgents() ([]AgentDefinition, error) {
	req, err := http.NewRequest(http.MethodGet, c.endpoint+"/agents", nil)
	if err != nil {
		return nil, err
	}
	c.applyAuth(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return []AgentDefinition{
			{Name: "default", Model: "openai", Memory: true, Tools: []string{"filesystem", "memory"}, Description: "Default AWaN agent"},
		}, nil
	}
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("agent list request failed with status %s", resp.Status)
	}

	var payload struct {
		Agents []AgentDefinition `json:"agents"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}

	return payload.Agents, nil
}

// ListFiles returns the lightweight runtime file listing when available.
func (c *CoreClient) ListFiles() ([]string, error) {
	req, err := http.NewRequest(http.MethodGet, c.endpoint+"/files", nil)
	if err != nil {
		return nil, err
	}
	c.applyAuth(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return []string{}, nil
	}
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("file list request failed with status %s", resp.Status)
	}

	var payload struct {
		Files []string `json:"files"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}

	return payload.Files, nil
}

// ListPlugins returns installed runtime plugins.
func (c *CoreClient) ListPlugins() ([]PluginDefinition, error) {
	req, err := http.NewRequest(http.MethodGet, c.endpoint+"/plugins", nil)
	if err != nil {
		return nil, err
	}
	c.applyAuth(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("plugin list request failed with status %s", resp.Status)
	}

	var payload struct {
		Plugins []PluginDefinition `json:"plugins"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}

	return payload.Plugins, nil
}

// ListRegistryPlugins returns available plugins from the public registry.
func (c *CoreClient) ListRegistryPlugins() ([]PluginDefinition, error) {
	req, err := http.NewRequest(http.MethodGet, c.endpoint+"/plugins/registry", nil)
	if err != nil {
		return nil, err
	}
	c.applyAuth(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("plugin registry request failed with status %s", resp.Status)
	}

	var payload struct {
		Plugins []PluginDefinition `json:"plugins"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}

	return payload.Plugins, nil
}

// SearchPlugins searches the public plugin registry.
func (c *CoreClient) SearchPlugins(query string) ([]PluginDefinition, error) {
	path := "/plugins/search?q=" + url.QueryEscape(query)
	req, err := http.NewRequest(http.MethodGet, c.endpoint+path, nil)
	if err != nil {
		return nil, err
	}
	c.applyAuth(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("plugin search request failed with status %s", resp.Status)
	}

	var payload struct {
		Plugins []PluginDefinition `json:"plugins"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}

	return payload.Plugins, nil
}

// InstallPlugin downloads and registers a plugin in the runtime.
func (c *CoreClient) InstallPlugin(name string) error {
	return c.doJSON(http.MethodPost, "/plugins/install", map[string]string{"name": name}, &map[string]any{})
}

// InstallCustomPlugin installs a plugin directly from a GitHub repository URL.
func (c *CoreClient) InstallCustomPlugin(repo string) error {
	return c.doJSON(http.MethodPost, "/plugins/install", map[string]string{"repo": repo}, &map[string]any{})
}

// RemovePlugin deletes an installed plugin from the runtime.
func (c *CoreClient) RemovePlugin(name string) error {
	return c.doJSON(http.MethodDelete, "/plugins/remove", map[string]string{"name": name}, &map[string]any{})
}

// EnablePlugin re-enables an installed plugin.
func (c *CoreClient) EnablePlugin(name string) error {
	return c.doJSON(http.MethodPost, "/plugins/enable", map[string]string{"name": name}, &map[string]any{})
}

// DisablePlugin disables an installed plugin.
func (c *CoreClient) DisablePlugin(name string) error {
	return c.doJSON(http.MethodPost, "/plugins/disable", map[string]string{"name": name}, &map[string]any{})
}

func (c *CoreClient) doJSON(method, path string, body any, target any) error {
	data, err := json.Marshal(body)
	if err != nil {
		return err
	}

	req, err := http.NewRequest(method, c.endpoint+path, bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	c.applyAuth(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return fmt.Errorf("%s request failed with status %s", path, resp.Status)
	}

	return json.NewDecoder(resp.Body).Decode(target)
}

func (c *CoreClient) applyAuth(req *http.Request) {
	if strings.TrimSpace(c.token) != "" {
		req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(c.token))
	}
}

func (c *CoreClient) startCore() error {
	repoDirs := possibleCoreDirs()
	candidates := []struct {
		command string
		args    []string
		dir     string
	}{
		{command: "awan"},
	}

	for _, dir := range repoDirs {
		candidates = append(candidates, struct {
			command string
			args    []string
			dir     string
		}{
			command: "go",
			args:    []string{"run", "."},
			dir:     dir,
		})
	}

	for _, candidate := range candidates {
		cmd := exec.Command(candidate.command, candidate.args...)
		if candidate.dir != "" {
			cmd.Dir = candidate.dir
		}
		if err := cmd.Start(); err == nil {
			return nil
		}
	}

	return errors.New("failed to start AWaN Core automatically")
}

func possibleCoreDirs() []string {
	dirs := []string{}

	if workingDir, err := os.Getwd(); err == nil {
		dirs = append(dirs, filepath.Clean(filepath.Join(workingDir, "..", "AWaN")))
	}

	if exePath, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exePath)
		dirs = append(dirs, filepath.Clean(filepath.Join(exeDir, "..", "AWaN")))
	}

	seen := map[string]bool{}
	result := make([]string, 0, len(dirs))
	for _, dir := range dirs {
		if dir == "" || seen[dir] {
			continue
		}
		if info, err := os.Stat(dir); err == nil && info.IsDir() {
			seen[dir] = true
			result = append(result, dir)
		}
	}

	return result
}

func fallbackString(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return strings.TrimSpace(value)
}
