package api

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
)

const (
	RuntimeModeLocal  = "local"
	RuntimeModeRemote = "remote"
	defaultGUIConfig  = ".awan/gui/config.awan"
)

// RuntimeConfig stores how the GUI connects to AWaN Core.
type RuntimeConfig struct {
	Mode   string `json:"mode"`
	Server string `json:"server"`
	Token  string `json:"token"`
}

// DefaultRuntimeConfig returns the local runtime configuration.
func DefaultRuntimeConfig() RuntimeConfig {
	return RuntimeConfig{
		Mode:   RuntimeModeLocal,
		Server: defaultEndpoint,
	}
}

// LoadRuntimeConfig loads the GUI runtime connection config from disk.
func LoadRuntimeConfig() (RuntimeConfig, error) {
	path, err := runtimeConfigPath()
	if err != nil {
		return RuntimeConfig{}, err
	}

	data, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return RuntimeConfig{}, os.ErrNotExist
		}
		return RuntimeConfig{}, err
	}

	config := DefaultRuntimeConfig()
	lines := strings.Split(string(data), "\n")
	for _, rawLine := range lines {
		line := strings.TrimSpace(rawLine)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}

		key = strings.TrimSpace(strings.ToLower(key))
		value = strings.TrimSpace(value)
		switch key {
		case "mode":
			config.Mode = strings.ToLower(value)
		case "server":
			config.Server = value
		case "token":
			config.Token = value
		}
	}

	return NormalizeRuntimeConfig(config)
}

// SaveRuntimeConfig persists the GUI runtime config in .awan format.
func SaveRuntimeConfig(config RuntimeConfig) (RuntimeConfig, error) {
	normalized, err := NormalizeRuntimeConfig(config)
	if err != nil {
		return RuntimeConfig{}, err
	}

	path, err := runtimeConfigPath()
	if err != nil {
		return RuntimeConfig{}, err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return RuntimeConfig{}, err
	}

	content := strings.Join([]string{
		"mode = " + normalized.Mode,
		"server = " + normalized.Server,
		"token = " + normalized.Token,
		"",
	}, "\n")

	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		return RuntimeConfig{}, err
	}

	return normalized, nil
}

// NormalizeRuntimeConfig validates and normalizes runtime config input.
func NormalizeRuntimeConfig(config RuntimeConfig) (RuntimeConfig, error) {
	mode := strings.ToLower(strings.TrimSpace(config.Mode))
	if mode == "" {
		mode = RuntimeModeLocal
	}
	if mode != RuntimeModeLocal && mode != RuntimeModeRemote {
		return RuntimeConfig{}, errors.New("runtime mode must be local or remote")
	}

	server := strings.TrimRight(strings.TrimSpace(config.Server), "/")
	if server == "" {
		server = defaultEndpoint
	}
	if !strings.HasPrefix(server, "http://") && !strings.HasPrefix(server, "https://") {
		server = "http://" + server
	}

	return RuntimeConfig{
		Mode:   mode,
		Server: server,
		Token:  strings.TrimSpace(config.Token),
	}, nil
}

func runtimeConfigPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, defaultGUIConfig), nil
}
